import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginMerchantDto } from './dto/login-merchant.dto';
import { LoginSuperAdminDto } from './dto/login-super-admin.dto';
import { LoginDriverDto } from './dto/login-driver.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { RegisterMerchantDto } from './dto/register-merchant.dto';
import { RegisterSuperAdminDto } from './dto/register-super-admin.dto';
import { CompleteRegisterDriverDto } from './dto/complete-register-driver.dto';
import { CompleteRegisterUserDto } from './dto/complete-register-user.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { SendRegisterOtpDto } from './dto/send-register-otp.dto';
import { SendLoginOtpDto } from './dto/send-login-otp.dto';
import { VerifyRegisterOtpDto } from './dto/verify-register-otp.dto';
import { VerifyLoginOtpDto } from './dto/verify-login-otp.dto';
import { JwtUserPayload } from './jwt-user.payload';
import { OtpService } from '../otp/otp.service';
import { UsersService } from '../users/users.service';
import { loginEligibleUserFilter } from '../users/user-account-deletion';
import { assertPhoneAvailableAcrossUserAndDriver } from '../common/phone-account-uniqueness';
import { UserNotificationsService } from '../notifications/user-notifications.service';
import { normalizeFcmToken } from './fcm-token.util';
import {
  DRIVER_ACCOUNT_ROLE,
  MERCHANT_ACCOUNT_ROLE,
  SUPER_ADMIN_ACCOUNT_ROLE,
  USER_ACCOUNT_ROLE,
} from './account-roles';

export {
  DRIVER_ACCOUNT_ROLE,
  MERCHANT_ACCOUNT_ROLE,
  SUPER_ADMIN_ACCOUNT_ROLE,
  USER_ACCOUNT_ROLE,
} from './account-roles';

