import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Put,
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
import { parsePolygonRingsFromGeoJson } from '../common/geojson-polygon';
import { UpsertServiceAreaDto } from './dto/upsert-service-area.dto';
import { ServiceAreaService } from './service-area.service';

@ApiTags('Service areas')
@Controller('service-areas')
export class ServiceAreaController {
  constructor(private readonly serviceAreaService: ServiceAreaService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiOperation({
    summary: 'List service areas and GeoJSON boundaries (super admin)',
  })
  @Get('admin')
  listAdmin() {
    return this.serviceAreaService.findAllAdmin();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @ApiOperation({
    summary:
      'Create or update a service area by code (matches merchants.cityCode). boundaryGeoJson: GeoJSON Polygon or Feature containing Polygon.',
  })
  @ApiParam({ name: 'code', example: 'TRIPOLI' })
  @Put('admin/:code')
  upsert(
    @Param('code') code: string,
    @Body() dto: UpsertServiceAreaDto,
  ) {
    const trimmed = code?.trim() ?? '';
    if (!trimmed) {
      throw new BadRequestException('code is required');
    }
    if (dto.boundaryGeoJson !== undefined && dto.boundaryGeoJson !== null) {
      const parsed = parsePolygonRingsFromGeoJson(dto.boundaryGeoJson);
      if (!parsed) {
        throw new BadRequestException(
          'boundaryGeoJson must be a valid GeoJSON Polygon (or Feature / FeatureCollection wrapping one)',
        );
      }
    }
    return this.serviceAreaService.upsertByCode(trimmed, dto);
  }
}
