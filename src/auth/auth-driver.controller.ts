import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CompleteRegisterDriverDto } from './dto/complete-register-driver.dto';
import { LoginDriverDto } from './dto/login-driver.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { SendLoginOtpDto } from './dto/send-login-otp.dto';
import { SendRegisterOtpDto } from './dto/send-register-otp.dto';
import { VerifyLoginOtpDto } from './dto/verify-login-otp.dto';
import { VerifyRegisterOtpDto } from './dto/verify-register-otp.dto';

@ApiTags('Delivery')
@Controller('auth')
export class AuthDriverController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary: 'Driver register step 1 — submit phone; OTP sent via WhatsApp',
  })
  @Post('driver/register')
  registerDriver(@Body() dto: RegisterUserDto) {
    return this.authService.registerDriver(dto);
  }

  @ApiOperation({
    summary: 'Driver register step 2 — verify phone OTP (no account created yet)',
  })
  @Post('driver/register/verify-otp')
  verifyRegisterDriverOtp(@Body() dto: VerifyRegisterOtpDto) {
    return this.authService.verifyRegisterDriverOtp(dto);
  }

  @ApiOperation({
    summary:
      'Driver register step 3 — profile details; creates account and returns JWT',
  })
  @Post('driver/register/complete')
  completeRegisterDriver(@Body() dto: CompleteRegisterDriverDto) {
    return this.authService.completeRegisterDriver(dto);
  }

  @ApiOperation({
    summary:
      'Resend driver registration OTP (requires pending POST /auth/driver/register)',
  })
  @Post('driver/register/resend-otp')
  resendRegisterDriverOtp(@Body() dto: SendRegisterOtpDto) {
    return this.authService.resendRegisterDriverOtp(dto);
  }

  @ApiOperation({
    summary: 'Driver login with email or phone and password (OTP: use POST /auth/user/login)',
  })
  @Post('driver/login/password')
  loginDriver(@Body() dto: LoginDriverDto) {
    return this.authService.loginDriver(dto);
  }

  @ApiOperation({
    deprecated: true,
    summary: 'Alias of POST /auth/user/login',
  })
  @Post('driver/login')
  sendDriverLoginOtp(@Body() dto: SendLoginOtpDto) {
    return this.authService.sendLoginOtp(dto);
  }

  @ApiOperation({
    deprecated: true,
    summary: 'Alias of POST /auth/user/login/verify',
  })
  @Post('driver/login/verify')
  verifyDriverLoginOtp(@Body() dto: VerifyLoginOtpDto) {
    return this.authService.verifyLoginOtp(dto);
  }

  @ApiOperation({
    deprecated: true,
    summary: 'Alias of POST /auth/user/login/resend',
  })
  @Post('driver/login/resend')
  resendDriverLoginOtp(@Body() dto: SendLoginOtpDto) {
    return this.authService.resendLoginOtp(dto);
  }

}
