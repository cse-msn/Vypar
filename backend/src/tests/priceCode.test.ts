import { describe, it, expect } from 'vitest';
import { encodePrice } from '../utils/priceCode';

// Mirrors the shop's real config: <YY> + fixed "271008" + price(padded 4) + fixed "23".
const cfg = { mid: '271008', suffix: '23', pad: 4, year: undefined as number | undefined };

describe('encodePrice (coded tag price)', () => {
  it('prefixes the current year and rolls ONLY the first two digits', () => {
    expect(encodePrice(1200, cfg, new Date('2026-06-15'))).toBe('26271008120023');
    expect(encodePrice(1200, cfg, new Date('2027-06-15'))).toBe('27271008120023');
    expect(encodePrice(1200, cfg, new Date('2028-06-15'))).toBe('28271008120023');

    // Everything after the 2-digit year is fixed, identical across years.
    const tail = (s: string) => s.slice(2);
    expect(tail(encodePrice(1200, cfg, new Date('2026-01-01')))).toBe(
      tail(encodePrice(1200, cfg, new Date('2099-01-01'))),
    );
  });

  it('left-pads short prices and keeps longer ones intact', () => {
    expect(encodePrice(850, cfg, new Date('2026-01-01'))).toBe('26271008085023');
    expect(encodePrice(12999, cfg, new Date('2026-01-01'))).toBe('262710081299923');
  });

  it('honours a pinned year override', () => {
    expect(encodePrice(1200, { ...cfg, year: 2030 })).toBe('30271008120023');
  });
});
