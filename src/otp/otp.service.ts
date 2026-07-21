import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { toE164Phone } from '../common/phone-e164';
import { MessageCentralService } from './message-central.service';
import { WhatsAppNodeService } from './whatsapp-node.service';

type OtpProvider = 'message_central' | 'whatsapp_node';

type OtpPurpose =
  | 'register'
  | 'login'
  | 'driver_login'
  | 'driver_register'
  | 'app_login';

export type AppLoginAccountType = 'user' | 'driver';

interface PendingAppLogin {
  accountType: AppLoginAccountType;
  expiresAt: number;
}

interface StoredOtp {
  expiresAt: number;
  provider: OtpProvider | 'local';
  hash?: string;
  verificationId?: string;
}

export interface PendingUserRegistration {
  phoneVerified: boolean;
  expiresAt: number;
}

/** Test accounts — fixed OTP 123456, no WhatsApp send (login only). */
export const FIXED_LOGIN_OTP_CODE = 123456;
export const FIXED_USER_LOGIN_OTP_PHONE = '+96170657961';
export const FIXED_DRIVER_LOGIN_OTP_PHONE = '+96170311615';

const FIXED_LOGIN_OTP_PHONES = new Set([
  FIXED_USER_LOGIN_OTP_PHONE,
  FIXED_DRIVER_LOGIN_OTP_PHONE,
]);

const LOGIN_OTP_PURPOSES = new Set<OtpPurpose>([
  'login',
  'driver_login',
  'app_login',
]);

@Injectable()
export class OtpService {
  /** In-process store keyed by purpose:phone (sufficient until verify step uses Redis). */
  private readonly store = new Map<string, StoredOtp>();
  private readonly pendingRegister = new Map<string, PendingUserRegistration>();
  private readonly pendingDriverRegister = new Map<
    string,
    PendingUserRegistration
  >();
  private readonly pendingAppLogin = new Map<string, PendingAppLogin>();

  constructor(
    private readonly whatsAppNode: WhatsAppNodeService,
    private readonly messageCentral: MessageCentralService,
  ) {}

  private otpProvider(): OtpProvider {
    const raw = (process.env.OTP_PROVIDER ?? 'message_central').trim().toLowerCase();
    if (raw === 'whatsapp_node' || raw === 'node') {
      return 'whatsapp_node';
    }
    return 'message_central';
  }

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

  private generateCode(phoneE164: string, purpose: OtpPurpose): number {
    if (this.hasFixedLoginOtp(phoneE164, purpose)) {
      return FIXED_LOGIN_OTP_CODE;
    }
    return randomInt(100_000, 1_000_000);
  }

