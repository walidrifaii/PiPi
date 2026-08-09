import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProductOptionsV3Service } from './product-options-v3.service';

describe('ProductOptionsV3Service', () => {
  const merchantId = '33333333-3333-3333-3333-333333333333';
  const productId = '44444444-4444-4444-4444-444444444444';
  const smallId = '55555555-5555-5555-5555-555555555555';
  const largeId = '66666666-6666-6666-6666-666666666666';

  const prisma = {
    product: { findMany: jest.fn(), findFirst: jest.fn() },
  };

  const merchantOffers = {
    getLiveOfferPercentForMerchant: jest.fn(),
  };

  const catalog = {
    getProductForStorefront: jest.fn(),
    updateProduct: jest.fn(),
  };

  let service: ProductOptionsV3Service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProductOptionsV3Service(
      prisma as never,
      merchantOffers as never,
      catalog as never,
    );
    merchantOffers.getLiveOfferPercentForMerchant.mockResolvedValue(null);
  });

  it('quotes multiple lines for the same product with different options', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: productId,
        name: 'Mixed Nuts',
        price: new Prisma.Decimal(10),
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
                id: smallId,
                name: 'Small',
                nameAr: null,
                priceModifier: new Prisma.Decimal(0),
                sortOrder: 0,
                isActive: true,
              },
              {
                id: largeId,
                name: 'Large',
                nameAr: null,
                priceModifier: new Prisma.Decimal(4),
                sortOrder: 1,
                isActive: true,
              },
            ],
          },
        ],
      },
    ]);

    const result = await service.quoteLines({
      merchantId,
      lines: [
        { productId, quantity: 2, selectedChoiceIds: [largeId] },
        { productId, quantity: 1, selectedChoiceIds: [smallId] },
      ],
    });

    expect(result.lines).toHaveLength(2);
    expect(result.lines[0]).toMatchObject({
      productId,
      quantity: 2,
      unitPrice: 14,
      totalPrice: 28,
      displayName: 'Mixed Nuts (Large)',
    });
    expect(result.lines[1]).toMatchObject({
      productId,
      quantity: 1,
      unitPrice: 10,
      totalPrice: 10,
      displayName: 'Mixed Nuts (Small)',
    });
    expect(result.subtotal).toBe(38);
  });

  it('rejects invalid choice ids', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: productId,
        name: 'Mixed Nuts',
        price: new Prisma.Decimal(10),
        optionGroups: [],
      },
    ]);

    await expect(
      service.quoteLines({
        merchantId,
        lines: [
          {
            productId,
            quantity: 1,
            selectedChoiceIds: ['00000000-0000-0000-0000-000000000000'],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
