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
import { S3Service } from '../common/s3.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MerchantJwtScopeGuard } from '../auth/merchant-jwt-scope.guard';
import { EffectiveMerchantId } from '../auth/effective-merchant-id.decorator';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductMerchantMultipartDto } from './dto/create-product-merchant-multipart.dto';
import { parseOptionGroupsJson } from './parse-option-groups-json';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateProductMerchantMultipartDto } from './dto/update-product-merchant-multipart.dto';
import { MerchantCatalogService } from './merchant-catalog.service';

/** Store catalog for logged-in merchants only (Bearer merchant JWT; store id from token). */
@ApiTags('Merchant')
@ApiBearerAuth()
@Controller('merchants/me')
@UseGuards(JwtAuthGuard, MerchantJwtScopeGuard)
export class MerchantCatalogController {
  constructor(
    private readonly catalog: MerchantCatalogService,
    private readonly cloudinary: S3Service,
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

  @ApiOperation({
    summary:
      'Update category (JSON or multipart). Send `file` for a new category image.',
  })
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiParam({ name: 'categoryId', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        nameAr: { type: 'string' },
        descriptionAr: { type: 'string' },
        sortOrder: { type: 'integer' },
        imageUrl: {
          type: 'string',
          nullable: true,
          description: 'Set null to clear image (JSON only)',
        },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @Patch('categories/:categoryId')
  @UseInterceptors(FileInterceptor('file'))
  async updateCategory(
    @EffectiveMerchantId() merchantId: string,
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateCategoryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    let uploadedImageUrl: string | undefined;
    if (file?.buffer) {
      uploadedImageUrl = await this.cloudinary.uploadImage(
        file.buffer,
        'athar/categories',
      );
    }
    return this.catalog.updateCategory(merchantId, categoryId, {
      ...dto,
      ...(uploadedImageUrl !== undefined ? { imageUrl: uploadedImageUrl } : {}),
    });
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
      'Paginated. Optional `categoryId` query filters to one category (must belong to your store). Optional `name` filters by product name in English or Arabic (prefix match, min 2 characters). Omit both to list all products.',
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    type: String,
    format: 'uuid',
    description: 'Optional filter by category UUID',
  })
  @ApiQuery({
    name: 'name',
    required: false,
    type: String,
    description:
      'Optional filter by product name (English or Arabic). Case-insensitive prefix match; minimum 2 characters.',
    example: 'burger',
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
    @Query('name') name?: string,
  ) {
    return this.catalog.listAllProducts(merchantId, categoryId, page, limit, name);
  }

  @ApiOperation({
    summary:
      'Create product (multipart). Upload photo via `imageUrl`. Optional sizes/extras via `optionGroupsJson`.',
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
        optionGroupsJson: {
          type: 'string',
          description:
            'Optional JSON array of option groups (e.g. Size: Small/Medium/Large with priceModifier). Same structure as PATCH body optionGroups.',
          example:
            '[{"name":"Size","isRequired":true,"minSelect":1,"maxSelect":1,"choices":[{"name":"Small","priceModifier":0},{"name":"Medium","priceModifier":2},{"name":"Large","priceModifier":4}]}]',
        },
        imageUrl: {
          type: 'string',
          format: 'binary',
          description: 'Product image — choose file (uploaded to S3)',
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
    const optionGroups = parseOptionGroupsJson(dto.optionGroupsJson);

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
        isActive: dto.isActive,
        optionGroups,
      },
      mainImageUrlFromUpload,
      [],
    );
  }

  @ApiOperation({
    summary:
      'Update product (JSON or multipart). Send `imageUrl` file for a new main image.',
  })
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiParam({ name: 'productId', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        categoryId: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        nameAr: { type: 'string' },
        price: { type: 'number' },
        description: { type: 'string' },
        descriptionAr: { type: 'string' },
        discountPrice: { type: 'number', nullable: true },
        isActive: { type: 'boolean' },
        imageUrl: { type: 'string', format: 'binary' },
      },
    },
  })
  @Patch('products/:productId')
  @UseInterceptors(FileInterceptor('imageUrl'))
  async updateProduct(
    @EffectiveMerchantId() merchantId: string,
    @Param('productId') productId: string,
    @Body() dto: UpdateProductMerchantMultipartDto,
    @UploadedFile() imageFile?: Express.Multer.File,
  ) {
    let uploadedImageUrl: string | undefined;
    if (imageFile?.buffer) {
      uploadedImageUrl = await this.cloudinary.uploadImage(
        imageFile.buffer,
        'athar/products',
      );
    }
    const optionGroups =
      dto.optionGroupsJson !== undefined
        ? parseOptionGroupsJson(dto.optionGroupsJson)
        : undefined;

    return this.catalog.updateProduct(merchantId, productId, {
      ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.nameAr !== undefined ? { nameAr: dto.nameAr } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.descriptionAr !== undefined
        ? { descriptionAr: dto.descriptionAr }
        : {}),
      ...(dto.price !== undefined ? { price: dto.price } : {}),
      ...(dto.discountPrice !== undefined
        ? { discountPrice: dto.discountPrice }
        : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(optionGroups !== undefined ? { optionGroups } : {}),
      ...(uploadedImageUrl !== undefined ? { imageUrl: uploadedImageUrl } : {}),
    });
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
