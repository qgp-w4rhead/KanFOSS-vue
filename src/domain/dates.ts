import type { DateTime } from './types.ts';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const START_OF_DAY = '00:00';
const END_OF_DAY = '23:59';

export const DATE_FORMAT_ERROR = 'Enter a valid date';
export const TIME_FORMAT_ERROR = 'Enter a valid time';
export const RANGE_ORDER_ERROR = 'Start date/time cannot be after due date/time';

export const formatDate = (date: string): string =>
  new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' });

export const formatDateTime = (value: DateTime): string =>
  value.time ? `${formatDate(value.date)} ${value.time}` : formatDate(value.date);

export const toDateTime = (date: string, time: string): DateTime | undefined => {
  const trimmedDate = date.trim();
  if (!trimmedDate) return undefined;
  const trimmedTime = time.trim();
  return trimmedTime ? { date: trimmedDate, time: trimmedTime } : { date: trimmedDate };
};

const validateDateTime = (value: DateTime): string | null => {
  if (!DATE_PATTERN.test(value.date)) return DATE_FORMAT_ERROR;
  if (value.time !== undefined && !TIME_PATTERN.test(value.time)) return TIME_FORMAT_ERROR;
  return null;
};

const sortKey = (value: DateTime, fallbackTime: string): string => `${value.date}T${value.time ?? fallbackTime}`;

export const validateRange = (start?: DateTime, due?: DateTime): string | null => {
  const formatError = [start, due]
    .map((value) => (value ? validateDateTime(value) : null))
    .find((error) => error !== null);
  if (formatError) return formatError;
  if (!start || !due) return null;
  return sortKey(start, START_OF_DAY) > sortKey(due, END_OF_DAY) ? RANGE_ORDER_ERROR : null;
};
