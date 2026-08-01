/**
 * apps/web/src/app/ui/status-badge.component.spec.ts
 *
 * Unit tests for StatusBadgeComponent from the shared @caregiver/ui library.
 *
 * The package is imported by name; its entry re-exports use `.js` suffixes,
 * which the karma webpack build resolves via `resolve.extensionAlias`
 * (see karma.webpack.config.cjs).
 */
import { TestBed } from '@angular/core/testing';
import { StatusBadgeComponent, type BadgeSize } from '@caregiver/ui';

describe('StatusBadgeComponent', () => {
  function createBadge(status: string, size?: BadgeSize) {
    const fixture = TestBed.createComponent(StatusBadgeComponent);
    fixture.componentRef.setInput('status', status);
    if (size) fixture.componentRef.setInput('size', size);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the status text', () => {
    const el = createBadge('completed');

    expect(el.querySelector('.status-badge')?.textContent?.trim()).toBe('completed');
  });

  it('applies the status value as a CSS class', () => {
    const el = createBadge('fulfilled');

    expect(el.querySelector('.status-badge')?.classList.contains('fulfilled')).toBe(true);
  });

  it('defaults to the md size variant', () => {
    const el = createBadge('pending');

    const badge = el.querySelector('.status-badge');
    expect(badge?.classList.contains('badge-md')).toBe(true);
    expect(badge?.classList.contains('badge-sm')).toBe(false);
  });

  it('applies the sm size variant when requested', () => {
    const el = createBadge('draft', 'sm');

    const badge = el.querySelector('.status-badge');
    expect(badge?.classList.contains('badge-sm')).toBe(true);
    expect(badge?.classList.contains('badge-md')).toBe(false);
  });

  it('renders different statuses independently', () => {
    const cancelled = createBadge('cancelled');
    const approved = createBadge('approved');

    expect(cancelled.querySelector('.status-badge')?.classList.contains('cancelled')).toBe(true);
    expect(approved.querySelector('.status-badge')?.classList.contains('approved')).toBe(true);
    expect(cancelled.querySelector('.status-badge')?.classList.contains('approved')).toBe(false);
  });
});
