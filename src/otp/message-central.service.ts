import { Injectable, Logger } from '@nestjs/common';

export type MessageCentralSendResult =
  | {
      ok: true;
      verificationId: string;
      expiresInSeconds: number;
    }
  | {
      ok: false;
      error: string;
      http?: number;
      body?: unknown;
    };

export type MessageCentralValidateResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      http?: number;
      body?: unknown;
    };

interface CachedAuthToken {
  token: string;
  expiresAt: number;
}

const REQUEST_TIMEOUT_MS = 20_000;
const TOKEN_SKEW_MS = 60_000;

@Injectable()
export class MessageCentralService {
  private readonly log = new Logger(MessageCentralService.name);
  private cachedAuth: CachedAuthToken | null = null;

  isConfigured(): boolean {
    return (
      this.customerId() !== '' &&
      this.baseUrl() !== '' &&
      (this.staticAuthToken() !== '' || this.apiKey() !== '')
    );
  }

  /** Pre-generated authToken from Message Central (JWT), alternative to KEY + token API. */
  private staticAuthToken(): string {
    return process.env.MESSAGE_CENTRAL_AUTH_TOKEN?.trim() ?? '';
  }

  private baseUrl(): string {
    return (process.env.MESSAGE_CENTRAL_BASE_URL ?? 'https://cpaas.messagecentral.com').replace(
      /\/+$/,
      '',
    );
  }

  private customerId(): string {
    return process.env.MESSAGE_CENTRAL_CUSTOMER_ID ?? '';
  }

  private apiKey(): string {
    return process.env.MESSAGE_CENTRAL_KEY ?? '';
  }

  private defaultCountryCode(): string {
    return process.env.MESSAGE_CENTRAL_COUNTRY_CODE ?? '961';
  }

  private flowType(): string {
    return process.env.MESSAGE_CENTRAL_FLOW_TYPE ?? 'WHATSAPP';
  }

  private otpLength(): number {
    const raw = process.env.MESSAGE_CENTRAL_OTP_LENGTH ?? '6';
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 4 && n <= 8 ? n : 6;
  }

  /** Split E.164 into Message Central countryCode + local mobileNumber. */
  phoneParts(phoneE164: string): { countryCode: string; mobileNumber: string } {
    const countryCode = this.defaultCountryCode();
    let digits = phoneE164.replace(/\D/g, '');
    if (digits.startsWith(countryCode)) {
      digits = digits.slice(countryCode.length);
    }
    while (digits.startsWith('0') && digits.length > 1) {
      digits = digits.slice(1);
    }
    return { countryCode, mobileNumber: digits };
  }

  async sendWhatsAppOtp(phoneE164: string): Promise<MessageCentralSendResult> {
    if (!this.isConfigured()) {
      return { ok: false, error: 'message_central_not_configured' };
    }

    const authToken = await this.getAuthToken();
    if (!authToken) {
      return { ok: false, error: 'auth_token_failed' };
    }

    const { countryCode, mobileNumber } = this.phoneParts(phoneE164);
    const params = new URLSearchParams({
      countryCode,
      flowType: this.flowType(),
      mobileNumber,
      otpLength: String(this.otpLength()),
    });

    const res = await this.request(
      `${this.baseUrl()}/verification/v3/send?${params.toString()}`,
      {
        method: 'POST',
        headers: {
          accept: '*/*',
          authToken,
        },
      },
    );

    if (!res.ok) {
      return this.failSend(res.body, res.http);
    }

    const data = this.readData(res.body);
    const verificationId = data?.verificationId;
    if (!verificationId) {
      return this.failSend(res.body, res.http, 'no_verification_id');
    }

    const timeoutSec = Number.parseInt(String(data?.timeout ?? ''), 10);
    const expiresInSeconds =
      Number.isFinite(timeoutSec) && timeoutSec > 0 ? timeoutSec : 300;

    return {
      ok: true,
      verificationId: String(verificationId),
      expiresInSeconds,
    };
  }

