import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginUserDto } from './dto/login-user.dto';
import { CompleteRegisterUserDto } from './dto/complete-register-user.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { SendRegisterOtpDto } from './dto/send-register-otp.dto';
import { VerifyRegisterOtpDto } from './dto/verify-register-otp.dto';

@ApiTags('Customer')
@Controller('auth')
export class AuthUserController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary: 'Step 1 — submit phone; OTP sent via WhatsApp',
  })
  @Post('user/register')
  registerUser(@Body() dto: RegisterUserDto) {
    return this.authService.registerUser(dto);
  }

  @ApiOperation({
    summary: 'Step 2 — verify phone OTP (no account created yet)',
  })
  @Post('user/register/verify-otp')
  verifyRegisterOtp(@Body() dto: VerifyRegisterOtpDto) {
    return this.authService.verifyRegisterOtp(dto);
  }

  @ApiOperation({
    summary: 'Step 3 — profile details; creates account and returns JWT',
  })
  @Post('user/register/complete')
  completeRegisterUser(@Body() dto: CompleteRegisterUserDto) {
    return this.authService.completeRegisterUser(dto);
  }

  @ApiOperation({
    summary: 'Resend registration OTP (requires pending POST /auth/user/register)',
  })
  @Post('user/register/resend-otp')
  resendRegisterOtp(@Body() dto: SendRegisterOtpDto) {
    return this.authService.resendRegisterOtp(dto);
  }

  @ApiOperation({
    summary: 'User login: email or phone as identifier, plus password',
  })
  @Post('user/login')
  loginUser(@Body() dto: LoginUserDto) {
    return this.authService.loginUser(dto);
  }
}
