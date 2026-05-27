import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DriverAccountGuard } from '../auth/driver-account.guard';
import type { JwtUserPayload } from '../auth/jwt-user.payload';
import { UpdateTrackingLocationDto } from './dto/update-tracking-location.dto';
import { TrackingService } from './tracking.service';

@ApiTags('Tracking')
@Controller()
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @ApiOperation({
    summary:
      'Firebase custom token for Realtime Database (call after login; enables live tracking reads/writes)',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('auth/me/firebase-token')
  firebaseToken(@Req() req: { user: JwtUserPayload }) {
    return this.tracking.issueFirebaseCustomToken(req.user);
  }

  @ApiTags('Delivery')
  @ApiOperation({
    summary:
      'Start live tracking for an order (assigns driverId, writes RTDB meta for security rules)',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, DriverAccountGuard)
  @ApiParam({ name: 'orderId', type: String })
  @Post('drivers/me/orders/:orderId/tracking/start')
  startTracking(
    @Req() req: { user: JwtUserPayload },
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.tracking.startDriverTracking(req.user.sub, orderId);
  }

  @ApiTags('Delivery')
  @ApiOperation({ summary: 'Stop live tracking for an order' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, DriverAccountGuard)
  @ApiParam({ name: 'orderId', type: String })
  @Post('drivers/me/orders/:orderId/tracking/stop')
  stopTracking(
    @Req() req: { user: JwtUserPayload },
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.tracking.stopDriverTracking(req.user.sub, orderId);
  }

  @ApiTags('Delivery')
  @ApiOperation({
    summary:
      'Update driver GPS (HTTP fallback; prefer direct Realtime Database writes from the app for performance)',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, DriverAccountGuard)
  @ApiParam({ name: 'orderId', type: String })
  @Post('drivers/me/orders/:orderId/tracking/location')
  updateLocation(
    @Req() req: { user: JwtUserPayload },
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: UpdateTrackingLocationDto,
  ) {
    return this.tracking.updateDriverLocation(req.user.sub, orderId, dto);
  }
}
