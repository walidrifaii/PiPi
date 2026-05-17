import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CloudinaryService } from '../common/cloudinary.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MerchantJwtScopeGuard } from '../auth/merchant-jwt-scope.guard';
import { EffectiveMerchantId } from '../auth/effective-merchant-id.decorator';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductMerchantMultipartDto } from './dto/create-product-merchant-multipart.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { MerchantCatalogService } from './merchant-catalog.service';

/** Store catalog for logged-in merchants only (Bearer merchant JWT; store id from token). */
@ApiTags('Merchant')
@ApiBearerAuth()
@Controller('merchants/me')
@UseGuards(JwtAuthGuard, MerchantJwtScopeGuard)
export class MerchantCatalogController {
  constructor(
    private readonly catalog: MerchantCatalogService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  @ApiOperation({ summary: 'List categories for your store (JWT merchant id)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @Get('categories')
  listCategories(
    @EffectiveMerchantId() merchantId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.catalog.listCategories(merchantId, page, limit);
  }

  @ApiOperation({ summary: 'Create category' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        nameAr: { type: 'string', description: 'Arabic category name' },
        descriptionAr: { type: 'string', description: 'Arabic description' },
        sortOrder: { type: 'integer' },
        file: { type: 'string', format: 'binary' },
      },
      required: ['name'],
    },
  })
  @Post('categories')
  @UseInterceptors(FileInterceptor('file'))
  async createCategory(
    @EffectiveMerchantId() merchantId: string,
    @Body() dto: CreateCategoryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    let imageUrl: string | undefined;
    if (file?.buffer) {
      imageUrl = await this.cloudinary.uploadImage(
        file.buffer,
        'athar/categories',
      );
    }
    return this.catalog.createCategory(merchantId, dto, imageUrl);
  }

  @ApiOperation({ summary: 'Update category' })
  @ApiParam({ name: 'categoryId', type: String })
  @Patch('categories/:categoryId')
  updateCategory(
    @EffectiveMerchantId() merchantId: string,
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.catalog.updateCategory(merchantId, categoryId, dto);
  }

  @ApiOperation({ summary: 'Delete category' })
  @ApiParam({ name: 'categoryId', type: String })
  @Delete('categories/:categoryId')
  deleteCategory(
    @EffectiveMerchantId() merchantId: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.catalog.deleteCategory(merchantId, categoryId);
  }

  @ApiOperation({
    operationId: 'merchantListProducts',
    summary: 'List products for your store',
    description:
      'Paginated. Optional `categoryId` query filters to one category (must belong to your store). Omit `categoryId` to list all products.',
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    type: String,
    format: 'uuid',
    description: 'Optional filter by category UUID',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @Get('products')
  listAllProducts(
    @EffectiveMerchantId() merchantId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('categoryId', new ParseUUIDPipe({ optional: true }))
    categoryId?: string,
  ) {
    return this.catalog.listAllProducts(merchantId, categoryId, page, limit);
  }

  @ApiOperation({
    summary:
      'Create product (multipart). Upload photo via `imageUrl` (file picker in Swagger).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        categoryId: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        nameAr: { type: 'string', description: 'Arabic product name' },
        price: { type: 'number' },
        description: { type: 'string' },
        descriptionAr: { type: 'string', description: 'Arabic description' },
        discountPrice: { type: 'number' },
        imageUrl: {
          type: 'string',
          format: 'binary',
          description: 'Product image — choose file (uploaded to Cloudinary)',
        },
      },
      required: ['categoryId', 'name', 'price'],
    },
  })
  @Post('products')
  @UseInterceptors(FileInterceptor('imageUrl'))
  async createProduct(
    @EffectiveMerchantId() merchantId: string,
    @Body() dto: CreateProductMerchantMultipartDto,
    @UploadedFile() imageFile?: Express.Multer.File,
  ) {
    let mainImageUrlFromUpload: string | undefined;
    if (imageFile?.buffer) {
      mainImageUrlFromUpload = await this.cloudinary.uploadImage(
        imageFile.buffer,
        'athar/products',
      );
    }
    return this.catalog.createProduct(
      merchantId,
      dto.categoryId,
      {
        name: dto.name,
        price: dto.price,
        description: dto.description,
        nameAr: dto.nameAr,
        descriptionAr: dto.descriptionAr,
        discountPrice: dto.discountPrice,
      },
      mainImageUrlFromUpload,
      [],
    );
  }

  @ApiOperation({
    summary: 'Update product (JSON). Use imageUrl / extraImageUrls for images.',
  })
  @ApiParam({ name: 'productId', type: String })
  @Patch('products/:productId')
  updateProduct(
    @EffectiveMerchantId() merchantId: string,
    @Param('productId') productId: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.catalog.updateProduct(merchantId, productId, dto);
  }

  @ApiOperation({ summary: 'Delete product' })
  @ApiParam({ name: 'productId', type: String })
  @Delete('products/:productId')
  deleteProduct(
    @EffectiveMerchantId() merchantId: string,
    @Param('productId') productId: string,
  ) {
    return this.catalog.deleteProduct(merchantId, productId);
  }
}