  private hasFixedLoginOtp(phoneE164: string, purpose: OtpPurpose): boolean {
    return (
      FIXED_LOGIN_OTP_PHONES.has(phoneE164) && LOGIN_OTP_PURPOSES.has(purpose)
    );
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

  setPendingDriverRegistration(phone: string): string {
    const phoneE164 = this.normalizePhoneE164(phone);
    const expiresAt = Date.now() + this.ttlSeconds() * 1000;
    this.pendingDriverRegister.set(phoneE164, {
      phoneVerified: false,
      expiresAt,
    });
    return phoneE164;
  }

  markPhoneVerifiedForDriverRegistration(phone: string): void {
    const phoneE164 = this.normalizePhoneE164(phone);
    const pending = this.pendingDriverRegister.get(phoneE164);
    if (!pending || Date.now() > pending.expiresAt) {
      throw new BadRequestException(
        'Registration session expired. Submit POST /auth/driver/register again.',
      );
    }
    this.pendingDriverRegister.set(phoneE164, {
      ...pending,
      phoneVerified: true,
      expiresAt: Date.now() + this.ttlSeconds() * 1000,
    });
  }

  isPhoneVerifiedForDriverRegistration(phone: string): boolean {
    const phoneE164 = this.normalizePhoneE164(phone);
    const pending = this.pendingDriverRegister.get(phoneE164);
    if (!pending || Date.now() > pending.expiresAt) {
      this.pendingDriverRegister.delete(phoneE164);
      return false;
    }
    return pending.phoneVerified;
  }

  hasPendingDriverRegistration(phone: string): boolean {
    const phoneE164 = this.normalizePhoneE164(phone);
    const pending = this.pendingDriverRegister.get(phoneE164);
    if (!pending) {
      return false;
    }
    if (Date.now() > pending.expiresAt) {
      this.pendingDriverRegister.delete(phoneE164);
      return false;
    }
    return true;
  }

  consumePendingDriverRegistration(
    phone: string,
  ): PendingUserRegistration | null {
    const phoneE164 = this.normalizePhoneE164(phone);
    const pending = this.pendingDriverRegister.get(phoneE164);
    this.pendingDriverRegister.delete(phoneE164);
    if (!pending || Date.now() > pending.expiresAt) {
      return null;
    }
    return pending;
  }

  async verifyRegisterOtp(phone: string, code: string): Promise<void> {
    await this.verifyOtp('register', phone, code);
  }

  async verifyDriverRegisterOtp(phone: string, code: string): Promise<void> {
    await this.verifyOtp('driver_register', phone, code);
  }

  async verifyLoginOtp(phone: string, code: string): Promise<void> {
    await this.verifyOtp('login', phone, code);
  }

  async verifyDriverLoginOtp(phone: string, code: string): Promise<void> {
    await this.verifyOtp('driver_login', phone, code);
  }

  async verifyAppLoginOtp(phone: string, code: string): Promise<void> {
    await this.verifyOtp('app_login', phone, code);
  }

  setPendingAppLogin(phone: string, accountType: AppLoginAccountType): string {
    const phoneE164 = this.normalizePhoneE164(phone);
    const expiresAt = Date.now() + this.ttlSeconds() * 1000;
    this.pendingAppLogin.set(phoneE164, { accountType, expiresAt });
    return phoneE164;
  }

  consumePendingAppLogin(phone: string): PendingAppLogin | null {
    const phoneE164 = this.normalizePhoneE164(phone);
    const pending = this.pendingAppLogin.get(phoneE164);
    this.pendingAppLogin.delete(phoneE164);
    if (!pending || Date.now() > pending.expiresAt) {
      return null;
    }
    return pending;
  }

  hasPendingAppLogin(phone: string): boolean {
    const phoneE164 = this.normalizePhoneE164(phone);
    const pending = this.pendingAppLogin.get(phoneE164);
    if (!pending) {
      return false;
    }
    if (Date.now() > pending.expiresAt) {
      this.pendingAppLogin.delete(phoneE164);
      return false;
    }
    return true;
  }

  private async verifyOtp(
    purpose: OtpPurpose,
    phone: string,
    code: string,
  ): Promise<void> {
    const phoneE164 = this.normalizePhoneE164(phone);
    const digits = code.trim();
    if (!/^\d{4,8}$/.test(digits)) {
      throw new BadRequestException('Invalid OTP code');
    }

    if (
      this.hasFixedLoginOtp(phoneE164, purpose) &&
      Number.parseInt(digits, 10) === FIXED_LOGIN_OTP_CODE
    ) {
      this.store.delete(this.storeKey(purpose, phoneE164));
      return;
    }

    const stored = this.store.get(this.storeKey(purpose, phoneE164));
    if (!stored || Date.now() > stored.expiresAt) {
      throw new BadRequestException('OTP expired or not found. Request a new code.');
    }

    if (stored.provider === 'message_central') {
      if (!stored.verificationId) {
        throw new BadRequestException('OTP expired or not found. Request a new code.');
      }
      const validated = await this.messageCentral.validateOtp(
        stored.verificationId,
        digits,
      );
      if (!validated.ok) {
        if (validated.error === 'expired') {
          throw new BadRequestException('OTP expired or not found. Request a new code.');
        }
        throw new BadRequestException('Invalid OTP code');
      }
      this.store.delete(this.storeKey(purpose, phoneE164));
      return;
    }

    if (!stored.hash) {
      throw new BadRequestException('OTP expired or not found. Request a new code.');
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

    this.store.delete(this.storeKey(purpose, phoneE164));
  }

  /** Send registration OTP via WhatsApp Node campaign. */
  async sendRegisterOtp(phone: string): Promise<{
    ok: true;
    expiresInSeconds: number;
  }> {
    return this.sendOtp('register', phone);
  }

  /** Send login OTP via WhatsApp Node campaign. */
  async sendLoginOtp(phone: string): Promise<{
    ok: true;
    expiresInSeconds: number;
  }> {
    return this.sendOtp('login', phone);
  }

  /** Send driver login OTP via WhatsApp Node campaign. */
  async sendDriverLoginOtp(phone: string): Promise<{
    ok: true;
    expiresInSeconds: number;
  }> {
    return this.sendOtp('driver_login', phone);
  }

  /** Unified customer + driver login OTP via WhatsApp. */
  async sendAppLoginOtp(phone: string): Promise<{
    ok: true;
    expiresInSeconds: number;
  }> {
    return this.sendOtp('app_login', phone);
  }

  /** Send driver registration OTP via WhatsApp Node campaign. */
  async sendDriverRegisterOtp(phone: string): Promise<{
    ok: true;
    expiresInSeconds: number;
  }> {
    return this.sendOtp('driver_register', phone);
  }

  private async sendOtp(
    purpose: OtpPurpose,
    phone: string,
  ): Promise<{
    ok: true;
    expiresInSeconds: number;
  }> {
    const phoneE164 = this.normalizePhoneE164(phone);
    const ttl = this.ttlSeconds();

    if (this.hasFixedLoginOtp(phoneE164, purpose)) {
      return { ok: true, expiresInSeconds: ttl };
    }

    if (this.otpProvider() === 'message_central' && this.messageCentral.isConfigured()) {
      return this.sendViaMessageCentral(purpose, phoneE164, ttl);
    }

    return this.sendViaWhatsAppNode(purpose, phoneE164, ttl);
  }

  private async sendViaMessageCentral(
    purpose: OtpPurpose,
    phoneE164: string,
    _ttl: number,
  ): Promise<{ ok: true; expiresInSeconds: number }> {
    const sent = await this.messageCentral.sendWhatsAppOtp(phoneE164);
    if (!sent.ok) {
      if (sent.error === 'message_central_not_configured') {
        throw new ServiceUnavailableException(
          'Message Central OTP is not configured',
        );
      }
      if (sent.error === 'insufficient_credits') {
        throw new HttpException(
          {
            message:
              'Message Central OTP balance is empty. Add credits in the Message Central dashboard.',
            error: sent.error,
            body: sent.body,
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
      if (sent.error === 'whatsapp_platform_discontinued') {
        throw new BadRequestException({
          message:
            'Message Central WhatsApp OTP (old API) is discontinued for this account. Enable the new WhatsApp platform in Message Central, or set MESSAGE_CENTRAL_FLOW_TYPE=SMS and add credits.',
          error: sent.error,
          body: sent.body,
        });
      }
      throw new BadRequestException({
        message: 'Failed to send OTP via Message Central',
        error: sent.error,
        http: sent.http,
        body: sent.body,
      });
    }

    this.store.set(this.storeKey(purpose, phoneE164), {
      provider: 'message_central',
      verificationId: sent.verificationId,
      expiresAt: Date.now() + sent.expiresInSeconds * 1000,
    });

    return { ok: true, expiresInSeconds: sent.expiresInSeconds };
  }

  private async sendViaWhatsAppNode(
    purpose: OtpPurpose,
    phoneE164: string,
    ttl: number,
  ): Promise<{ ok: true; expiresInSeconds: number }> {
    const code = this.generateCode(phoneE164, purpose);

    this.store.set(this.storeKey(purpose, phoneE164), {
      provider: 'local',
      hash: this.hashCode(phoneE164, code),
      expiresAt: Date.now() + ttl * 1000,
    });

    const sent = await this.whatsAppNode.sendOtpViaNodeCampaign(phoneE164, code);
    if (!sent.ok) {
      this.store.delete(this.storeKey(purpose, phoneE164));
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
    try {
      return toE164Phone(phone);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Phone must be in E.164 format';
      throw new BadRequestException(message);
    }
  }
}
