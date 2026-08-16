import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import {
  AssignPickupDriverDto,
  ListPickupsAdminQueryDto,
  UpdatePickupStatusDto,
} from './dto/admin-pickup.dto';
import {
  CreatePickupBlockedZoneDto,
  UpdatePickupBlockedZoneDto,
} from './dto/pickup-blocked-zone.dto';
import {
  CreatePickupDeliveryFeeConfigDto,
  UpdatePickupDeliveryFeeConfigDto,
} from './dto/pickup-delivery-fee.dto';
import { ReplacePickupScheduleDto } from './dto/replace-pickup-schedule.dto';
import { UpdatePickupSettingsDto } from './dto/update-pickup-settings.dto';
import { DriverPickupsService } from './driver-pickups.service';
import { PickupBlockedZoneService } from './pickup-blocked-zone.service';
import { PickupDeliveryFeeService } from './pickup-delivery-fee.service';
import { PickupSettingsService } from './pickup-settings.service';
import { PickupService } from './pickup.service';

@ApiTags('Super Admin · Pickup')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('admin/pickups')
export class PickupAdminController {
  constructor(
    private readonly settings: PickupSettingsService,
    private readonly fees: PickupDeliveryFeeService,
    private readonly blocked: PickupBlockedZoneService,
    private readonly pickups: PickupService,
    private readonly driverPickups: DriverPickupsService,
  ) {}

  @ApiOperation({ summary: 'Get pickup settings (NOW window, service fee, timezone)' })
  @Get('settings')
  getSettings() {
    return this.settings.getSettings();
  }

  @ApiOperation({ summary: 'Update pickup settings' })
  @Patch('settings')
  updateSettings(@Body() dto: UpdatePickupSettingsDto) {
    return this.settings.updateSettings(dto);
  }

  @ApiOperation({ summary: 'Get weekly scheduled pickup hours' })
  @Get('schedule')
  getSchedule() {
    return this.settings.getSchedule();
  }

  @ApiOperation({
    summary: 'Replace weekly scheduled pickup hours (empty slots = closed that day)',
  })
  @Put('schedule')
  replaceSchedule(@Body() dto: ReplacePickupScheduleDto) {
    return this.settings.replaceSchedule(dto);
  }

  @ApiOperation({ summary: 'List pickup delivery-fee configs' })
  @Get('delivery-fees')
  listFees() {
    return this.fees.findAllAdmin();
  }

  @ApiOperation({
    summary:
      'Create pickup delivery fee (min = fixedFee, max = maxFee). Activate one config at a time.',
  })
  @Post('delivery-fees')
  createFee(@Body() dto: CreatePickupDeliveryFeeConfigDto) {
    return this.fees.createAdmin(dto);
  }

  @ApiOperation({ summary: 'Update a pickup delivery-fee config' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @Patch('delivery-fees/:id')
  updateFee(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePickupDeliveryFeeConfigDto,
  ) {
    return this.fees.updateAdmin(id, dto);
  }

  @ApiOperation({ summary: 'Delete a pickup delivery-fee config' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @Delete('delivery-fees/:id')
  deleteFee(@Param('id', ParseUUIDPipe) id: string) {
    return this.fees.deleteAdmin(id);
  }

  @ApiOperation({
    summary:
      'List pickup blocked polygons (separate from service_areas). Users cannot collect/drop inside these.',
  })
  @Get('blocked-zones')
  listBlockedZones() {
    return this.blocked.findAllAdmin();
  }

  @ApiOperation({ summary: 'Create a pickup blocked polygon' })
  @Post('blocked-zones')
  createBlockedZone(@Body() dto: CreatePickupBlockedZoneDto) {
    return this.blocked.createAdmin(dto);
  }

  @ApiOperation({ summary: 'Update a pickup blocked polygon' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @Patch('blocked-zones/:id')
  updateBlockedZone(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePickupBlockedZoneDto,
  ) {
    return this.blocked.updateAdmin(id, dto);
  }

  @ApiOperation({ summary: 'Delete a pickup blocked polygon' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @Delete('blocked-zones/:id')
  deleteBlockedZone(@Param('id', ParseUUIDPipe) id: string) {
    return this.blocked.deleteAdmin(id);
  }

  @ApiOperation({ summary: 'List pickup jobs' })
  @Get()
  list(@Query() query: ListPickupsAdminQueryDto) {
    return this.pickups.listForAdmin(query);
  }

  @ApiOperation({ summary: 'Get one pickup job' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @Get(':id')
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.pickups.getForAdmin(id);
  }

  @ApiOperation({ summary: 'Change pickup status' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePickupStatusDto,
  ) {
    return this.pickups.updateStatusForAdmin(id, dto.status);
  }

  @ApiOperation({ summary: 'Assign a driver to an unassigned pickup' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @Patch(':id/assign-driver')
  assignDriver(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignPickupDriverDto,
  ) {
    return this.driverPickups.assignByAdmin(id, dto.driverId);
  }
}
