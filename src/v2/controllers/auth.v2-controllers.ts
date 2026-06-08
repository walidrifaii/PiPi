import { AuthAppController } from '../../auth/auth-app.controller';
import { AuthDriverController } from '../../auth/auth-driver.controller';
import { AuthMerchantController } from '../../auth/auth-merchant.controller';
import { AuthRefreshController } from '../../auth/auth-refresh.controller';
import { AuthSuperAdminController } from '../../auth/auth-super-admin.controller';
import { AuthUserController } from '../../auth/auth-user.controller';
import { FcmTokenController } from '../../auth/fcm-token.controller';
import { createV2Controller } from './create-v2-controller';

export const AuthSuperAdminV2Controller = createV2Controller(
  AuthSuperAdminController,
  'auth',
);
export const AuthMerchantV2Controller = createV2Controller(
  AuthMerchantController,
  'auth',
);
export const AuthAppV2Controller = createV2Controller(AuthAppController, 'auth');
export const AuthUserV2Controller = createV2Controller(AuthUserController, 'auth');
export const AuthDriverV2Controller = createV2Controller(
  AuthDriverController,
  'auth',
);
export const AuthRefreshV2Controller = createV2Controller(
  AuthRefreshController,
  'auth',
);
export const FcmTokenV2Controller = createV2Controller(FcmTokenController);

export const AUTH_V2_CONTROLLERS = [
  AuthSuperAdminV2Controller,
  AuthMerchantV2Controller,
  AuthAppV2Controller,
  AuthUserV2Controller,
  AuthDriverV2Controller,
  AuthRefreshV2Controller,
  FcmTokenV2Controller,
];
