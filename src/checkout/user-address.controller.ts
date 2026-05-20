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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtUserPayload } from '../auth/jwt-user.payload';
import { UserAccountGuard } from '../auth/user-account.guard';
import { CreateUserAddressDto } from './dto/create-user-address.dto';
import { UpdateUserAddressDto } from './dto/update-user-address.dto';
import { UserAddressService } from './user-address.service';

@ApiTags('Customer')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, UserAccountGuard)
@Controller('users/me/addresses')
export class UserAddressController {
  constructor(private readonly userAddressService: UserAddressService) {}

  @ApiOperation({ summary: 'List saved delivery addresses' })
  @Get()
  list(@Req() req: { user?: JwtUserPayload }) {
    return this.userAddressService.listForUser(req.user!.sub);
  }

  @ApiOperation({ summary: 'Get one saved address' })
  @ApiParam({ name: 'addressId', type: String })
  @Get(':addressId')
  getOne(
    @Req() req: { user?: JwtUserPayload },
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ) {
    return this.userAddressService.getForUser(req.user!.sub, addressId);
  }

  @ApiOperation({ summary: 'Add a delivery address (lat/lng required)' })
  @Post()
  create(
    @Req() req: { user?: JwtUserPayload },
    @Body() dto: CreateUserAddressDto,
  ) {
    return this.userAddressService.createForUser(req.user!.sub, dto);
  }

  @ApiOperation({ summary: 'Update a saved address' })
  @ApiParam({ name: 'addressId', type: String })
  @Patch(':addressId')
  update(
    @Req() req: { user?: JwtUserPayload },
    @Param('addressId', ParseUUIDPipe) addressId: string,
    @Body() dto: UpdateUserAddressDto,
  ) {
    return this.userAddressService.updateForUser(
      req.user!.sub,
      addressId,
      dto,
    );
  }

  @ApiOperation({ summary: 'Delete a saved address' })
  @ApiParam({ name: 'addressId', type: String })
  @Delete(':addressId')
  remove(
    @Req() req: { user?: JwtUserPayload },
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ) {
    return this.userAddressService.deleteForUser(req.user!.sub, addressId);
  }
}
