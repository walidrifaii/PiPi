import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

export type SendOtpViaNodeCampaignResult =
  | {
      ok: true;
      campaign: string;
      campaignId: string;
    }
  | {
      ok: false;
      error: string;
      step?: string;
      http?: number;
      body?: unknown;
      details?: string;
    };

const REQUEST_TIMEOUT_MS = 20_000;

@Injectable()
export class WhatsAppNodeService {
  private nodeUrl(): string {
    const raw = process.env.WHATSAPP_NODE_URL ?? '';
    return raw.replace(/\/+$/, '');
  }

  private nodeToken(): string {
    return process.env.WHATSAPP_NODE_TOKEN ?? '';
  }

  private clientId(): string {
    return process.env.WHATSAPP_NODE_CLIENT_ID ?? '';
  }

  async sendOtpViaNodeCampaign(
    phoneE164: string,
    code: number,
  ): Promise<SendOtpViaNodeCampaignResult> {
    const url = this.nodeUrl();
    const token = this.nodeToken();
    const clientId = this.clientId();

    if (url === '' || token === '' || clientId === '') {
      return { ok: false, error: 'node_not_configured' };
    }

    const campaignName = `otp_${randomUUID().replace(/-/g, '')}`;
    // Embed code in the message — Node's campaign runner JSON.parse's contact
    // variables for {code} and crashes with "Unexpected token o in JSON at position 1".
    const message = `Your verification code is ${code}. It expires in 5 minutes. Do not share it with anyone.`;

    const create = await this.postJson(
      `${url}/api/campaigns`,
      token,
      {
        name: campaignName,
        message,
        clientId,
      },
      'campaign_create',
    );
    if (!create.ok) {
      return this.failStep('campaign_create', create);
    }

    const campaignId =
      this.readNestedId(create.body, 'campaign._id') ??
      this.readNestedId(create.body, 'campaign.id');

    if (!campaignId) {
      return {
        ok: false,
        error: 'no_campaign_id',
        body: create.body,
      };
    }

    const add = await this.uploadContactCsv(
      url,
      token,
      String(campaignId),
      phoneE164,
    );
    if (!add.ok) {
      return this.failStep('contact_add', add, add.error ?? 'contact_add_failed');
    }

    const start = await this.postJson(
      `${url}/api/campaigns/${campaignId}/start`,
      token,
      {},
      'campaign_start',
    );
    if (!start.ok) {
      const balance =
        start.http === 403 &&
        typeof start.body === 'object' &&
        start.body !== null &&
        'balanceExhausted' in start.body &&
        (start.body as { balanceExhausted?: boolean }).balanceExhausted ===
          true;

      if (balance) {
        return {
          ok: false,
          error: 'balance_exhausted',
          step: 'campaign_start',
          http: start.http,
          body: start.body,
        };
      }

      return this.failStep('campaign_start', start, 'campaign_start_failed');
    }

    return {
      ok: true,
      campaign: campaignName,
      campaignId: String(campaignId),
    };
  }

  /** Node expects digits-only phone (e.g. 96171970408), not +961…. */
  private phoneForNode(phoneE164: string): string {
    // Defense in depth: drop Lebanon trunk 0 if still present (+9610…).
    let e164 = phoneE164.trim();
    while (e164.startsWith('+9610') && e164.length > '+9610'.length) {
      e164 = `+961${e164.slice('+9610'.length)}`;
    }
    return e164.replace(/\D/g, '');
  }

  /**
   * Single-contact CSV upload — Node's JSON POST …/add is broken (500 JSON parse).
   * Uses POST …/upload with multipart field `contacts`.
   */
  private async uploadContactCsv(
    baseUrl: string,
    token: string,
    campaignId: string,
    phoneE164: string,
  ): Promise<{
    ok: boolean;
    body?: unknown;
    http?: number;
    details?: string;
    timedOut?: boolean;
    error?: string;
  }> {
    const phone = this.phoneForNode(phoneE164);
    const csv = `phone,name\n${phone},User\n`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const form = new FormData();
      form.append(
        'contacts',
        new Blob([csv], { type: 'text/csv' }),
        'contacts.csv',
      );

      const res = await fetch(
        `${baseUrl}/api/contacts/${campaignId}/upload`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
          body: form,
          signal: controller.signal,
        },
      );

      const text = await res.text();
      let body: unknown = text;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        /* keep raw text */
      }

      if (!res.ok) {
        const balance =
          res.status === 403 &&
          typeof body === 'object' &&
          body !== null &&
          'balanceExhausted' in body &&
          (body as { balanceExhausted?: boolean }).balanceExhausted === true;

        return {
          ok: false,
          http: res.status,
          body,
          error: balance ? 'balance_exhausted' : undefined,
        };
      }

      return { ok: true, body, http: res.status };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isTimeout =
        err instanceof Error &&
        (err.name === 'AbortError' || message.includes('aborted'));

      return {
        ok: false,
        timedOut: isTimeout,
        details: message,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private failStep(
    step: string,
    res: {
      http?: number;
      body?: unknown;
      details?: string;
      timedOut?: boolean;
    },
    httpError?: string,
  ): SendOtpViaNodeCampaignResult {
    if (res.timedOut) {
      return {
        ok: false,
        error: 'node_connection_timeout',
        step,
        details: res.details,
      };
    }
    return {
      ok: false,
      error: httpError ?? 'campaign_create_failed',
      step,
      http: res.http,
      body: res.body,
      details: res.details,
    };
  }

  private readNestedId(
    body: unknown,
    path: string,
  ): string | number | undefined {
    const parts = path.split('.');
    let current: unknown = body;
    for (const part of parts) {
      if (current === null || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }
    if (typeof current === 'string' || typeof current === 'number') {
      return current;
    }
    return undefined;
  }

  private async postJson(
    url: string,
    token: string,
    payload: Record<string, unknown>,
    step: string,
  ): Promise<{
    ok: boolean;
    body?: unknown;
    http?: number;
    details?: string;
    timedOut?: boolean;
  }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const text = await res.text();
      let body: unknown = text;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        /* keep raw text */
      }

      if (!res.ok) {
        return {
          ok: false,
          http: res.status,
          body,
        };
      }

      return { ok: true, body, http: res.status };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isTimeout =
        err instanceof Error &&
        (err.name === 'AbortError' || message.includes('aborted'));

      return {
        ok: false,
        timedOut: isTimeout,
        details: message,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
