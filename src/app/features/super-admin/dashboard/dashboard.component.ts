import { Component,OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CentroSaludService } from '@core/services';
import { CentroSalud } from '@core/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  private centroService = inject(CentroSaludService);

  centros: CentroSalud[] = [];
  loading = true;

  ngOnInit(): void {
    this.loadCentros();
  }

  loadCentros(): void {
    this.centroService.getAllCentros().subscribe({
      next: (centros) => {
        this.centros = centros;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error cargando centros:', error);
        this.loading = false;
      }
    });
  }

  get totalCentros(): number {
    return this.centros.length;
  }

  get centrosActivos(): number {
    return this.centros.filter(c => c.activo).length;
  }

  get centrosInactivos(): number {
    return this.centros.filter(c => !c.activo).length;
  }
}
