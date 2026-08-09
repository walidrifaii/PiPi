import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { MerchantJwtScopeGuard } from '../../auth/merchant-jwt-scope.guard';
import { EffectiveMerchantId } from '../../auth/effective-merchant-id.decorator';
import { ProductOptionsV3Service } from './product-options-v3.service';
import { ProductOptionsProductV3ResponseDto } from './dto/product-option-group-v3-response.dto';
import { ReplaceProductOptionsV3Dto } from './dto/replace-product-options-v3.dto';

@ApiTags('V3 · Product Options')
@Controller({ path: 'product-options', version: '3' })
export class ProductOptionsStorefrontV3Controller {
  constructor(private readonly productOptions: ProductOptionsV3Service) {}

  @ApiOperation({
    summary: 'Get product option groups (storefront)',
    description:
      'Returns size/extras groups and choice price modifiers for one active product. hasOptions is false when the product has no options; optionGroups is omitted in that case.',
  })
  @ApiParam({ name: 'productId', format: 'uuid' })
  @ApiResponse({ status: 200, type: ProductOptionsProductV3ResponseDto })
  @Get('products/:productId')
  getProductOptions(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.productOptions.getProductOptionsForStorefront(productId);
  }
}

@ApiTags('V3 · Product Options · Merchant')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, MerchantJwtScopeGuard)
@Controller({ path: 'product-options/merchants/me', version: '3' })
export class MerchantProductOptionsV3Controller {
  constructor(private readonly productOptions: ProductOptionsV3Service) {}

  @ApiOperation({
    summary: 'Get option groups for a merchant product',
  })
  @ApiParam({ name: 'productId', format: 'uuid' })
  @Get('products/:productId')
  getProductOptions(
    @EffectiveMerchantId() merchantId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.productOptions.getMerchantProductOptions(merchantId, productId);
  }

  @ApiOperation({
    summary: 'Replace all option groups on a merchant product',
    description:
      'Defines sizes (required, maxSelect 1) and optional extras (maxSelect > 1). Replaces existing groups entirely. Send [] to clear all options.',
  })
  @ApiParam({ name: 'productId', format: 'uuid' })
  @Put('products/:productId')
  replaceProductOptions(
    @EffectiveMerchantId() merchantId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: ReplaceProductOptionsV3Dto,
  ) {
    return this.productOptions.replaceMerchantProductOptions(
      merchantId,
      productId,
      dto.optionGroups,
    );
  }
}
