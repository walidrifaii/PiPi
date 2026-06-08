import { AppController } from '../../app.controller';
import { MerchantCatalogController } from '../../merchant-catalog/merchant-catalog.controller';
import { MerchantCatalogSuperAdminController } from '../../merchant-catalog/merchant-catalog-super-admin.controller';
import { MerchantController } from '../../merchant.controller';
import { MerchantOfferAdminController } from '../../merchant-offer/merchant-offer-admin.controller';
import { MerchantOfferPublicController } from '../../merchant-offer/merchant-offer-public.controller';
import { createV2Controller } from './create-v2-controller';

export const AppV2Controller = createV2Controller(AppController);
export const MerchantCatalogV2Controller = createV2Controller(
  MerchantCatalogController,
  'merchants/me',
);
export const MerchantOfferAdminV2Controller = createV2Controller(
  MerchantOfferAdminController,
  'merchants/admin/offers',
);
export const MerchantOfferPublicV2Controller = createV2Controller(
  MerchantOfferPublicController,
  'merchants',
);
export const MerchantV2Controller = createV2Controller(
  MerchantController,
  'merchants',
);
export const MerchantCatalogSuperAdminV2Controller = createV2Controller(
  MerchantCatalogSuperAdminController,
  'merchants/admin',
);

/** Same order as AppModule v1 (specific routes before `:merchantId`). */
export const APP_V2_CONTROLLERS = [
  AppV2Controller,
  MerchantCatalogV2Controller,
  MerchantOfferAdminV2Controller,
  MerchantOfferPublicV2Controller,
  MerchantV2Controller,
  MerchantCatalogSuperAdminV2Controller,
];
