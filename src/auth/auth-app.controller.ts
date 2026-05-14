import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginUserDto } from './dto/login-user.dto';

@ApiTags('Shared')
@Controller('auth')
export class AuthAppController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary:
      'Login as customer or driver with email/phone and password only; response includes accountType and full profile',
  })
  @Post('app/login')
  loginUserOrDriver(@Body() dto: LoginUserDto) {
    return this.authService.loginUserOrDriver(dto);
  }
}
