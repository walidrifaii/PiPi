import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UserAddressV3Service, MAX_ADDRESSES_PER_USER } from './user-address-v3.service';

describe('UserAddressV3Service', () => {
  const userId = '11111111-1111-1111-1111-111111111111';

  const prisma = {
    userAddress: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: UserAddressV3Service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UserAddressV3Service(prisma as never);
  });

  it(`rejects creating a ${MAX_ADDRESSES_PER_USER + 1}th address`, async () => {
    prisma.userAddress.count.mockResolvedValue(MAX_ADDRESSES_PER_USER);

    await expect(
      service.createForUser(userId, {
        addressLine: 'Tripoli, Main Street',
        latitude: 32.8872,
        longitude: 13.1913,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creates an address when under the limit', async () => {
    prisma.userAddress.count.mockResolvedValue(2);
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );
    prisma.userAddress.create.mockResolvedValue({
      id: '22222222-2222-2222-2222-222222222222',
      label: null,
      addressLine: 'Tripoli, Main Street',
      latitude: new Prisma.Decimal(32.8872),
      longitude: new Prisma.Decimal(13.1913),
      isDefault: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const result = await service.createForUser(userId, {
      addressLine: 'Tripoli, Main Street',
      latitude: 32.8872,
      longitude: 13.1913,
    });

    expect(result.id).toBe('22222222-2222-2222-2222-222222222222');
    expect(result.latitude).toBe(32.8872);
    expect(prisma.userAddress.create).toHaveBeenCalled();
  });

  it('rejects a duplicate address name for the same user', async () => {
    prisma.userAddress.count.mockResolvedValue(1);
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );
    prisma.userAddress.findFirst.mockResolvedValue({
      id: '33333333-3333-3333-3333-333333333333',
    });

    await expect(
      service.createForUser(userId, {
        label: 'Home',
        addressLine: 'Another street',
        latitude: 32.88,
        longitude: 13.19,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.userAddress.create).not.toHaveBeenCalled();
  });
});
