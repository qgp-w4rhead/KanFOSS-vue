import { describe, expect, it } from 'vitest';
import {
  DATE_FORMAT_ERROR,
  RANGE_ORDER_ERROR,
  TIME_FORMAT_ERROR,
  formatDate,
  formatDateTime,
  toDateTime,
  validateRange,
} from './dates.ts';

describe('formatDate', () => {
  it('formats a date string with its year and day', () => {
    const result = formatDate('2024-01-15');
    expect(result).toContain('2024');
    expect(result).toContain('15');
  });

  it('formats a date and time together', () => {
    expect(formatDateTime({ date: '2024-01-15', time: '09:30' })).toContain('09:30');
  });
});

describe('toDateTime', () => {
  it('returns undefined when the date is blank', () => {
    expect(toDateTime('  ', '10:00')).toBeUndefined();
  });

  it('drops a blank time', () => {
    expect(toDateTime('2024-01-01', ' ')).toEqual({ date: '2024-01-01' });
  });
});

describe('validateRange', () => {
  it('passes a valid range', () => {
    expect(validateRange({ date: '2024-01-01' }, { date: '2024-01-10' })).toBeNull();
  });

  it('passes when start equals end', () => {
    expect(validateRange({ date: '2024-01-01' }, { date: '2024-01-01' })).toBeNull();
  });

  it('rejects a start after the due date', () => {
    expect(validateRange({ date: '2024-01-10' }, { date: '2024-01-01' })).toBe(RANGE_ORDER_ERROR);
  });

  it('passes when either date is missing', () => {
    expect(validateRange(undefined, { date: '2024-01-10' })).toBeNull();
    expect(validateRange({ date: '2024-01-10' }, undefined)).toBeNull();
  });

  it('rejects reversed times on the same day', () => {
    const start = { date: '2024-01-01', time: '10:00' };
    expect(validateRange(start, { date: '2024-01-01', time: '09:00' })).toBe(RANGE_ORDER_ERROR);
  });

  it('accepts ordered times on the same day', () => {
    const start = { date: '2024-01-01', time: '09:00' };
    expect(validateRange(start, { date: '2024-01-01', time: '10:00' })).toBeNull();
  });

  it('treats a missing start time as the start of the day', () => {
    expect(validateRange({ date: '2024-01-01' }, { date: '2024-01-01', time: '00:00' })).toBeNull();
  });

  it('treats a missing due time as the end of the day', () => {
    expect(validateRange({ date: '2024-01-01', time: '23:00' }, { date: '2024-01-01' })).toBeNull();
  });

  it('rejects a malformed date', () => {
    expect(validateRange({ date: '01/02/2024' }, undefined)).toBe(DATE_FORMAT_ERROR);
  });

  it('rejects a malformed time', () => {
    expect(validateRange({ date: '2024-01-01', time: '25:00' }, undefined)).toBe(TIME_FORMAT_ERROR);
  });
});
