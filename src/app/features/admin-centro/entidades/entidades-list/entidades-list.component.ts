import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { DestinatarioService, AuthService } from '@core/services';
import { Entidad } from '@core/models';
import { CredentialsModalComponent } from '@shared/components/credentials-modal/credentials-modal.component';
import { filter, Subscription } from 'rxjs';

@Component({
  selector: 'app-entidades-list',
  standalone: true,
  imports: [CommonModule, RouterModule, CredentialsModalComponent],
  templateUrl: './entidades-list.component.html',
  styleUrls: ['./entidades-list.component.scss']
})
export class EntidadesListComponent implements OnInit, OnDestroy {
  entidades: Entidad[] = [];
  loading = false;
  showDeleteModal = false;
  showCredentialsModal = false;
  entidadToDelete: Entidad | null = null;
  credentialsNombre = '';
  credentialsEmail = '';
  credentialsPassword = '';
  credentialsWarning = '';
  private routerSubscription?: Subscription;

  constructor(
    private destinatarioService: DestinatarioService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadEntidades();

    // Escuchar eventos de navegación para recargar cuando volvemos a esta ruta
    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      if (event.url === '/admin-centro/entidades') {
        this.loadEntidades();
      }
    });
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
  }

  loadEntidades(): void {
    const session = this.authService.getCurrentSession();
    if (!session?.centroSaludId) return;

    this.loading = true;
    this.destinatarioService.getEntidadesByCentro(session.centroSaludId).subscribe({
      next: (entidades) => {
        this.entidades = entidades;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar entidades:', error);
        this.loading = false;
      }
    });
  }

  verCredenciales(entidad: Entidad): void {
    if (entidad.credencialesGeneradas && entidad.passwordTemporal) {
      this.credentialsNombre = entidad.nombreEntidad;
      this.credentialsEmail = entidad.email;
      this.credentialsPassword = entidad.passwordTemporal;
      this.credentialsWarning = 'La entidad puede ingresar con estas credenciales para ver los exámenes de sus empleados o pacientes asociados.';
      this.showCredentialsModal = true;
    }
  }

  closeCredentialsModal(): void {
    this.showCredentialsModal = false;
  }

  navigateToCreate(): void {
    this.router.navigate(['/admin-centro/entidades/crear']);
  }

  navigateToEdit(id: string): void {
    this.router.navigate(['/admin-centro/entidades/editar', id]);
  }

  openDeleteModal(entidad: Entidad): void {
    this.entidadToDelete = entidad;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.entidadToDelete = null;
  }

  async confirmDelete(): Promise<void> {
    if (!this.entidadToDelete?.id) return;

    try {
      await this.destinatarioService.deleteEntidad(this.entidadToDelete.id);
      this.loadEntidades();
      this.closeDeleteModal();
    } catch (error) {
      console.error('Error al eliminar entidad:', error);
      alert('Error al eliminar la entidad');
    }
  }
}
