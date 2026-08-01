import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CheckoutService } from '../../checkout/checkout.service';

describe('CheckoutService v3 address rules', () => {
  const userId = '11111111-1111-1111-1111-111111111111';
  const merchantId = '33333333-3333-3333-3333-333333333333';
  const addressId = '22222222-2222-2222-2222-222222222222';

  const prisma = {
    merchant: { findUnique: jest.fn() },
    userAddress: { findFirst: jest.fn() },
    product: { findMany: jest.fn() },
    bundle: { findMany: jest.fn() },
    order: { create: jest.fn() },
    couponUsage: { create: jest.fn() },
    coupon: { update: jest.fn() },
    $transaction: jest.fn(),
  };

  const orderNotifications = { notifyMerchantNewOrder: jest.fn() };
  const merchantOffers = { getActiveOfferPercentForMerchant: jest.fn() };
  const deliveryFees = { computeForDistance: jest.fn() };
  const couponSvc = { assertValidForCheckout: jest.fn() };

  let service: CheckoutService;

  const baseDto = {
    merchantId,
    merchantName: 'Test Merchant',
    deliveryFee: 5,
    distanceKm: 3,
    deliveryTimeMinutes: { min: 20, max: 40 },
    latitude: 32.8872,
    longitude: 13.1913,
    items: [
      {
        productId: '44444444-4444-4444-4444-444444444444',
        productName: 'Burger',
        quantity: 1,
        price: 10,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CheckoutService(
      prisma as never,
      orderNotifications as never,
      merchantOffers as never,
      deliveryFees as never,
      couponSvc as never,
    );

    prisma.merchant.findUnique.mockResolvedValue({
      id: merchantId,
      isActive: true,
      isEnabled: true,
      useWorkingHours: false,
      timezone: 'Asia/Beirut',
      workingIntervals: [],
    });
  });

  it('requires addressId when requireAddressId is enabled', async () => {
    await expect(
      service.createOrder(userId, baseDto as never, {
        requireAddressId: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects checkout when coordinates do not match saved address', async () => {
    prisma.userAddress.findFirst.mockResolvedValue({
      id: addressId,
      latitude: new Prisma.Decimal(32.8872),
      longitude: new Prisma.Decimal(13.1913),
    });

    await expect(
      service.createOrder(
        userId,
        {
          ...baseDto,
          addressId,
          latitude: 33.0,
          longitude: 13.1913,
        } as never,
        {
          requireAddressId: true,
          validateSavedAddressCoordinates: true,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resolves coordinates from saved address when lat/lng omitted', async () => {
    prisma.userAddress.findFirst.mockResolvedValue({
      id: addressId,
      latitude: new Prisma.Decimal(32.8872),
      longitude: new Prisma.Decimal(13.1913),
    });
    prisma.product.findMany.mockResolvedValue([]);

    const { latitude: _lat, longitude: _lng, ...dtoWithoutCoords } = baseDto;

    await expect(
      service.createOrder(
        userId,
        { ...dtoWithoutCoords, addressId } as never,
        {
          requireAddressId: true,
          resolveCoordinatesFromSavedAddress: true,
          validateSavedAddressCoordinates: true,
        },
      ),
    ).rejects.toThrow(
      'One or more products are invalid or belong to a different merchant',
    );
  });
});
