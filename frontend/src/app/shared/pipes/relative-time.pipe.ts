import { Pipe, PipeTransform } from '@angular/core';

/**
 * Pure pipe that converts a date / ISO string / epoch number into a
 * human-friendly relative description like "3m ago", "in 2h", "yesterday".
 */
@Pipe({ name: 'relativeTime', standalone: true, pure: true })
export class RelativeTimePipe implements PipeTransform {
  transform(value: string | number | Date | null | undefined): string {
    if (value === null || value === undefined || value === '') return '—';
    const t = typeof value === 'string' || value instanceof Date ? new Date(value).getTime() : value;
    if (Number.isNaN(t)) return '—';

    const diff = t - Date.now();
    const abs = Math.abs(diff);
    const future = diff > 0;

    const sec = 1000;
    const min = 60 * sec;
    const hr = 60 * min;
    const day = 24 * hr;
    const wk = 7 * day;
    const mo = 30 * day;
    const yr = 365 * day;

    let amount: number;
    let unit: string;
    if (abs < min) { amount = Math.round(abs / sec); unit = 's'; }
    else if (abs < hr)  { amount = Math.round(abs / min); unit = 'm'; }
    else if (abs < day) { amount = Math.round(abs / hr);  unit = 'h'; }
    else if (abs < wk)  { amount = Math.round(abs / day); unit = 'd'; }
    else if (abs < mo)  { amount = Math.round(abs / wk);  unit = 'w'; }
    else if (abs < yr)  { amount = Math.round(abs / mo);  unit = 'mo'; }
    else                { amount = Math.round(abs / yr);  unit = 'y'; }

    if (unit === 's' && amount < 5) return 'just now';
    return future ? `in ${amount}${unit}` : `${amount}${unit} ago`;
  }
}
