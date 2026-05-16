import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { DriverAccountGuard } from '../auth/driver-account.guard';
import { RegisterDriverDto } from '../auth/dto/register-driver.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { JwtUserPayload } from '../auth/jwt-user.payload';
import { UpdateDriverAdminDto } from './dto/update-driver-admin.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { DriversService } from './drivers.service';

@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @ApiTags('Delivery')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, DriverAccountGuard)
  @ApiOperation({ summary: 'Current driver profile (driver JWT)' })
  @Get('me')
  getMe(@Req() req: { user?: JwtUserPayload }) {
    const user = req.user!;
    return this.driversService.getProfile(user.sub);
  }

  @ApiTags('Delivery')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, DriverAccountGuard)
  @ApiOperation({
    summary:
      'Update your profile or status (driver JWT); use status for availability',
  })
  @Patch('me')
  patchMe(@Req() req: { user?: JwtUserPayload }, @Body() dto: UpdateDriverDto) {
    const user = req.user!;
    return this.driversService.updateProfile(user.sub, dto);
  }

  @ApiTags('Super Admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiOperation({
    summary: 'Create a driver account (super admin only)',
    description:
      'Drivers cannot self-register. Body: fullName, phone, password, optional email/vehicleType/status. Returns the new driver profile; the driver signs in via POST /auth/driver/login or POST /auth/app/login.',
  })
  @Post()
  createDriver(@Body() dto: RegisterDriverDto) {
    return this.driversService.createByAdmin(dto);
  }

  @ApiTags('Super Admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiOperation({ summary: 'List all drivers (super admin only)' })
  @Get()
  findAll() {
    return this.driversService.findAll();
  }

  @ApiTags('Super Admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiOperation({ summary: 'Update a driver by id (super admin only)' })
  @ApiParam({ name: 'driverId', type: String })
  @Patch(':driverId')
  patchDriver(
    @Param('driverId') driverId: string,
    @Body() dto: UpdateDriverAdminDto,
  ) {
    return this.driversService.updateByAdmin(driverId, dto);
  }
}
