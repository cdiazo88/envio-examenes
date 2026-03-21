import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '@core/services';

export interface NavLink {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent {
  authService = inject(AuthService);
  private router = inject(Router);

  @Input() title = 'Resultado de Exámenes';
  @Input() links: NavLink[] = [];

  session$ = this.authService.session$;
  pacienteSessionRemainingSeconds$ = this.authService.pacienteSessionRemainingSeconds$;
  menuOpen = false;

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  async logout(): Promise<void> {
    await this.authService.logout();
  }

  formatRemainingTime(totalSeconds: number | null): string {
    if (totalSeconds === null || totalSeconds < 0) {
      return '';
    }

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}
