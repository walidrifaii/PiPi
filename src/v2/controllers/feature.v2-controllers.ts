import { SuperAdminPlatformController } from '../../admin/super-admin-platform.controller';
import { BannerAdminController } from '../../banner/banner-admin.controller';
import { BannerController } from '../../banner/banner.controller';
import { CheckoutV2Controller } from './checkout.v2-controller';
import { UserAddressController } from '../../checkout/user-address.controller';
import { DeliveryFeeAdminController } from '../../delivery-fee/delivery-fee-admin.controller';
import { DriversController } from '../../drivers/drivers.controller';
import { MerchantDeliveryTimeController } from '../../merchant-delivery-time/merchant-delivery-time.controller';
import { MerchantOfferMerchantController } from '../../merchant-offer/merchant-offer-merchant.controller';
import { BundleMerchantController } from '../../bundle/bundle-merchant.controller';
import { BundleMerchantPublicController } from '../../bundle/bundle-public.controller';
import { MerchantTypeController } from '../../merchant-type/merchant-type.controller';
import { NotificationBroadcastAdminController } from '../../notifications/notification-broadcast-admin.controller';
import { NotificationsController } from '../../notifications/notifications.controller';
import { UserNotificationsController } from '../../notifications/user-notifications.controller';
import { AdminDriverEarningsController } from '../../orders/admin-driver-earnings.controller';
import { AdminMerchantEarningsController } from '../../orders/admin-merchant-earnings.controller';
import { AdminOrdersController } from '../../orders/admin-orders.controller';
import { DriverEarningsController } from '../../orders/driver-earnings.controller';
import { DriverOrdersController } from '../../orders/driver-orders.controller';
import { MerchantEarningsController } from '../../orders/merchant-earnings.controller';
import { MerchantOrdersController } from '../../orders/merchant-orders.controller';
import { UserOrdersController } from '../../orders/user-orders.controller';
import { PlatformSettingsAdminController } from '../../platform-settings/platform-settings-admin.controller';
import { ServiceAreaController } from '../../service-area/service-area.controller';
import { TrackingController } from '../../tracking/tracking.controller';
import { UsersController } from '../../users/users.controller';
import { createV2Controller } from './create-v2-controller';

export const UsersV2Controller = createV2Controller(UsersController, 'users');
export const DriversV2Controller = createV2Controller(DriversController, 'drivers');
export const SuperAdminPlatformV2Controller = createV2Controller(
  SuperAdminPlatformController,
  'admin',
);
export const BannerV2Controller = createV2Controller(BannerController, 'banners');
export const BannerAdminV2Controller = createV2Controller(
  BannerAdminController,
  'banners/admin',
);
export { CheckoutV2Controller };
export const UserAddressV2Controller = createV2Controller(
  UserAddressController,
  'users/me/addresses',
);
export const UserOrdersV2Controller = createV2Controller(
  UserOrdersController,
  'orders/me',
);
export const MerchantOrdersV2Controller = createV2Controller(
  MerchantOrdersController,
  'merchants/me/orders',
);
export const AdminOrdersV2Controller = createV2Controller(
  AdminOrdersController,
  'admin/orders',
);
export const DriverOrdersV2Controller = createV2Controller(
  DriverOrdersController,
  'drivers/me/orders',
);
export const DriverEarningsV2Controller = createV2Controller(
  DriverEarningsController,
  'drivers/me/earnings',
);
export const MerchantEarningsV2Controller = createV2Controller(
  MerchantEarningsController,
  'merchants/me/earnings',
);
export const AdminDriverEarningsV2Controller = createV2Controller(
  AdminDriverEarningsController,
  'admin/drivers',
);
export const AdminMerchantEarningsV2Controller = createV2Controller(
  AdminMerchantEarningsController,
  'admin/merchants',
);
export const MerchantDeliveryTimeV2Controller = createV2Controller(
  MerchantDeliveryTimeController,
  'merchants/me/delivery-time',
);
export const NotificationsV2Controller = createV2Controller(
  NotificationsController,
  'notifications',
);
export const UserNotificationsV2Controller = createV2Controller(
  UserNotificationsController,
  'notifications/me',
);
export const NotificationBroadcastAdminV2Controller = createV2Controller(
  NotificationBroadcastAdminController,
  'admin/notifications/broadcasts',
);
export const TrackingV2Controller = createV2Controller(TrackingController);
export const PlatformSettingsAdminV2Controller = createV2Controller(
  PlatformSettingsAdminController,
  'admin/settings',
);
export const DeliveryFeeAdminV2Controller = createV2Controller(
  DeliveryFeeAdminController,
  'admin/delivery-fees',
);
export const ServiceAreaV2Controller = createV2Controller(
  ServiceAreaController,
  'service-areas',
);
export const MerchantTypeV2Controller = createV2Controller(
  MerchantTypeController,
  'merchant-types',
);
export const MerchantOfferMerchantV2Controller = createV2Controller(
  MerchantOfferMerchantController,
  'merchants/me/offers',
);
export const BundleMerchantV2Controller = createV2Controller(
  BundleMerchantController,
  'merchants/me/bundles',
);
export const BundleMerchantPublicV2Controller = createV2Controller(
  BundleMerchantPublicController,
  'merchants',
);
