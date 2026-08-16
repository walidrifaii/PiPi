import { appliesToMatchesRole } from './pickup.constants';

describe('appliesToMatchesRole', () => {
  it('BOTH blocks collect and drop-off', () => {
    expect(appliesToMatchesRole('BOTH', 'from')).toBe(true);
    expect(appliesToMatchesRole('BOTH', 'to')).toBe(true);
  });

  it('TO only blocks drop-off', () => {
    expect(appliesToMatchesRole('TO', 'from')).toBe(false);
    expect(appliesToMatchesRole('TO', 'to')).toBe(true);
  });

  it('FROM only blocks collection', () => {
    expect(appliesToMatchesRole('FROM', 'from')).toBe(true);
    expect(appliesToMatchesRole('FROM', 'to')).toBe(false);
  });
});
