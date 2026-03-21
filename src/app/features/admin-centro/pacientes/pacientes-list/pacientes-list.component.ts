import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { DestinatarioService, AuthService } from '@core/services';
import { Paciente, Entidad } from '@core/models';
import { CredentialsModalComponent } from '@shared/components/credentials-modal/credentials-modal.component';
import { formatRutChile, normalizeRut } from '@shared/utils/rut-chile.util';
import { filter, firstValueFrom, Subscription } from 'rxjs';

@Component({
  selector: 'app-pacientes-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, CredentialsModalComponent],
  templateUrl: './pacientes-list.component.html',
  styleUrls: ['./pacientes-list.component.scss']
})
export class PacientesListComponent implements OnInit, OnDestroy {
  pacientes: Paciente[] = [];
  pacientesFiltrados: Paciente[] = [];
  entidades: Entidad[] = [];
  loading = false;
  showDeleteModal = false;
  showCredentialsModal = false;
  pacienteToDelete: Paciente | null = null;
  credentialsNombre = '';
  credentialsEmail = '';
  credentialsPassword = '';
  credentialsWarning = '';
  searchTerm: string = '';
  private routerSubscription?: Subscription;

  constructor(
    private destinatarioService: DestinatarioService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadPacientes();
    this.loadEntidades();

    // Escuchar eventos de navegación para recargar cuando volvemos a esta ruta
    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      if (event.url === '/admin-centro/pacientes') {
        this.loadPacientes();
      }
    });
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
  }

  loadPacientes(): void {
    const session = this.authService.getCurrentSession();
    if (!session?.centroSaludId) return;

    this.loading = true;
    this.destinatarioService.getPacientesByCentro(session.centroSaludId).subscribe({
      next: (pacientes) => {
        this.pacientes = pacientes;
        this.pacientesFiltrados = pacientes;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar pacientes:', error);
        this.loading = false;
      }
    });
  }

  loadEntidades(): void {
    const session = this.authService.getCurrentSession();
    if (!session?.centroSaludId) return;

    this.destinatarioService.getEntidadesByCentro(session.centroSaludId).subscribe({
      next: (entidades) => {
        this.entidades = entidades;
      },
      error: (error) => {
        console.error('Error al cargar entidades:', error);
      }
    });
  }

  getTipoPaciente(paciente: Paciente): string {
    if (!paciente.entidadId) {
      return 'Particular';
    }
    const entidad = this.entidades.find(e => e.id === paciente.entidadId);
    return entidad?.nombreEntidad || 'Entidad no encontrada';
  }

  verCredenciales(paciente: Paciente): void {
    if (paciente.credencialesGeneradas && paciente.passwordTemporal) {
      this.credentialsNombre = `${paciente.nombre} ${paciente.apellido}`;
      this.credentialsEmail = paciente.email;
      this.credentialsPassword = paciente.passwordTemporal;
      this.credentialsWarning = 'El paciente puede ingresar con estas credenciales para ver sus exámenes.';
      this.showCredentialsModal = true;
    }
  }

  closeCredentialsModal(): void {
    this.showCredentialsModal = false;
  }

  filtrarPacientes(): void {
    const term = this.normalizeSearchValue(this.searchTerm);
    const rutTerm = normalizeRut(this.searchTerm);
    
    if (!term) {
      this.pacientesFiltrados = this.pacientes;
      return;
    }

    this.pacientesFiltrados = this.pacientes.filter(paciente => {
      const nombreCompleto = this.normalizeSearchValue(`${paciente.nombre} ${paciente.apellido}`);
      const cedula = this.normalizeSearchValue(paciente.cedula || '');
      const cedulaNormalized = normalizeRut(paciente.cedula);

      return (
        nombreCompleto.includes(term) ||
        cedula.includes(term) ||
        (rutTerm.length > 0 && cedulaNormalized.includes(rutTerm))
      );
    });
  }

  private normalizeSearchValue(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  navigateToCreate(): void {
    this.router.navigate(['/admin-centro/pacientes/crear']);
  }

  navigateToEdit(id: string): void {
    this.router.navigate(['/admin-centro/pacientes/editar', id]);
  }

  navigateToCreateExamen(pacienteId: string): void {
    this.router.navigate(['/admin-centro/examenes/nuevo'], {
      queryParams: { pacienteId }
    });
  }

  openDeleteModal(paciente: Paciente): void {
    this.pacienteToDelete = paciente;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.pacienteToDelete = null;
  }

  async confirmDelete(): Promise<void> {
    if (!this.pacienteToDelete?.id) return;

    try {
      await firstValueFrom(this.destinatarioService.deletePaciente(this.pacienteToDelete.id));
      this.loadPacientes();
      this.closeDeleteModal();
    } catch (error) {
      console.error('Error al eliminar paciente:', error);
      alert('Error al eliminar el paciente');
    }
  }

  getEdad(fechaNacimiento: unknown): string {
    const fecha = this.parseFechaNacimiento(fechaNacimiento);
    if (!fecha) return 'Edad no disponible';

    const hoy = new Date();
    let edad = hoy.getFullYear() - fecha.getFullYear();
    const mes = hoy.getMonth() - fecha.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < fecha.getDate())) {
      edad--;
    }

    return `${edad} años`;
  }

  private parseFechaNacimiento(fechaNacimiento: unknown): Date | null {
    if (!fechaNacimiento) return null;

    if (fechaNacimiento instanceof Date) {
      return Number.isNaN(fechaNacimiento.getTime()) ? null : fechaNacimiento;
    }

    if (
      typeof fechaNacimiento === 'object' &&
      fechaNacimiento !== null &&
      'toDate' in fechaNacimiento &&
      typeof (fechaNacimiento as { toDate: unknown }).toDate === 'function'
    ) {
      const dateValue = (fechaNacimiento as { toDate: () => Date }).toDate();
      return Number.isNaN(dateValue.getTime()) ? null : dateValue;
    }

    if (typeof fechaNacimiento === 'string' || typeof fechaNacimiento === 'number') {
      const dateValue = new Date(fechaNacimiento);
      return Number.isNaN(dateValue.getTime()) ? null : dateValue;
    }

    return null;
  }

  formatRut(value: string): string {
    return formatRutChile(value);
  }
}
