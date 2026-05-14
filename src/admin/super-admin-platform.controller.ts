import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { DriversService } from '../drivers/drivers.service';
import { UsersService } from '../users/users.service';

@ApiTags('Super Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('admin')
export class SuperAdminPlatformController {
  constructor(
    private readonly usersService: UsersService,
    private readonly driversService: DriversService,
  ) {}

  @ApiOperation({ summary: 'List all customer users' })
  @Get('users')
  listUsers() {
    return this.usersService.findAll();
  }

  @ApiOperation({ summary: 'List all drivers' })
  @Get('drivers')
  listDrivers() {
    return this.driversService.findAll();
  }
}
