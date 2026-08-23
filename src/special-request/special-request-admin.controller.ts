import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
  AssignSpecialRequestDriverDto,
  ListSpecialRequestsAdminQueryDto,
  UpdateSpecialRequestStatusDto,
} from './dto/admin-special-request.dto';
import { UpdateSpecialRequestSettingsDto } from './dto/update-special-request-settings.dto';
import { DriverSpecialRequestsService } from './driver-special-requests.service';
import { SpecialRequestService } from './special-request.service';
import { SpecialRequestSettingsService } from './special-request-settings.service';

@ApiTags('Super Admin · Special Request')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('admin/special-requests')
export class SpecialRequestAdminController {
  constructor(
    private readonly specialRequests: SpecialRequestService,
    private readonly settings: SpecialRequestSettingsService,
    private readonly driverSpecialRequests: DriverSpecialRequestsService,
  ) {}

  @ApiOperation({
    summary: 'Get special request settings (enabled flag, NOW window, fixed buy fee)',
  })
  @Get('settings')
  getSettings() {
    return this.settings.getSettings();
  }

  @ApiOperation({ summary: 'Update special request settings (fixed buy fee applies to all new jobs)' })
  @Patch('settings')
  updateSettings(@Body() dto: UpdateSpecialRequestSettingsDto) {
    return this.settings.updateSettings(dto);
  }

  @ApiOperation({ summary: 'List special request jobs' })
  @Get()
  list(@Query() query: ListSpecialRequestsAdminQueryDto) {
    return this.specialRequests.listForAdmin(query);
  }

  @ApiOperation({ summary: 'Get one special request job' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @Get(':id')
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.specialRequests.getForAdmin(id);
  }

  @ApiOperation({ summary: 'Change special request status' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSpecialRequestStatusDto,
  ) {
    return this.specialRequests.updateStatusForAdmin(id, dto.status);
  }

  @ApiOperation({ summary: 'Assign a driver to an unassigned special request' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @Patch(':id/assign-driver')
  assignDriver(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignSpecialRequestDriverDto,
  ) {
    return this.driverSpecialRequests.assignByAdmin(id, dto.driverId);
  }
}
