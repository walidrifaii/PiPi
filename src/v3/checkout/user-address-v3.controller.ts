import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { JwtUserPayload } from '../../auth/jwt-user.payload';
import { UserAccountGuard } from '../../auth/user-account.guard';
import { CreateUserAddressDto } from '../../checkout/dto/create-user-address.dto';
import { UpdateUserAddressDto } from '../../checkout/dto/update-user-address.dto';
import {
  MAX_ADDRESSES_PER_USER,
  UserAddressV3Service,
} from './user-address-v3.service';

@ApiTags('V3 · Customer · Addresses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, UserAccountGuard)
@Controller({ path: 'users/me/addresses', version: '3' })
export class UserAddressV3Controller {
  constructor(private readonly userAddressV3Service: UserAddressV3Service) {}

  @ApiOperation({ summary: 'List saved delivery addresses (v3)' })
  @Get()
  list(@Req() req: { user?: JwtUserPayload }) {
    return this.userAddressV3Service.listForUser(req.user!.sub);
  }

  @ApiOperation({ summary: 'Get one saved address (v3)' })
  @ApiParam({ name: 'addressId', type: String })
  @Get(':addressId')
  getOne(
    @Req() req: { user?: JwtUserPayload },
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ) {
    return this.userAddressV3Service.getForUser(req.user!.sub, addressId);
  }

  @ApiOperation({
    summary: `Add a delivery address (v3, max ${MAX_ADDRESSES_PER_USER} per user)`,
  })
  @Post()
  create(
    @Req() req: { user?: JwtUserPayload },
    @Body() dto: CreateUserAddressDto,
  ) {
    return this.userAddressV3Service.createForUser(req.user!.sub, dto);
  }

  @ApiOperation({ summary: 'Update a saved address (v3)' })
  @ApiParam({ name: 'addressId', type: String })
  @Patch(':addressId')
  update(
    @Req() req: { user?: JwtUserPayload },
    @Param('addressId', ParseUUIDPipe) addressId: string,
    @Body() dto: UpdateUserAddressDto,
  ) {
    return this.userAddressV3Service.updateForUser(
      req.user!.sub,
      addressId,
      dto,
    );
  }

  @ApiOperation({ summary: 'Delete a saved address (v3)' })
  @ApiParam({ name: 'addressId', type: String })
  @Delete(':addressId')
  remove(
    @Req() req: { user?: JwtUserPayload },
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ) {
    return this.userAddressV3Service.deleteForUser(req.user!.sub, addressId);
  }
}
