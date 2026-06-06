import { Pipe, PipeTransform } from '@angular/core';

/**
 * Pure pipe that extracts uppercase initials from a person's name.
 * "Maya Patel" -> "MP", "Walter" -> "W"
 */
@Pipe({ name: 'initials', standalone: true, pure: true })
export class InitialsPipe implements PipeTransform {
  transform(value: string | null | undefined, max = 2): string {
    if (!value) return '?';
    const parts = value.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    const first = parts[0]?.[0] ?? '';
    const last  = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + (max > 1 ? last : '')).toUpperCase();
  }
}
