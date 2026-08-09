import { NotFoundException } from '@nestjs/common';
import { ProductOptionsV3Service } from './product-options-v3.service';

describe('ProductOptionsV3Service', () => {
  const merchantId = '33333333-3333-3333-3333-333333333333';
  const productId = '44444444-4444-4444-4444-444444444444';
  const largeId = '66666666-6666-6666-6666-666666666666';

  const prisma = {
    product: { findFirst: jest.fn() },
  };

  const catalog = {
    getProductForStorefront: jest.fn(),
    updateProduct: jest.fn(),
  };

  let service: ProductOptionsV3Service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProductOptionsV3Service(prisma as never, catalog as never);
  });

  it('returns storefront options when the product has option groups', async () => {
    catalog.getProductForStorefront.mockResolvedValue({
      id: productId,
      name: 'Mixed Nuts',
      nameAr: null,
      price: 10,
      discountPrice: null,
      effectivePrice: 10,
      optionGroups: [
        {
          id: 'g1',
          name: 'Size',
          nameAr: null,
          isRequired: true,
          minSelect: 1,
          maxSelect: 1,
          sortOrder: 0,
          choices: [
            {
              id: largeId,
              name: 'Large',
              nameAr: null,
              priceModifier: 4,
              sortOrder: 0,
              isActive: true,
            },
          ],
        },
      ],
    });

    const result = await service.getProductOptionsForStorefront(productId);

    expect(result).toMatchObject({
      productId,
      name: 'Mixed Nuts',
      hasOptions: true,
    });
    expect(result.optionGroups).toHaveLength(1);
  });

  it('returns hasOptions false without optionGroups for products without options', async () => {
    catalog.getProductForStorefront.mockResolvedValue({
      id: productId,
      name: 'Water',
      nameAr: null,
      price: 2,
      discountPrice: null,
      effectivePrice: 2,
    });

    const result = await service.getProductOptionsForStorefront(productId);

    expect(result).toEqual({
      productId,
      name: 'Water',
      nameAr: null,
      price: 2,
      discountPrice: null,
      effectivePrice: 2,
      hasOptions: false,
    });
    expect(result.optionGroups).toBeUndefined();
  });

  it('throws when merchant product is not found', async () => {
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(
      service.getMerchantProductOptions(merchantId, productId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
