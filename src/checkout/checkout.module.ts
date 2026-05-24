import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { NotificationsService } from '../notifications/notifications.service';
import { OrderNotificationsPort } from '../notifications/notifications.port';
import { PrismaModule } from '../prisma/prisma.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { UserAddressController } from './user-address.controller';
import { UserAddressService } from './user-address.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [CheckoutController, UserAddressController],
  providers: [
    CheckoutService,
    UserAddressService,
    {
      provide: OrderNotificationsPort,
      useExisting: NotificationsService,
    },
  ],
})
export class CheckoutModule {}
