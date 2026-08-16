import { SuperAdminPlatformController } from '../../admin/super-admin-platform.controller';
import { BannerAdminController } from '../../banner/banner-admin.controller';
import { BannerController } from '../../banner/banner.controller';
import { DeliveryFeeAdminController } from '../../delivery-fee/delivery-fee-admin.controller';
import { DriversController } from '../../drivers/drivers.controller';
import { MerchantDeliveryTimeController } from '../../merchant-delivery-time/merchant-delivery-time.controller';
import { MerchantOfferMerchantController } from '../../merchant-offer/merchant-offer-merchant.controller';
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
import { AppVersionAdminController } from '../../app-version/app-version-admin.controller';
import { AppVersionController } from '../../app-version/app-version.controller';
import { CouponAdminController } from '../../coupon/coupon-admin.controller';
import { CouponPublicController } from '../../coupon/coupon-public.controller';
import { PickupAdminController } from '../../pickup/pickup-admin.controller';
import { PickupController } from '../../pickup/pickup.controller';
import { DriverPickupsController } from '../../pickup/driver-pickups.controller';
import { UserPickupsController } from '../../pickup/user-pickups.controller';
import { createV3Controller } from './create-v3-controller';

export const UsersV3Controller = createV3Controller(UsersController, 'users');
export const DriversV3Controller = createV3Controller(DriversController, 'drivers');
export const SuperAdminPlatformV3Controller = createV3Controller(
  SuperAdminPlatformController,
  'admin',
);
export const BannerV3Controller = createV3Controller(BannerController, 'banners');
export const BannerAdminV3Controller = createV3Controller(
  BannerAdminController,
  'banners/admin',
);
export const UserOrdersV3Controller = createV3Controller(
  UserOrdersController,
  'orders/me',
);
export const MerchantOrdersV3Controller = createV3Controller(
  MerchantOrdersController,
  'merchants/me/orders',
);
export const AdminOrdersV3Controller = createV3Controller(
  AdminOrdersController,
  'admin/orders',
);
export const DriverOrdersV3Controller = createV3Controller(
  DriverOrdersController,
  'drivers/me/orders',
);
export const DriverEarningsV3Controller = createV3Controller(
  DriverEarningsController,
  'drivers/me/earnings',
);
export const MerchantEarningsV3Controller = createV3Controller(
  MerchantEarningsController,
  'merchants/me/earnings',
);
export const AdminDriverEarningsV3Controller = createV3Controller(
  AdminDriverEarningsController,
  'admin/drivers',
);
export const AdminMerchantEarningsV3Controller = createV3Controller(
  AdminMerchantEarningsController,
  'admin/merchants',
);
export const MerchantDeliveryTimeV3Controller = createV3Controller(
  MerchantDeliveryTimeController,
  'merchants/me/delivery-time',
);
export const NotificationsV3Controller = createV3Controller(
  NotificationsController,
  'notifications',
);
export const UserNotificationsV3Controller = createV3Controller(
  UserNotificationsController,
  'notifications/me',
);
export const NotificationBroadcastAdminV3Controller = createV3Controller(
  NotificationBroadcastAdminController,
  'admin/notifications/broadcasts',
);
export const TrackingV3Controller = createV3Controller(TrackingController);
export const PlatformSettingsAdminV3Controller = createV3Controller(
  PlatformSettingsAdminController,
  'admin/settings',
);
export const DeliveryFeeAdminV3Controller = createV3Controller(
  DeliveryFeeAdminController,
  'admin/delivery-fees',
);
export const ServiceAreaV3Controller = createV3Controller(
  ServiceAreaController,
  'service-areas',
);
export const MerchantTypeV3Controller = createV3Controller(
  MerchantTypeController,
  'merchant-types',
);
export const MerchantOfferMerchantV3Controller = createV3Controller(
  MerchantOfferMerchantController,
  'merchants/me/offers',
);
export const CouponAdminV3Controller = createV3Controller(
  CouponAdminController,
  'admin/coupons',
);
export const CouponPublicV3Controller = createV3Controller(
  CouponPublicController,
  'coupons',
);
export const AppVersionV3Controller = createV3Controller(
  AppVersionController,
  'app-version',
);
export const AppVersionAdminV3Controller = createV3Controller(
  AppVersionAdminController,
  'admin/app-version',
);
export const PickupV3Controller = createV3Controller(PickupController, 'pickups');
export const UserPickupsV3Controller = createV3Controller(
  UserPickupsController,
  'pickups/me',
);
export const DriverPickupsV3Controller = createV3Controller(
  DriverPickupsController,
  'drivers/me/pickups',
);
export const PickupAdminV3Controller = createV3Controller(
  PickupAdminController,
  'admin/pickups',
);
