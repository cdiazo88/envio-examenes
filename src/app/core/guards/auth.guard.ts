import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '@core/services';
import { map, take } from 'rxjs/operators';

/**
 * Guard funcional para proteger rutas que requieren autenticación
 * Redirige a /auth/login si el usuario no está autenticado
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.session$.pipe(
    take(1),
    map(session => {
      if (session) {
        return true;
      }
      router.navigate(['/auth/login']);
      return false;
    })
  );
};

/**
 * Guard funcional para evitar que usuarios autenticados accedan a páginas de auth
 * Redirige al dashboard correspondiente si está autenticado
 */
export const noAuthGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.session$.pipe(
    take(1),
    map(session => {
      if (!session) {
        return true;
      }

      // Redirigir según el rol
      switch (session.role) {
        case 'super_admin':
          router.navigate(['/super-admin']);
          break;
        case 'admin_centro':
          router.navigate(['/admin-centro']);
          break;
        case 'destinatario':
          router.navigate(['/destinatario']);
          break;
        default:
          router.navigate(['/']);
      }
      return false;
    })
  );
};
