import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/services';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div class="text-center">
        <div class="inline-flex items-center justify-center w-24 h-24 bg-danger-100 rounded-full mb-6">
          <svg class="w-16 h-16 text-danger-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
        </div>
        <h1 class="text-4xl font-bold text-gray-900 mb-4">Acceso Denegado</h1>
        <p class="text-lg text-gray-600 mb-8">No tienes permisos para acceder a esta página</p>
        <a
          routerLink="/auth/login"
          [queryParams]="loginQueryParams"
          class="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
        >
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          Volver al inicio
        </a>
      </div>
    </div>
  `
})
export class UnauthorizedComponent {
  private authService = inject(AuthService);
  loginQueryParams = this.authService.getLoginQueryParams();
}