@Injectable()
export class AuthService {
  private readonly jwtSecret = process.env.JWT_SECRET ?? 'dev-secret-change-me';
  private readonly jwtAccessExpiresIn =
    process.env.JWT_ACCESS_EXPIRES_IN ?? '1h';
  private readonly jwtRefreshExpiresIn =
    process.env.JWT_REFRESH_EXPIRES_IN ?? '30d';

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly otpService: OtpService,
    private readonly usersService: UsersService,
    private readonly userNotifications: UserNotificationsService,
  ) {}

  private async signAccessToken(payload: JwtUserPayload): Promise<string> {
    return this.jwtService.signAsync(
      { ...payload, typ: 'access' as const },
      {
        secret: this.jwtSecret,
        expiresIn: this.jwtAccessExpiresIn as JwtSignOptions['expiresIn'],
      },
    );
  }

  private async signRefreshToken(
    args:
      | { sub: string; role: 'SUPER_ADMIN' | 'USER' | 'DRIVER' }
      | { sub: string; role: 'MERCHANT'; merchantId: string },
  ): Promise<string> {
    const body =
      args.role === 'MERCHANT'
        ? {
            sub: args.sub,
            role: args.role,
            typ: 'refresh' as const,
            merchantId: args.merchantId,
          }
        : {
            sub: args.sub,
            role: args.role,
            typ: 'refresh' as const,
          };
    return this.jwtService.signAsync(body, {
      secret: this.jwtSecret,
      expiresIn: this.jwtRefreshExpiresIn as JwtSignOptions['expiresIn'],
    });
  }

  private async issueTokenPair(
    accessPayload: JwtUserPayload,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const refreshArgs =
      accessPayload.role === 'MERCHANT'
        ? {
            sub: accessPayload.sub,
            role: accessPayload.role,
            merchantId: accessPayload.merchantId,
          }
        : {
            sub: accessPayload.sub,
            role: accessPayload.role,
          };

    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(accessPayload),
      this.signRefreshToken(refreshArgs),
    ]);
    return { accessToken, refreshToken };
  }

  /**
   * Exchange a valid refresh JWT for a new access + refresh pair.
   * Rejects access tokens and inactive or missing accounts.
   */
  async refreshTokens(refreshToken: string) {
    let decoded: unknown;
    try {
      decoded = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.jwtSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (!decoded || typeof decoded !== 'object') {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const p = decoded as Record<string, unknown>;
    if (p.typ !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const sub = p.sub;
    const role = p.role;
    if (typeof sub !== 'string' || typeof role !== 'string') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (role === 'SUPER_ADMIN') {
      const admin = await this.prisma.superAdmin.findFirst({
        where: { id: sub, isActive: true },
        select: { id: true, email: true },
      });
      if (!admin) {
        throw new UnauthorizedException('Account not found or inactive');
      }
      return this.issueTokenPair({
        sub: admin.id,
        email: admin.email,
        role: 'SUPER_ADMIN',
      });
    }

    if (role === 'MERCHANT') {
      const merchantId = p.merchantId;
      if (typeof merchantId !== 'string' || merchantId !== sub) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      const merchant = await this.prisma.merchant.findFirst({
        where: { id: sub, isActive: true },
        select: { id: true, email: true },
      });
      if (!merchant?.email) {
        throw new UnauthorizedException('Account not found or inactive');
      }
      return this.issueTokenPair({
        sub: merchant.id,
        email: merchant.email,
        role: 'MERCHANT',
        merchantId: merchant.id,
      });
    }

    if (role === 'USER') {
      const user = await this.prisma.user.findFirst({
        where: { id: sub, isActive: true },
        select: { id: true, email: true, phone: true },
      });
      if (!user) {
        throw new UnauthorizedException('Account not found or inactive');
      }
      return this.issueTokenPair({
        sub: user.id,
        email: user.email ?? user.phone,
        role: 'USER',
      });
    }

    if (role === 'DRIVER') {
      const driver = await this.prisma.driver.findFirst({
        where: { id: sub, isActive: true },
        select: { id: true, email: true, phone: true },
      });
      if (!driver) {
        throw new UnauthorizedException('Account not found or inactive');
      }
      return this.issueTokenPair({
        sub: driver.id,
        email: driver.email ?? driver.phone,
        role: 'DRIVER',
      });
    }

    throw new UnauthorizedException('Invalid refresh token');
  }

  async registerSuperAdmin(dto: RegisterSuperAdminDto) {
    const platformAdminCount = await this.prisma.superAdmin.count();
    if (platformAdminCount > 0) {
      throw new ForbiddenException(
        'A platform administrator already exists. Sign in or add staff through the admin console.',
      );
    }

    const existing = await this.prisma.superAdmin.findFirst({
      where: {
        OR: [{ email: dto.email }, { phone: dto.phone }],
      },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException(
        'Super admin with email or phone already exists',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const admin = await this.prisma.superAdmin.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
      },
    });

    const { accessToken, refreshToken } = await this.issueTokenPair({
      sub: admin.id,
      email: admin.email,
      role: 'SUPER_ADMIN',
    });

    return {
      ...admin,
      role: SUPER_ADMIN_ACCOUNT_ROLE,
      accessToken,
      refreshToken,
    };
  }

  async loginSuperAdmin(dto: LoginSuperAdminDto) {
    const admin = await this.prisma.superAdmin.findFirst({
      where: {
        OR: [{ email: dto.identifier }, { phone: dto.identifier }],
        isActive: true,
      },
    });

    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const fcmToken = normalizeFcmToken(dto.fcmToken);
    if (fcmToken) {
      await this.prisma.superAdmin.update({
        where: { id: admin.id },
        data: { fcmToken },
      });
    }

    const { accessToken, refreshToken } = await this.issueTokenPair({
      sub: admin.id,
      email: admin.email,
      role: 'SUPER_ADMIN',
    });

    return {
      accessToken,
      refreshToken,
      admin: {
        id: admin.id,
        fullName: admin.fullName,
        email: admin.email,
        phone: admin.phone,
        role: SUPER_ADMIN_ACCOUNT_ROLE,
      },
    };
  }

  async registerMerchant(
    dto: RegisterMerchantDto,
    logoUrl: string,
    coverImageUrl: string,
  ) {
    const existing = await this.prisma.merchant.findFirst({
      where: {
        OR: [{ email: dto.email }, { phone: dto.phone }],
      },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException(
        'A merchant with this email or phone already exists',
      );
    }

    const merchantTypeId = await this.resolveMerchantTypeIdForRegister(dto);

    const cityCodeRaw: unknown = dto.cityCode;
    let cityCodePersist: string | undefined;
    if (typeof cityCodeRaw === 'string' && cityCodeRaw.trim().length > 0) {
      cityCodePersist = cityCodeRaw.trim().toUpperCase();
    }

    const latVal: unknown = dto.latitude;
    const lngVal: unknown = dto.longitude;
    const latOk = typeof latVal === 'number' && Number.isFinite(latVal);
    const lngOk = typeof lngVal === 'number' && Number.isFinite(lngVal);
    if (latOk !== lngOk) {
      throw new BadRequestException(
        'latitude and longitude must both be provided together',
      );
    }
    const coords: { latitude: number; longitude: number } | undefined =
      latOk && lngOk ? { latitude: latVal, longitude: lngVal } : undefined;

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const merchant = await this.prisma.merchant.create({
      data: {
        name: dto.merchantName,
        merchantTypeId,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        imageUrl: logoUrl,
        coverImageUrl,
        isActive: true,
        ...(cityCodePersist !== undefined ? { cityCode: cityCodePersist } : {}),
        ...(coords !== undefined ? coords : {}),
      },
      select: {
        id: true,
        name: true,
        merchantTypeId: true,
        merchantType: { select: { code: true } },
        email: true,
        phone: true,
        imageUrl: true,
        coverImageUrl: true,
        cityCode: true,
        latitude: true,
        longitude: true,
      },
    });

    const m = merchant as {
      id: string;
      name: string;
      merchantTypeId: string;
      merchantType: { code: string };
      email: string | null;
      phone: string | null;
      imageUrl: string | null;
      coverImageUrl: string | null;
      cityCode: string | null;
      latitude: unknown;
      longitude: unknown;
    };

    const { accessToken, refreshToken } = await this.issueTokenPair({
      sub: m.id,
      email: m.email!,
      role: 'MERCHANT',
      merchantId: m.id,
    });

    return {
      accessToken,
      refreshToken,
      merchant: {
        id: m.id,
        name: m.name,
        merchantTypeId: m.merchantTypeId,
        merchantType: m.merchantType.code,
        email: m.email,
        phone: m.phone,
        logoUrl: m.imageUrl,
        coverImageUrl: m.coverImageUrl,
        cityCode: m.cityCode,
        latitude:
          m.latitude !== null && m.latitude !== undefined
            ? Number(m.latitude)
            : null,
        longitude:
          m.longitude !== null && m.longitude !== undefined
            ? Number(m.longitude)
            : null,
        role: MERCHANT_ACCOUNT_ROLE,
      },
    };
  }

  /**
   * Resolves merchant_types row for registration. Prefers merchantTypeCode when set
   * so clients are not tied to UUIDs from another environment.
   */
  private async resolveMerchantTypeIdForRegister(
    dto: RegisterMerchantDto,
  ): Promise<string> {
    const rawCode = dto.merchantTypeCode;
    const code = typeof rawCode === 'string' ? rawCode.trim() : '';
    if (code.length > 0) {
      const byCode = await this.prisma.merchantType.findFirst({
        where: { code: code.toUpperCase(), isActive: true },
        select: { id: true },
      });
      if (!byCode) {
        throw new BadRequestException(
          `Unknown merchant type code "${code}". Call GET /merchant-types on this server for valid codes.`,
        );
      }
      return byCode.id;
    }

    const rawId = dto.merchantTypeId;
    const id = typeof rawId === 'string' ? rawId.trim() : '';
    if (!id) {
      throw new BadRequestException(
        'Provide merchantTypeId or merchantTypeCode (see GET /merchant-types).',
      );
    }

    const byId = await this.prisma.merchantType.findFirst({
      where: { id, isActive: true },
      select: { id: true },
    });
    if (!byId) {
      throw new BadRequestException(
        'Unknown or inactive merchantTypeId. Use GET /merchant-types on this server — ids must exist in merchant_types (apply prisma migrations if that table is empty).',
      );
    }
    return byId.id;
  }

  async loginMerchant(dto: LoginMerchantDto) {
    const merchant = await this.prisma.merchant.findFirst({
      where: {
        OR: [{ email: dto.identifier }, { phone: dto.identifier }],
        isActive: true,
        passwordHash: { not: null },
      },
      select: {
        id: true,
        name: true,
        merchantTypeId: true,
        merchantType: { select: { code: true } },
        email: true,
        phone: true,
        passwordHash: true,
        imageUrl: true,
        coverImageUrl: true,
      },
    });

    if (!merchant || !merchant.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(dto.password, merchant.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const fcmToken = normalizeFcmToken(dto.fcmToken);
    if (fcmToken) {
      await this.prisma.merchant.update({
        where: { id: merchant.id },
        data: { fcmToken },
      });
    }

    const { accessToken, refreshToken } = await this.issueTokenPair({
      sub: merchant.id,
      email: merchant.email!,
      role: 'MERCHANT',
      merchantId: merchant.id,
    });

    return {
      accessToken,
      refreshToken,
      merchant: {
        id: merchant.id,
        name: merchant.name,
        merchantTypeId: merchant.merchantTypeId,
        merchantType: merchant.merchantType.code,
        email: merchant.email,
        phone: merchant.phone,
        logoUrl: merchant.imageUrl,
        coverImageUrl: merchant.coverImageUrl,
        role: MERCHANT_ACCOUNT_ROLE,
      },
    };
  }

  async resendRegisterOtp(dto: SendRegisterOtpDto) {
    if (!this.otpService.hasPendingRegistration(dto.phone)) {
      throw new BadRequestException(
        'No pending registration for this phone. Call POST /auth/user/register first.',
      );
    }
    return this.otpService.sendRegisterOtp(dto.phone);
  }

  /** Step 1: phone only — stores pending session and sends OTP. */
  async registerUser(dto: RegisterUserDto) {
    await this.assertUserRegistrationAvailable(dto.phone);
    this.otpService.setPendingRegistration(dto.phone);
    return this.otpService.sendRegisterOtp(dto.phone);
  }

  /** Step 2: verify OTP; phone must complete step 3 before account exists. */
  async verifyRegisterOtp(dto: VerifyRegisterOtpDto) {
    if (!this.otpService.hasPendingRegistration(dto.phone)) {
      throw new BadRequestException(
        'No pending registration for this phone. Call POST /auth/user/register first.',
      );
    }

    this.otpService.verifyRegisterOtp(dto.phone, dto.code);
    this.otpService.markPhoneVerifiedForRegistration(dto.phone);

    return {
      ok: true as const,
      phoneVerified: true,
      message: 'Phone verified. Complete registration with your profile details.',
    };
  }

  /** Step 3: profile details — creates user and returns JWT. */
  async completeRegisterUser(dto: CompleteRegisterUserDto) {
    if (!this.otpService.isPhoneVerifiedForRegistration(dto.phone)) {
      throw new BadRequestException(
        'Phone is not verified. Complete POST /auth/user/register and POST /auth/user/register/verify-otp first.',
      );
    }

    const pending = this.otpService.consumePendingRegistration(dto.phone);
    if (!pending?.phoneVerified) {
      throw new BadRequestException(
        'Registration session expired. Start again from POST /auth/user/register.',
      );
    }

    await this.assertUserRegistrationAvailable(dto.phone);

    const fcmToken = normalizeFcmToken(dto.fcmToken);

    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        dateOfBirth: new Date(`${dto.dateOfBirth}T00:00:00.000Z`),
        phone: dto.phone,
        ...(fcmToken ? { fcmToken } : {}),
      },
      select: {
        id: true,
        fullName: true,
        dateOfBirth: true,
        phone: true,
        email: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.userNotifications.createWelcome(user.id);

    const { accessToken, refreshToken } = await this.issueTokenPair({
      sub: user.id,
      email: user.email ?? user.phone,
      role: 'USER',
    });

    return {
      accessToken,
      refreshToken,
      user: {
        ...user,
        role: USER_ACCOUNT_ROLE,
      },
    };
  }

  private async assertUserRegistrationAvailable(phone: string): Promise<void> {
    await assertPhoneAvailableAcrossUserAndDriver(this.prisma, phone);
  }

  async resendRegisterDriverOtp(dto: SendRegisterOtpDto) {
    if (!this.otpService.hasPendingDriverRegistration(dto.phone)) {
      throw new BadRequestException(
        'No pending registration for this phone. Call POST /auth/driver/register first.',
      );
    }
    return this.otpService.sendDriverRegisterOtp(dto.phone);
  }

  /** Driver register step 1: phone only — pending session + OTP via WhatsApp. */
  async registerDriver(dto: RegisterUserDto) {
    await this.assertDriverRegistrationAvailable(dto.phone);
    this.otpService.setPendingDriverRegistration(dto.phone);
    return this.otpService.sendDriverRegisterOtp(dto.phone);
  }

  /** Driver register step 2: verify OTP (account not created yet). */
  async verifyRegisterDriverOtp(dto: VerifyRegisterOtpDto) {
    if (!this.otpService.hasPendingDriverRegistration(dto.phone)) {
      throw new BadRequestException(
        'No pending registration for this phone. Call POST /auth/driver/register first.',
      );
    }

    this.otpService.verifyDriverRegisterOtp(dto.phone, dto.code);
    this.otpService.markPhoneVerifiedForDriverRegistration(dto.phone);

    return {
      ok: true as const,
      phoneVerified: true,
      message:
        'Phone verified. Complete registration with your driver profile details.',
    };
  }

  /** Driver register step 3: profile — creates driver and returns JWT. */
  async completeRegisterDriver(dto: CompleteRegisterDriverDto) {
    if (!this.otpService.isPhoneVerifiedForDriverRegistration(dto.phone)) {
      throw new BadRequestException(
        'Phone is not verified. Complete POST /auth/driver/register and POST /auth/driver/register/verify-otp first.',
      );
    }

    const pending = this.otpService.consumePendingDriverRegistration(dto.phone);
    if (!pending?.phoneVerified) {
      throw new BadRequestException(
        'Registration session expired. Start again from POST /auth/driver/register.',
      );
    }

    await this.assertDriverRegistrationAvailable(dto.phone, dto.email);

    const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);

    const driver = await this.prisma.driver.create({
      data: {
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email,
        vehicleType: dto.vehicleType,
        passwordHash,
        status: 'offline',
        isActive: true,
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        vehicleType: true,
        status: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return this.buildDriverLoginResponse(driver);
  }

  private async assertDriverRegistrationAvailable(
    phone: string,
    email?: string,
  ): Promise<void> {
    await assertPhoneAvailableAcrossUserAndDriver(this.prisma, phone);

    if (email) {
      const existingEmail = await this.prisma.driver.findFirst({
        where: { email },
        select: { id: true },
      });
      if (existingEmail) {
        throw new BadRequestException(
          'A driver with this email already exists',
        );
      }
    }
  }

  /** Resolve customer vs driver for a phone (customer wins if both exist). */
  private async resolveLoginAccountByPhone(
    phone: string,
  ): Promise<'user' | 'driver' | null> {
    await this.usersService.purgeExpiredAccountDeletions();

    const [user, driver] = await Promise.all([
      this.prisma.user.findFirst({
        where: { phone, ...loginEligibleUserFilter() },
        select: { id: true },
      }),
      this.prisma.driver.findFirst({
        where: { phone, isActive: true },
        select: { id: true },
      }),
    ]);

    if (user) {
      return 'user';
    }
    if (driver) {
      return 'driver';
    }
    return null;
  }

  /** Step 1: send OTP — works for customer or driver (POST /auth/user/login). */
  async sendLoginOtp(dto: SendLoginOtpDto) {
    const accountType = await this.resolveLoginAccountByPhone(dto.phone);
    if (!accountType) {
      throw new UnauthorizedException('No account found for this phone');
    }

    this.otpService.setPendingAppLogin(dto.phone, accountType);
    return this.otpService.sendAppLoginOtp(dto.phone);
  }

  /** Step 2: verify OTP — returns user or driver based on account type. */
  async verifyLoginOtp(dto: VerifyLoginOtpDto) {
    const pending = this.otpService.consumePendingAppLogin(dto.phone);
    if (!pending) {
      throw new BadRequestException(
        'Login session expired or not found. Call POST /auth/user/login first.',
      );
    }

    this.otpService.verifyAppLoginOtp(dto.phone, dto.code);

    if (pending.accountType === 'driver') {
      const driver = await this.prisma.driver.findFirst({
        where: { phone: dto.phone, isActive: true },
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
          vehicleType: true,
          status: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (!driver) {
        throw new UnauthorizedException('No account found for this phone');
      }
      const fcmToken = normalizeFcmToken(dto.fcmToken);
      if (fcmToken) {
        await this.prisma.driver.update({
          where: { id: driver.id },
          data: { fcmToken },
        });
      }
      const tokens = await this.buildDriverLoginResponse(driver);
      return { accountType: 'driver' as const, ...tokens };
    }

    await this.usersService.purgeExpiredAccountDeletions();

    const appUser = await this.prisma.user.findFirst({
      where: { phone: dto.phone, ...loginEligibleUserFilter() },
      select: {
        id: true,
        fullName: true,
        dateOfBirth: true,
        phone: true,
        email: true,
        isActive: true,
        deletionRequestedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!appUser) {
      throw new UnauthorizedException('No account found for this phone');
    }

    if (appUser.deletionRequestedAt) {
      await this.usersService.cancelAccountDeletion(appUser.id);
      appUser.isActive = true;
    }

    const fcmToken = normalizeFcmToken(dto.fcmToken);
    if (fcmToken) {
      await this.prisma.user.update({
        where: { id: appUser.id },
        data: { fcmToken },
      });
    }

    const { accessToken, refreshToken } = await this.issueTokenPair({
      sub: appUser.id,
      email: appUser.email ?? appUser.phone,
      role: 'USER',
    });

    const { deletionRequestedAt: _removed, ...userPublic } = appUser;

    return {
      accountType: 'user' as const,
      accessToken,
      refreshToken,
      user: {
        ...userPublic,
        role: USER_ACCOUNT_ROLE,
      },
    };
  }

  async resendLoginOtp(dto: SendLoginOtpDto) {
    if (!this.otpService.hasPendingAppLogin(dto.phone)) {
      return this.sendLoginOtp(dto);
    }
    const accountType = await this.resolveLoginAccountByPhone(dto.phone);
    if (!accountType) {
      throw new UnauthorizedException('No account found for this phone');
    }
    this.otpService.setPendingAppLogin(dto.phone, accountType);
    return this.otpService.sendAppLoginOtp(dto.phone);
  }

  async loginUser(dto: LoginUserDto) {
    await this.usersService.purgeExpiredAccountDeletions();

    const appUser = await this.prisma.user.findFirst({
      where: {
        AND: [
          { OR: [{ email: dto.identifier }, { phone: dto.identifier }] },
          loginEligibleUserFilter(),
        ],
      },
    });

    if (!appUser) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!appUser.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(dto.password, appUser.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (appUser.deletionRequestedAt) {
      await this.usersService.cancelAccountDeletion(appUser.id);
      appUser.isActive = true;
    }

    const fcmToken = normalizeFcmToken(dto.fcmToken);
    if (fcmToken) {
      await this.prisma.user.update({
        where: { id: appUser.id },
        data: { fcmToken },
      });
    }

    const { accessToken, refreshToken } = await this.issueTokenPair({
      sub: appUser.id,
      email: appUser.email ?? appUser.phone,
      role: 'USER',
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: appUser.id,
        fullName: appUser.fullName,
        phone: appUser.phone,
        email: appUser.email,
        isActive: appUser.isActive,
        role: USER_ACCOUNT_ROLE,
      },
    };
  }

  async setMerchantFcmToken(merchantId: string, token?: string) {
    const fcmToken = normalizeFcmToken(token) ?? null;
    await this.prisma.merchant.update({
      where: { id: merchantId },
      data: { fcmToken },
    });
    return { ok: true as const };
  }

  async setSuperAdminFcmToken(adminId: string, token?: string) {
    const fcmToken = normalizeFcmToken(token) ?? null;
    await this.prisma.superAdmin.update({
      where: { id: adminId },
      data: { fcmToken },
    });
    return { ok: true as const };
  }

  async setDriverFcmToken(driverId: string, token?: string) {
    const fcmToken = normalizeFcmToken(token) ?? null;
    await this.prisma.driver.update({
      where: { id: driverId },
      data: { fcmToken },
    });
    return { ok: true as const };
  }

  async setUserFcmToken(userId: string, token?: string) {
    const fcmToken = normalizeFcmToken(token) ?? null;
    await this.prisma.user.update({
      where: { id: userId },
      data: { fcmToken },
    });
    return { ok: true as const };
  }

  /** Clears stored FCM token so pushes are not sent to this device after logout. */
  async logoutUser(userId: string) {
    await this.prisma.user.updateMany({
      where: { id: userId },
      data: { fcmToken: null },
    });
    return { ok: true as const, message: 'Logged out' };
  }

  async loginUserOrDriver(dto: LoginUserDto) {
    const identifierMatch = {
      OR: [{ email: dto.identifier }, { phone: dto.identifier }],
      isActive: true,
    };

    const [appUser, driver] = await Promise.all([
      this.prisma.user.findFirst({
        where: identifierMatch,
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          passwordHash: true,
        },
      }),
      this.prisma.driver.findFirst({
        where: identifierMatch,
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
          vehicleType: true,
          status: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          passwordHash: true,
        },
      }),
    ]);

    if (appUser?.passwordHash) {
      const ok = await bcrypt.compare(dto.password, appUser.passwordHash);
      if (ok) {
        const { accessToken, refreshToken } = await this.issueTokenPair({
          sub: appUser.id,
          email: appUser.email ?? appUser.phone,
          role: 'USER',
        });
        return {
          accountType: 'user' as const,
          accessToken,
          refreshToken,
          user: {
            id: appUser.id,
            fullName: appUser.fullName,
            phone: appUser.phone,
            email: appUser.email,
            isActive: appUser.isActive,
            createdAt: appUser.createdAt,
            updatedAt: appUser.updatedAt,
            role: USER_ACCOUNT_ROLE,
          },
        };
      }
    }

    if (driver) {
      const ok = await bcrypt.compare(dto.password, driver.passwordHash);
      if (ok) {
        const { accessToken, refreshToken } = await this.issueTokenPair({
          sub: driver.id,
          email: driver.email ?? driver.phone,
          role: 'DRIVER',
        });
        return {
          accountType: 'driver' as const,
          accessToken,
          refreshToken,
          driver: {
            id: driver.id,
            fullName: driver.fullName,
            phone: driver.phone,
            email: driver.email,
            vehicleType: driver.vehicleType,
            status: driver.status,
            isActive: driver.isActive,
            createdAt: driver.createdAt,
            updatedAt: driver.updatedAt,
            role: DRIVER_ACCOUNT_ROLE,
          },
        };
      }
    }

    throw new UnauthorizedException('Invalid credentials');
  }

  /** @deprecated Use POST /auth/user/login (same unified flow). */
  sendDriverLoginOtp(dto: SendLoginOtpDto) {
    return this.sendLoginOtp(dto);
  }

  /** @deprecated Use POST /auth/user/login/verify */
  verifyDriverLoginOtp(dto: VerifyLoginOtpDto) {
    return this.verifyLoginOtp(dto);
  }

  /** @deprecated Use POST /auth/user/login/resend */
  resendDriverLoginOtp(dto: SendLoginOtpDto) {
    return this.resendLoginOtp(dto);
  }

  async loginDriver(dto: LoginDriverDto) {
    const driver = await this.prisma.driver.findFirst({
      where: {
        OR: [{ email: dto.identifier }, { phone: dto.identifier }],
        isActive: true,
      },
    });

    if (!driver) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(dto.password, driver.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildDriverLoginResponse(driver);
  }

  private async buildDriverLoginResponse(driver: {
    id: string;
    fullName: string | null;
    phone: string;
    email: string | null;
    vehicleType: string | null;
    status: string | null;
    isActive: boolean;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    const { accessToken, refreshToken } = await this.issueTokenPair({
      sub: driver.id,
      email: driver.email ?? driver.phone,
      role: 'DRIVER',
    });

    return {
      accessToken,
      refreshToken,
      driver: {
        id: driver.id,
        fullName: driver.fullName,
        phone: driver.phone,
        email: driver.email,
        vehicleType: driver.vehicleType,
        status: driver.status,
        isActive: driver.isActive,
        ...(driver.createdAt ? { createdAt: driver.createdAt } : {}),
        ...(driver.updatedAt ? { updatedAt: driver.updatedAt } : {}),
        role: DRIVER_ACCOUNT_ROLE,
      },
    };
  }
}
