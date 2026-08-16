import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserAccountGuard } from '../auth/user-account.guard';
import type { JwtUserPayload } from '../auth/jwt-user.payload';
import { PickupService } from './pickup.service';

@ApiTags('V3 · Customer · Pickup')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, UserAccountGuard)
@Controller('pickups/me')
export class UserPickupsController {
  constructor(private readonly pickups: PickupService) {}

  @ApiOperation({ summary: 'List your pickup jobs' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @Get()
  list(
    @Req() req: { user: JwtUserPayload },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.pickups.listForUser(req.user.sub, page, limit);
  }

  @ApiOperation({ summary: 'Get one of your pickup jobs' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @Get(':id')
  getOne(
    @Req() req: { user: JwtUserPayload },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.pickups.getForUser(req.user.sub, id);
  }
}
