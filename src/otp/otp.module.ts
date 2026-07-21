import { Module } from '@nestjs/common';
import { MessageCentralService } from './message-central.service';
import { OtpService } from './otp.service';
import { WhatsAppNodeService } from './whatsapp-node.service';

@Module({
  providers: [OtpService, WhatsAppNodeService, MessageCentralService],
  exports: [OtpService],
})
export class OtpModule {}
