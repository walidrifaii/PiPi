import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { UserAddressController } from './user-address.controller';
import { UserAddressService } from './user-address.service';

@Module({
  imports: [PrismaModule],
  controllers: [CheckoutController, UserAddressController],
  providers: [CheckoutService, UserAddressService],
})
export class CheckoutModule {}
