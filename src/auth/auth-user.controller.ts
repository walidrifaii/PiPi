import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UserAccountGuard } from './user-account.guard';
import { JwtUserPayload } from './jwt-user.payload';
import { AuthService } from './auth.service';
import { LoginUserDto } from './dto/login-user.dto';
import { CompleteRegisterUserDto } from './dto/complete-register-user.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { SendRegisterOtpDto } from './dto/send-register-otp.dto';
import { SendLoginOtpDto } from './dto/send-login-otp.dto';
import { VerifyRegisterOtpDto } from './dto/verify-register-otp.dto';
import { VerifyLoginOtpDto } from './dto/verify-login-otp.dto';

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
    summary:
      'Login step 1 — customer or driver phone; OTP sent via WhatsApp',
  })
  @Post('user/login')
  sendLoginOtp(@Body() dto: SendLoginOtpDto) {
    return this.authService.sendLoginOtp(dto);
  }

  @ApiOperation({
    summary:
      'Login step 2 — verify code; returns accountType (user|driver), profile, accessToken, refreshToken',
  })
  @Post('user/login/verify')
  verifyLoginOtp(@Body() dto: VerifyLoginOtpDto) {
    return this.authService.verifyLoginOtp(dto);
  }

  @ApiOperation({
    summary:
      'Resend login code for customer or driver (same body as POST /auth/user/login)',
  })
  @Post('user/login/resend')
  resendLoginOtp(@Body() dto: SendLoginOtpDto) {
    return this.authService.resendLoginOtp(dto);
  }

  @ApiOperation({
    summary: 'User login with email or phone and password',
  })
  @Post('user/login/password')
  loginUser(@Body() dto: LoginUserDto) {
    return this.authService.loginUser(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, UserAccountGuard)
  @ApiOperation({
    summary: 'Logout — clears FCM token for this user (customer JWT)',
  })
  @Post('user/logout')
  logoutUser(@Req() req: { user?: JwtUserPayload }) {
    return this.authService.logoutUser(req.user!.sub);
  }
}
