import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { UserAccountGuard } from '../auth/user-account.guard';
import { JwtUserPayload } from '../auth/jwt-user.payload';
import { UpdateUserAdminDto } from './dto/update-user-admin.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiTags('Customer')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, UserAccountGuard)
  @ApiOperation({ summary: 'Current user profile (customer JWT)' })
  @Get('me')
  getMe(@Req() req: { user?: JwtUserPayload }) {
    const user = req.user!;
    return this.usersService.getProfile(user.sub);
  }

  @ApiTags('Customer')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, UserAccountGuard)
  @ApiOperation({ summary: 'Update your profile (customer JWT)' })
  @Patch('me')
  patchMe(@Req() req: { user?: JwtUserPayload }, @Body() dto: UpdateUserDto) {
    const user = req.user!;
    return this.usersService.updateProfile(user.sub, dto);
  }

  @ApiTags('Super Admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiOperation({ summary: 'List all users (super admin only)' })
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @ApiTags('Super Admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiOperation({ summary: 'Update a user by id (super admin only)' })
  @ApiParam({ name: 'userId', type: String })
  @Patch(':userId')
  patchUser(@Param('userId') userId: string, @Body() dto: UpdateUserAdminDto) {
    return this.usersService.updateByAdmin(userId, dto);
  }
}
