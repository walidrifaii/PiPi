import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserAccountGuard } from '../auth/user-account.guard';
import type { JwtUserPayload } from '../auth/jwt-user.payload';
import { CreatePickupDto } from './dto/create-pickup.dto';
import {
  ListPickupSlotsQueryDto,
  PickupCoverageQueryDto,
  QuotePickupQueryDto,
} from './dto/pickup-query.dto';
import { PickupBlockedZoneService } from './pickup-blocked-zone.service';
import { PickupService } from './pickup.service';

@ApiTags('V3 · Customer · Pickup')
@Controller('pickups')
export class PickupController {
  constructor(
    private readonly pickups: PickupService,
    private readonly blocked: PickupBlockedZoneService,
  ) {}

  @ApiOperation({
    summary:
      'Pickup config: NOW window, service fee, and scheduled days/times (super-admin managed)',
  })
  @Get('config')
  getConfig() {
    return this.pickups.getPublicConfig();
  }

  @ApiOperation({
    summary:
      'Upcoming bookable scheduled days and time slots in the pickup timezone',
  })
  @Get('slots')
  listSlots(@Query() query: ListPickupSlotsQueryDto) {
    return this.pickups.listBookableSlots(query.from, query.days);
  }

  @ApiOperation({
    summary:
      'Check whether a pin is inside a pickup blocked polygon. If allowed=false the user cannot use this place.',
  })
  @Get('coverage')
  coverage(@Query() query: PickupCoverageQueryDto) {
    return this.blocked.checkPoint(query.lat, query.lng, query.role ?? 'to');
  }

  @ApiOperation({
    summary:
      'Quote serviceFee + deliveryFee for from→to. Rejects blocked polygons.',
  })
  @Get('quote')
  quote(@Query() query: QuotePickupQueryDto) {
    return this.pickups.quote(
      query.fromLat,
      query.fromLng,
      query.toLat,
      query.toLng,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, UserAccountGuard)
  @ApiOperation({
    summary:
      'Create a NOW or SCHEDULED pickup. Requires recipientFullName and recipientPhone for the person who receives the package. Blocked polygons are rejected. Fees must match quote.',
  })
  @Post()
  create(
    @Req() req: { user: JwtUserPayload },
    @Body() dto: CreatePickupDto,
  ) {
    return this.pickups.create(req.user.sub, dto);
  }
}
