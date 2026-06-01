import { Module } from '@nestjs/common';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { CloudinaryService } from '../common/cloudinary.service';
import { OtpModule } from '../otp/otp.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { AuthMerchantController } from './auth-merchant.controller';
import { AuthSuperAdminController } from './auth-super-admin.controller';
import { AuthAppController } from './auth-app.controller';
import { AuthDriverController } from './auth-driver.controller';
import { AuthUserController } from './auth-user.controller';
import { AuthRefreshController } from './auth-refresh.controller';
import { FcmTokenController } from './fcm-token.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { MerchantJwtScopeGuard } from './merchant-jwt-scope.guard';
import { MerchantAccountGuard } from './merchant-account.guard';
import { SuperAdminGuard } from './super-admin.guard';
import { DriverAccountGuard } from './driver-account.guard';
import { UserAccountGuard } from './user-account.guard';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    NotificationsModule,
    OtpModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      signOptions: {
        expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ??
          '1h') as JwtSignOptions['expiresIn'],
      },
    }),
  ],
  controllers: [
    AuthSuperAdminController,
    AuthMerchantController,
    AuthAppController,
    AuthUserController,
    AuthDriverController,
    AuthRefreshController,
    FcmTokenController,
  ],
  providers: [
    AuthService,
    CloudinaryService,
    JwtStrategy,
    SuperAdminGuard,
    MerchantJwtScopeGuard,
    MerchantAccountGuard,
    UserAccountGuard,
    DriverAccountGuard,
  ],
  exports: [
    AuthService,
    SuperAdminGuard,
    MerchantJwtScopeGuard,
    MerchantAccountGuard,
    UserAccountGuard,
    DriverAccountGuard,
  ],
})
export class AuthModule {}
