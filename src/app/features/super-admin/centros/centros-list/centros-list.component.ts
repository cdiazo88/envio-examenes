import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { CentroSaludService } from '@core/services';
import { CentroSalud } from '@core/models';
import { filter, Subscription, firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-centros-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './centros-list.component.html',
  styleUrls: ['./centros-list.component.scss']
})
export class CentrosListComponent implements OnInit, OnDestroy {
  centros: CentroSalud[] = [];
  loading = false;
  centroToDelete: CentroSalud | null = null;
  showDeleteModal = false;
  private routerSubscription?: Subscription;

  constructor(
    private centroSaludService: CentroSaludService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCentros();

    // Escuchar eventos de navegación para recargar cuando volvemos a esta ruta
    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      if (event.url === '/super-admin/centros') {
        this.loadCentros();
      }
    });
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
  }

  loadCentros(): void {
    this.loading = true;
    this.centroSaludService.getCentros().subscribe({
      next: (centros) => {
        this.centros = centros;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar centros:', error);
        this.loading = false;
      }
    });
  }

  navigateToCreate(): void {
    this.router.navigate(['/super-admin/centros/crear']);
  }

  navigateToEdit(id: string): void {
    this.router.navigate(['/super-admin/centros/editar', id]);
  }

  navigateToExamenes(id: string): void {
    this.router.navigate(['/super-admin/centros', id, 'examenes']);
  }

  openDeleteModal(centro: CentroSalud): void {
    this.centroToDelete = centro;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.centroToDelete = null;
  }

  async confirmDelete(): Promise<void> {
    if (!this.centroToDelete?.id) return;

    try {
      await this.centroSaludService.deleteCentro(this.centroToDelete.id);
      this.loadCentros();
      this.closeDeleteModal();
    } catch (error) {
      console.error('Error al eliminar centro:', error);
      alert('Error al eliminar el centro de salud');
    }
  }

  async toggleActivo(centro: CentroSalud): Promise<void> {
    if (!centro.id) return;

    // Actualización optimista: cambiar el estado localmente de inmediato
    const estadoAnterior = centro.activo;
    centro.activo = !centro.activo;

    try {
      await firstValueFrom(this.centroSaludService.updateCentro(centro.id, {
        activo: centro.activo
      }));
    } catch (error) {
      // Si falla, revertir el cambio local
      centro.activo = estadoAnterior;
      console.error('Error al actualizar estado:', error);
      alert('Error al actualizar el estado del centro');
    }
  }
}
