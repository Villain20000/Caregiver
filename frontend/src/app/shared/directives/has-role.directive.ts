import {
  Directive,
  Input,
  TemplateRef,
  ViewContainerRef,
  effect,
  inject,
} from '@angular/core';
import { Role } from '../../core/models/role.model';
import { RoleService } from '../../core/services/role.service';

/**
 * Structural directive: shows the host element only when the current
 * role is included in the supplied list.
 *
 * Usage:
 *   <button *hasRole="['doctor','nurse']">Sign Order</button>
 *   <div  *hasRole="[Role.ADMIN]">…</div>
 */
@Directive({
  selector: '[hasRole]',
  standalone: true,
})
export class HasRoleDirective {
  private readonly tpl = inject(TemplateRef<unknown>);
  private readonly vcr = inject(ViewContainerRef);
  private readonly roles = inject(RoleService);

  private allowed: readonly Role[] = [];
  private rendered = false;

  constructor() {
    effect(() => {
      // Read active role to make this directive reactive.
      this.roles.activeRole();
      this.update();
    });
  }

  @Input()
  set hasRole(roles: readonly Role[] | Role) {
    this.allowed = Array.isArray(roles) ? roles : [roles];
    this.update();
  }

  private update(): void {
    const allowed = this.allowed;
    const should = !allowed || allowed.length === 0 ? true : this.roles.canAccess(allowed);
    if (should && !this.rendered) {
      this.vcr.createEmbeddedView(this.tpl);
      this.rendered = true;
    } else if (!should && this.rendered) {
      this.vcr.clear();
      this.rendered = false;
    }
  }
}
