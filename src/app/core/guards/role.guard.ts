import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '@core/services';
import { UserRole } from '@core/models';
import { map, take } from 'rxjs/operators';

/**
 * Factory para crear guards de roles específicos
 */
function createRoleGuard(allowedRoles: UserRole[]): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    return authService.session$.pipe(
      take(1),
      map(session => {
        if (!session) {
          router.navigate(['/auth/login'], { queryParams: authService.getLoginQueryParams() });
          return false;
        }

        if (allowedRoles.includes(session.role as UserRole)) {
          return true;
        }

        // Redirigir al dashboard correspondiente si no tiene permisos
        router.navigate(['/unauthorized']);
        return false;
      })
    );
  };
}

/**
 * Guard para SuperAdmin
 */
export const superAdminGuard: CanActivateFn = createRoleGuard([UserRole.SUPER_ADMIN]);

/**
 * Guard para Admin de Centro
 */
export const adminCentroGuard: CanActivateFn = createRoleGuard([UserRole.ADMIN_CENTRO]);

/**
 * Guard para Destinatarios
 */
export const destinatarioGuard: CanActivateFn = createRoleGuard([UserRole.DESTINATARIO]);

/**
 * Guard para SuperAdmin y Admin de Centro
 */
export const adminGuard: CanActivateFn = createRoleGuard([
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN_CENTRO
]);
