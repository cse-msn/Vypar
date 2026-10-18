import { describe, it, expect } from 'vitest';
import { encodePrice } from '../utils/priceCode';

const cfg = { mid: '1008', suffix: '27', pad: 4, year: undefined as number | undefined };

describe('encodePrice (coded tag price)', () => {
  it('uses <YY><YY+1> from the current year and rolls over', () => {
    expect(encodePrice(1200, cfg, new Date('2025-06-15'))).toBe('25261008120027');
    expect(encodePrice(1200, cfg, new Date('2026-06-15'))).toBe('26271008120027');
    expect(encodePrice(1200, cfg, new Date('2029-12-31'))).toBe('29301008120027');
  });

  it('left-pads short prices and keeps longer ones intact', () => {
    expect(encodePrice(850, cfg, new Date('2026-01-01'))).toBe('26271008085027');
    expect(encodePrice(12999, cfg, new Date('2026-01-01'))).toBe('262710081299927');
  });

  it('honours a pinned year override', () => {
    expect(encodePrice(1200, { ...cfg, year: 2030 })).toBe('30311008120027');
  });
});
