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
import { DriverSpecialRequestsService } from './driver-special-requests.service';

@ApiTags('V3 · Delivery · Special Request')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, DriverAccountGuard)
@Controller('drivers/me/special-requests')
export class DriverSpecialRequestsController {
  constructor(
    private readonly driverSpecialRequests: DriverSpecialRequestsService,
  ) {}

  @ApiOperation({ summary: 'Unassigned PENDING special requests ready to accept' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Get('available')
  listAvailable(
    @Req() req: { user: JwtUserPayload },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.driverSpecialRequests.listAvailable(req.user.sub, page, limit);
  }

  @ApiOperation({
    summary: 'Your active special requests (DELIVERING / DISPATCHED)',
  })
  @Get('active')
  listActive(@Req() req: { user: JwtUserPayload }) {
    return this.driverSpecialRequests.listActive(req.user.sub);
  }

  @ApiOperation({ summary: 'Special requests assigned to you' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Get()
  listMine(
    @Req() req: { user: JwtUserPayload },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.driverSpecialRequests.listMine(req.user.sub, page, limit);
  }

  @ApiOperation({ summary: 'Accept an available special request' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @Post(':id/accept')
  accept(
    @Req() req: { user: JwtUserPayload },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.driverSpecialRequests.accept(req.user.sub, id);
  }

  @ApiOperation({ summary: 'Confirm purchase at the store (DISPATCHED)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @Post(':id/collect')
  collect(
    @Req() req: { user: JwtUserPayload },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.driverSpecialRequests.confirmCollected(req.user.sub, id);
  }

  @ApiOperation({ summary: 'Mark drop-off complete (DELIVERED)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @Post(':id/complete')
  complete(
    @Req() req: { user: JwtUserPayload },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.driverSpecialRequests.complete(req.user.sub, id);
  }

  @ApiOperation({ summary: 'Get one of your assigned special requests' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @Get(':id')
  getOne(
    @Req() req: { user: JwtUserPayload },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.driverSpecialRequests.getOne(req.user.sub, id);
  }
}
