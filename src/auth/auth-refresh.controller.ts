import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@ApiTags('Shared')
@Controller('auth')
export class AuthRefreshController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary: 'Exchange refresh token for new access and refresh tokens',
  })
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }
}