  async validateOtp(
    verificationId: string,
    code: string,
  ): Promise<MessageCentralValidateResult> {
    if (!this.isConfigured()) {
      return { ok: false, error: 'message_central_not_configured' };
    }

    const authToken = await this.getAuthToken();
    if (!authToken) {
      return { ok: false, error: 'auth_token_failed' };
    }

    const params = new URLSearchParams({
      verificationId,
      code: code.trim(),
    });

    const res = await this.request(
      `${this.baseUrl()}/verification/v3/validateOtp?${params.toString()}`,
      {
        method: 'POST',
        headers: {
          accept: '*/*',
          authToken,
        },
      },
    );

    if (!res.ok) {
      return {
        ok: false,
        error: 'validate_http_error',
        http: res.http,
        body: res.body,
      };
    }

    const topCode = this.readResponseCode(res.body);
    const data = this.readData(res.body);
    const status = String(data?.verificationStatus ?? '');
    const dataCode = String(data?.responseCode ?? '');

    if (
      topCode === 200 &&
      (status === 'VERIFICATION_COMPLETED' || dataCode === '200')
    ) {
      return { ok: true };
    }

    const mcError = String(data?.errorMessage ?? data?.responseCode ?? topCode);
    return {
      ok: false,
      error: this.mapValidateError(mcError, dataCode),
      body: res.body,
    };
  }

  private failSend(
    body: unknown,
    http?: number,
    fallbackError = 'send_failed',
  ): MessageCentralSendResult {
    const topCode = this.readResponseCode(body);
    const data = this.readData(body);
    const message = String(
      (body as { message?: string })?.message ??
        data?.errorMessage ??
        '',
    ).toLowerCase();

    if (
      topCode === 508 ||
      String(data?.responseCode ?? '') === '508' ||
      message.includes('insufficient credits')
    ) {
      return { ok: false, error: 'insufficient_credits', http, body };
    }

    if (message.includes('discontinued') || message.includes('new platform')) {
      return { ok: false, error: 'whatsapp_platform_discontinued', http, body };
    }

    return { ok: false, error: fallbackError, http, body };
  }

  private mapValidateError(message: string, code: string): string {
    const combined = `${message} ${code}`.toUpperCase();
    if (combined.includes('702') || combined.includes('WRONG_OTP')) {
      return 'wrong_otp';
    }
    if (combined.includes('705') || combined.includes('EXPIRED')) {
      return 'expired';
    }
    if (combined.includes('703') || combined.includes('ALREADY_VERIFIED')) {
      return 'already_verified';
    }
    return 'invalid_otp';
  }

  private async getAuthToken(): Promise<string | null> {
    const staticToken = this.staticAuthToken();
    if (staticToken !== '') {
      return staticToken;
    }

    if (this.cachedAuth && Date.now() < this.cachedAuth.expiresAt - TOKEN_SKEW_MS) {
      return this.cachedAuth.token;
    }

    const params = new URLSearchParams({
      customerId: this.customerId(),
      key: this.apiKey(),
      scope: process.env.MESSAGE_CENTRAL_AUTH_SCOPE ?? 'NEW',
      country: this.defaultCountryCode(),
    });
    const email = process.env.MESSAGE_CENTRAL_EMAIL?.trim();
    if (email) {
      params.set('email', email);
    }

    const res = await this.request(
      `${this.baseUrl()}/auth/v1/authentication/token?${params.toString()}`,
      {
        method: 'GET',
        headers: { accept: '*/*' },
      },
    );

    if (!res.ok) {
      this.log.warn(
        `Message Central auth failed (${res.http}): ${JSON.stringify(res.body)}`,
      );
      return null;
    }

    const data = this.readData(res.body);
    const token = data?.authToken;
    if (!token || typeof token !== 'string') {
      this.log.warn(`Message Central auth missing token: ${JSON.stringify(res.body)}`);
      return null;
    }

    this.cachedAuth = {
      token,
      expiresAt: this.readJwtExpiryMs(token) ?? Date.now() + 55 * 60 * 1000,
    };
    return token;
  }

  private readJwtExpiryMs(token: string): number | null {
    try {
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf8'),
      ) as { exp?: number };
      if (typeof payload.exp === 'number' && payload.exp > 0) {
        return payload.exp * 1000;
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  private readResponseCode(body: unknown): number {
    if (body && typeof body === 'object' && 'responseCode' in body) {
      const code = Number((body as { responseCode: unknown }).responseCode);
      if (Number.isFinite(code)) return code;
    }
    return 0;
  }

  private readData(body: unknown): Record<string, unknown> | null {
    if (!body || typeof body !== 'object') return null;
    const data = (body as { data?: unknown }).data;
    if (data && typeof data === 'object') {
      return data as Record<string, unknown>;
    }
    return null;
  }

  private async request(
    url: string,
    init: RequestInit,
  ): Promise<{ ok: boolean; http?: number; body?: unknown }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      const text = await res.text();
      let body: unknown = text;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        /* keep raw */
      }
      return { ok: res.ok, http: res.status, body };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.warn(`Message Central request failed: ${message}`);
      return { ok: false, body: { error: message } };
    } finally {
      clearTimeout(timeout);
    }
  }
}
