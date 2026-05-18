import { Module } from '@nestjs/common';
import { OtpService } from './otp.service';
import { WhatsAppNodeService } from './whatsapp-node.service';

@Module({
  providers: [OtpService, WhatsAppNodeService],
  exports: [OtpService],
})
export class OtpModule {}
