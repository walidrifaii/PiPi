import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginSuperAdminDto } from './dto/login-super-admin.dto';
import { RegisterSuperAdminDto } from './dto/register-super-admin.dto';

@ApiTags('Super Admin')
@Controller('auth')
export class AuthSuperAdminController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary: 'Bootstrap: register the first platform super admin',
    description:
      'Allowed only while no super admin row exists. Further accounts must be added in the database or by a future invite flow.',
  })
  @Post('super-admin/register')
  registerSuperAdmin(@Body() dto: RegisterSuperAdminDto) {
    return this.authService.registerSuperAdmin(dto);
  }

  @ApiOperation({ summary: 'Login super admin and get JWT' })
  @Post('super-admin/login')
  loginSuperAdmin(@Body() dto: LoginSuperAdminDto) {
    return this.authService.loginSuperAdmin(dto);
  }
}
