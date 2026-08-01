import { AppController } from '../../app.controller';
import { MerchantCatalogController } from '../../merchant-catalog/merchant-catalog.controller';
import { MerchantCatalogSuperAdminController } from '../../merchant-catalog/merchant-catalog-super-admin.controller';
import { MerchantOfferAdminController } from '../../merchant-offer/merchant-offer-admin.controller';
import { MerchantOfferPublicController } from '../../merchant-offer/merchant-offer-public.controller';
import { BundleAdminController } from '../../bundle/bundle-admin.controller';
import { BundleMerchantController } from '../../bundle/bundle-merchant.controller';
import {
  BundleMerchantPublicController,
  BundlePublicController,
} from '../../bundle/bundle-public.controller';
import { createV3Controller } from './create-v3-controller';
import { MerchantStorefrontV3Controller } from './merchant-storefront.v3-controller';

export const AppV3Controller = createV3Controller(AppController);
export const MerchantCatalogV3Controller = createV3Controller(
  MerchantCatalogController,
  'merchants/me',
);
export const MerchantOfferAdminV3Controller = createV3Controller(
  MerchantOfferAdminController,
  'merchants/admin/offers',
);
export const MerchantOfferPublicV3Controller = createV3Controller(
  MerchantOfferPublicController,
  'merchants',
);
export const BundleAdminV3Controller = createV3Controller(
  BundleAdminController,
  'merchants/admin/bundles',
);
export const BundleMerchantV3Controller = createV3Controller(
  BundleMerchantController,
  'merchants',
);
export const BundleMerchantPublicV3Controller = createV3Controller(
  BundleMerchantPublicController,
  'merchants',
);
export const BundlePublicV3Controller = createV3Controller(
  BundlePublicController,
  'bundles',
);
export const MerchantV3Controller = MerchantStorefrontV3Controller;
export const MerchantCatalogSuperAdminV3Controller = createV3Controller(
  MerchantCatalogSuperAdminController,
  'merchants/admin',
);

/** Same order as AppModule v1 (specific routes before `:merchantId`). */
export const APP_V3_CONTROLLERS = [
  AppV3Controller,
  MerchantCatalogV3Controller,
  MerchantOfferAdminV3Controller,
  BundleAdminV3Controller,
  MerchantOfferPublicV3Controller,
  BundleMerchantV3Controller,
  BundleMerchantPublicV3Controller,
  BundlePublicV3Controller,
  MerchantV3Controller,
  MerchantCatalogSuperAdminV3Controller,
];
