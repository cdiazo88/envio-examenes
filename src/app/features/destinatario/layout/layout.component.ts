import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent, NavLink } from '@app/shared/components/navbar/navbar.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent],
  template: `
    <div class="min-h-screen bg-gray-50">
      <app-navbar title="Portal Destinatario" [links]="navLinks" />
      <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <router-outlet />
      </main>
    </div>
  `
})
export class LayoutComponent {
  navLinks: NavLink[] = [
    {
      path: '/destinatario/examenes',
      label: 'Mis Exámenes',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
    }
  ];
}
