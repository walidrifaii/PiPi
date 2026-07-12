import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ParseUuidMerchantIdPipe } from '../common/parse-uuid-merchant-id.pipe';
import { BundleService } from './bundle.service';

@ApiTags('Storefront')
@Controller('bundles')
export class BundlePublicController {
  constructor(private readonly bundles: BundleService) {}

  @ApiOperation({
    summary: 'List active bundles (paginated)',
    description:
      'Returns active bundles from enabled merchants. Each item includes the merchant logo.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'merchantId',
    required: false,
    type: String,
    description: 'Filter bundles for one store',
  })
  @Get()
  listAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('merchantId') merchantId?: string,
  ) {
    return this.bundles.listPublic(page, limit, merchantId);
  }

  @ApiOperation({
    summary: 'Get one active bundle by id',
    description: 'Includes merchant id, name, and logo.',
  })
  @ApiParam({ name: 'bundleId', type: String, format: 'uuid' })
  @Get(':bundleId')
  getOne(@Param('bundleId', ParseUUIDPipe) bundleId: string) {
    return this.bundles.findOnePublic(bundleId);
  }
}

@ApiTags('Storefront')
@Controller('merchants')
export class BundleMerchantPublicController {
  constructor(private readonly bundles: BundleService) {}

  @ApiOperation({
    summary: 'Active bundles for one merchant store',
    description: 'Same as GET /bundles?merchantId=… with merchant logo on each item.',
  })
  @ApiParam({ name: 'merchantId', type: String, format: 'uuid' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @Get(':merchantId/bundles')
  listForMerchant(
    @Param('merchantId', ParseUuidMerchantIdPipe) merchantId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.bundles.listPublic(page, limit, merchantId);
  }
}
