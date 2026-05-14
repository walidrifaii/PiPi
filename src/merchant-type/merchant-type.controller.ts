import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { CreateMerchantTypeDto } from './dto/create-merchant-type.dto';
import { UpdateMerchantTypeDto } from './dto/update-merchant-type.dto';
import { MerchantTypeService } from './merchant-type.service';

@Controller('merchant-types')
export class MerchantTypeController {
  constructor(private readonly merchantTypeService: MerchantTypeService) {}

  @ApiTags('Shared')
  @ApiOperation({ summary: 'List active merchant types (for dropdowns)' })
  @Get()
  findAllPublic() {
    return this.merchantTypeService.findAllPublic();
  }

  @ApiTags('Super Admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiOperation({ summary: 'List all merchant types including inactive' })
  @Get('admin/all')
  findAllAdmin() {
    return this.merchantTypeService.findAllAdmin();
  }

  @ApiTags('Shared')
  @ApiOperation({ summary: 'Get one merchant type by id' })
  @ApiParam({ name: 'id', type: String })
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.merchantTypeService.findOne(id);
  }

  @ApiTags('Super Admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiOperation({ summary: 'Create merchant type (super admin)' })
  @Post()
  create(@Body() dto: CreateMerchantTypeDto) {
    return this.merchantTypeService.create(dto);
  }

  @ApiTags('Super Admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiParam({ name: 'id', type: String })
  @ApiOperation({ summary: 'Update merchant type (super admin)' })
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMerchantTypeDto,
  ) {
    return this.merchantTypeService.update(id, dto);
  }

  @ApiTags('Super Admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiParam({ name: 'id', type: String })
  @ApiOperation({ summary: 'Delete merchant type (super admin)' })
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.merchantTypeService.remove(id);
  }
}
