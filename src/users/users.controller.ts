import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
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
import { ListUsersAdminQueryDto } from './dto/list-users-admin-query.dto';
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

  @ApiTags('Customer')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, UserAccountGuard)
  @ApiOperation({
    summary:
      'Delete your account (customer JWT). Account is deactivated for 30 days; sign in again to restore, or it is permanently removed.',
  })
  @Delete('me')
  deleteMe(@Req() req: { user?: JwtUserPayload }) {
    const user = req.user!;
    return this.usersService.requestAccountDeletion(user.sub);
  }

  @ApiTags('Super Admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiOperation({
    summary:
      'List users (super admin only). Paginated; optional search by name, phone, email, or id.',
  })
  @Get()
  findAll(@Query() query: ListUsersAdminQueryDto) {
    return this.usersService.findAllForAdmin(query);
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

  @ApiTags('Super Admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiOperation({
    summary:
      'Delete a user by id (super admin only). Removes their orders and saved addresses.',
  })
  @ApiParam({ name: 'userId', type: String, format: 'uuid' })
  @Delete(':userId')
  deleteUser(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.usersService.deleteByAdmin(userId);
  }
}
