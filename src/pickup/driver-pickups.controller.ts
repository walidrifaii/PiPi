import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { DriverAccountGuard } from '../auth/driver-account.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtUserPayload } from '../auth/jwt-user.payload';
import { DriverPickupsService } from './driver-pickups.service';

@ApiTags('V3 · Delivery · Pickup')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, DriverAccountGuard)
@Controller('drivers/me/pickups')
export class DriverPickupsController {
  constructor(private readonly driverPickups: DriverPickupsService) {}

  @ApiOperation({ summary: 'Unassigned PENDING pickups ready to accept' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Get('available')
  listAvailable(
    @Req() req: { user: JwtUserPayload },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.driverPickups.listAvailable(req.user.sub, page, limit);
  }

  @ApiOperation({ summary: 'Your active pickup jobs (DELIVERING / DISPATCHED)' })
  @Get('active')
  listActive(@Req() req: { user: JwtUserPayload }) {
    return this.driverPickups.listActive(req.user.sub);
  }

  @ApiOperation({ summary: 'Pickups assigned to you' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Get()
  listMine(
    @Req() req: { user: JwtUserPayload },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.driverPickups.listMine(req.user.sub, page, limit);
  }

  @ApiOperation({ summary: 'Accept an available pickup' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @Post(':id/accept')
  accept(
    @Req() req: { user: JwtUserPayload },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.driverPickups.accept(req.user.sub, id);
  }

  @ApiOperation({ summary: 'Confirm collection at the from address (DISPATCHED)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @Post(':id/collect')
  collect(
    @Req() req: { user: JwtUserPayload },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.driverPickups.confirmCollected(req.user.sub, id);
  }

  @ApiOperation({ summary: 'Mark drop-off complete (DELIVERED)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @Post(':id/complete')
  complete(
    @Req() req: { user: JwtUserPayload },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.driverPickups.complete(req.user.sub, id);
  }

  @ApiOperation({ summary: 'Get one of your assigned pickups' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @Get(':id')
  getOne(
    @Req() req: { user: JwtUserPayload },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.driverPickups.getOne(req.user.sub, id);
  }
}
