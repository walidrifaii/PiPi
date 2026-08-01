import { AuthAppController } from '../../auth/auth-app.controller';
import { AuthDriverController } from '../../auth/auth-driver.controller';
import { AuthMerchantController } from '../../auth/auth-merchant.controller';
import { AuthRefreshController } from '../../auth/auth-refresh.controller';
import { AuthSuperAdminController } from '../../auth/auth-super-admin.controller';
import { AuthUserController } from '../../auth/auth-user.controller';
import { FcmTokenController } from '../../auth/fcm-token.controller';
import { createV3Controller } from './create-v3-controller';

export const AuthSuperAdminV3Controller = createV3Controller(
  AuthSuperAdminController,
  'auth',
);
export const AuthMerchantV3Controller = createV3Controller(
  AuthMerchantController,
  'auth',
);
export const AuthAppV3Controller = createV3Controller(AuthAppController, 'auth');
export const AuthUserV3Controller = createV3Controller(AuthUserController, 'auth');
export const AuthDriverV3Controller = createV3Controller(
  AuthDriverController,
  'auth',
);
export const AuthRefreshV3Controller = createV3Controller(
  AuthRefreshController,
  'auth',
);
export const FcmTokenV3Controller = createV3Controller(FcmTokenController);

export const AUTH_V3_CONTROLLERS = [
  AuthSuperAdminV3Controller,
  AuthMerchantV3Controller,
  AuthAppV3Controller,
  AuthUserV3Controller,
  AuthDriverV3Controller,
  AuthRefreshV3Controller,
  FcmTokenV3Controller,
];
