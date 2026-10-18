import { describe, it, expect } from 'vitest';
import { formatCurrency, formatNumber, formatDate } from './format';

describe('format helpers', () => {
  it('formats INR currency with 2 decimals', () => {
    expect(formatCurrency(1234.5)).toContain('1,234.50');
    expect(formatCurrency(0)).toContain('0.00');
    expect(formatCurrency(null)).toContain('0.00');
  });

  it('formats numbers with Indian grouping', () => {
    expect(formatNumber(100000)).toBe('1,00,000');
  });

  it('formats dates and handles empty', () => {
    expect(formatDate('2026-01-15T00:00:00.000Z')).toMatch(/2026/);
    expect(formatDate(null)).toBe('—');
  });
});
