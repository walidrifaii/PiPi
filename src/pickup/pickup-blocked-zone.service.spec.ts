import { PickupBlockedZoneService } from './pickup-blocked-zone.service';

describe('PickupBlockedZoneService.checkPoint', () => {
  const square = {
    type: 'Polygon',
    coordinates: [
      [
        [13.1, 32.8],
        [13.3, 32.8],
        [13.3, 33.0],
        [13.1, 33.0],
        [13.1, 32.8],
      ],
    ],
  };

  function serviceWithZones(
    zones: Array<{
      id: string;
      name: string;
      appliesTo: string;
      reason: string | null;
      boundaryGeoJson: unknown;
    }>,
  ) {
    const prisma = {
      pickupBlockedZone: {
        findMany: jest.fn().mockResolvedValue(zones),
      },
    };
    return new PickupBlockedZoneService(prisma as never);
  }

  it('rejects a drop-off pin inside a TO blocked polygon', async () => {
    const svc = serviceWithZones([
      {
        id: 'zone-1',
        name: 'Airport',
        appliesTo: 'TO',
        reason: 'We cannot deliver to this location',
        boundaryGeoJson: square,
      },
    ]);
    const result = await svc.checkPoint(32.9, 13.2, 'to');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('We cannot deliver to this location');
  });

  it('allows a collect pin inside a TO-only blocked polygon', async () => {
    const svc = serviceWithZones([
      {
        id: 'zone-1',
        name: 'Airport',
        appliesTo: 'TO',
        reason: 'We cannot deliver to this location',
        boundaryGeoJson: square,
      },
    ]);
    const result = await svc.checkPoint(32.9, 13.2, 'from');
    expect(result.allowed).toBe(true);
  });

  it('allows a pin outside the blocked polygon', async () => {
    const svc = serviceWithZones([
      {
        id: 'zone-1',
        name: 'Airport',
        appliesTo: 'BOTH',
        reason: null,
        boundaryGeoJson: square,
      },
    ]);
    const result = await svc.checkPoint(32.5, 12.5, 'to');
    expect(result.allowed).toBe(true);
  });
});
