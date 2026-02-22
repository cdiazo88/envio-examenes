import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div class="text-center">
        <h1 class="text-9xl font-bold text-primary-600 mb-4">404</h1>
        <h2 class="text-3xl font-semibold text-gray-900 mb-4">Página No Encontrada</h2>
        <p class="text-lg text-gray-600 mb-8">La página que buscas no existe o ha sido movida</p>
        <a
          routerLink="/auth/login"
          class="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
        >
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
          </svg>
          Ir al inicio
        </a>
      </div>
    </div>
  `
})
export class NotFoundComponent {}
