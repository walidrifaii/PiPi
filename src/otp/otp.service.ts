import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { WhatsAppNodeService } from './whatsapp-node.service';

type OtpPurpose = 'register';

interface StoredOtp {
  hash: string;
  expiresAt: number;
}

export interface PendingUserRegistration {
  phoneVerified: boolean;
  expiresAt: number;
}

@Injectable()
export class OtpService {
  /** In-process store keyed by purpose:phone (sufficient until verify step uses Redis). */
  private readonly store = new Map<string, StoredOtp>();
  private readonly pendingRegister = new Map<string, PendingUserRegistration>();

  constructor(private readonly whatsAppNode: WhatsAppNodeService) {}

  private pepper(): string {
    return process.env.OTP_PEPPER ?? '';
  }

  private ttlSeconds(): number {
    const raw = process.env.OTP_TTL_SECONDS ?? '300';
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 300;
  }

  private storeKey(purpose: OtpPurpose, phoneE164: string): string {
    return `${purpose}:${phoneE164}`;
  }

  private hashCode(phoneE164: string, code: number): string {
    const pepper = this.pepper();
    if (pepper === '') {
      throw new ServiceUnavailableException('OTP is not configured (OTP_PEPPER)');
    }
    return createHmac('sha256', pepper)
      .update(`${phoneE164}:${code}`)
      .digest('hex');
  }

  private generateCode(): number {
    return randomInt(100_000, 1_000_000);
  }

  setPendingRegistration(phone: string): string {
    const phoneE164 = this.normalizePhoneE164(phone);
    const expiresAt = Date.now() + this.ttlSeconds() * 1000;
    this.pendingRegister.set(phoneE164, { phoneVerified: false, expiresAt });
    return phoneE164;
  }

  markPhoneVerifiedForRegistration(phone: string): void {
    const phoneE164 = this.normalizePhoneE164(phone);
    const pending = this.pendingRegister.get(phoneE164);
    if (!pending || Date.now() > pending.expiresAt) {
      throw new BadRequestException(
        'Registration session expired. Submit POST /auth/user/register again.',
      );
    }
    this.pendingRegister.set(phoneE164, {
      ...pending,
      phoneVerified: true,
      expiresAt: Date.now() + this.ttlSeconds() * 1000,
    });
  }

  isPhoneVerifiedForRegistration(phone: string): boolean {
    const phoneE164 = this.normalizePhoneE164(phone);
    const pending = this.pendingRegister.get(phoneE164);
    if (!pending || Date.now() > pending.expiresAt) {
      this.pendingRegister.delete(phoneE164);
      return false;
    }
    return pending.phoneVerified;
  }

  hasPendingRegistration(phone: string): boolean {
    const phoneE164 = this.normalizePhoneE164(phone);
    const pending = this.pendingRegister.get(phoneE164);
    if (!pending) {
      return false;
    }
    if (Date.now() > pending.expiresAt) {
      this.pendingRegister.delete(phoneE164);
      return false;
    }
    return true;
  }

  consumePendingRegistration(phone: string): PendingUserRegistration | null {
    const phoneE164 = this.normalizePhoneE164(phone);
    const pending = this.pendingRegister.get(phoneE164);
    this.pendingRegister.delete(phoneE164);
    if (!pending || Date.now() > pending.expiresAt) {
      return null;
    }
    return pending;
  }

  verifyRegisterOtp(phone: string, code: string): void {
    const phoneE164 = this.normalizePhoneE164(phone);
    const stored = this.store.get(this.storeKey('register', phoneE164));
    if (!stored || Date.now() > stored.expiresAt) {
      throw new BadRequestException('OTP expired or not found. Request a new code.');
    }

    const digits = code.trim();
    if (!/^\d{6}$/.test(digits)) {
      throw new BadRequestException('Invalid OTP code');
    }

    const expected = Buffer.from(stored.hash, 'hex');
    const actual = Buffer.from(
      this.hashCode(phoneE164, Number.parseInt(digits, 10)),
      'hex',
    );
    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      throw new BadRequestException('Invalid OTP code');
    }

    this.store.delete(this.storeKey('register', phoneE164));
  }

  /** Send registration OTP via WhatsApp Node campaign. */
  async sendRegisterOtp(phone: string): Promise<{
    ok: true;
    expiresInSeconds: number;
  }> {
    const phoneE164 = this.normalizePhoneE164(phone);
    const code = this.generateCode();
    const ttl = this.ttlSeconds();

    this.store.set(this.storeKey('register', phoneE164), {
      hash: this.hashCode(phoneE164, code),
      expiresAt: Date.now() + ttl * 1000,
    });

    const sent = await this.whatsAppNode.sendOtpViaNodeCampaign(phoneE164, code);
    if (!sent.ok) {
      this.store.delete(this.storeKey('register', phoneE164));
      if (sent.error === 'node_not_configured') {
        throw new ServiceUnavailableException(
          'WhatsApp OTP sender is not configured',
        );
      }
      if (sent.error === 'balance_exhausted') {
        throw new HttpException(
          {
            message:
              'WhatsApp message balance is empty. Top up your account on the Node WhatsApp dashboard.',
            error: sent.error,
            step: sent.step,
            body: sent.body,
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
      throw new BadRequestException({
        message: 'Failed to send OTP',
        error: sent.error,
        step: sent.step,
        http: sent.http,
        body: sent.body,
        details: sent.details,
      });
    }

    return { ok: true, expiresInSeconds: ttl };
  }

  private normalizePhoneE164(phone: string): string {
    const trimmed = phone.trim();
    if (!trimmed) {
      throw new BadRequestException('Phone is required');
    }
    if (!trimmed.startsWith('+')) {
      throw new BadRequestException(
        'Phone must be in E.164 format (e.g. +96170123456)',
      );
    }
    return trimmed;
  }
}
