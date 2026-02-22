import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService, DestinatarioService, ExamenService } from '@core/services';
import { EstadoExamen, Examen } from '@core/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">Dashboard Admin Centro</h1>
        <p class="mt-2 text-gray-600">Resumen operativo de pacientes, entidades y exámenes</p>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" *ngIf="!loading && !errorMessage">
        <div class="rounded-lg bg-white p-5 shadow">
          <p class="text-sm text-gray-500">Pacientes totales</p>
          <p class="mt-2 text-3xl font-semibold text-gray-900">{{ pacientesCount }}</p>
        </div>

        <div class="rounded-lg bg-white p-5 shadow">
          <p class="text-sm text-gray-500">Pacientes particulares</p>
          <p class="mt-2 text-3xl font-semibold text-gray-900">{{ pacientesParticularesCount }}</p>
        </div>

        <div class="rounded-lg bg-white p-5 shadow">
          <p class="text-sm text-gray-500">Entidades activas</p>
          <p class="mt-2 text-3xl font-semibold text-gray-900">{{ entidadesActivasCount }}</p>
        </div>

        <div class="rounded-lg bg-white p-5 shadow">
          <p class="text-sm text-gray-500">Exámenes del mes</p>
          <p class="mt-2 text-3xl font-semibold text-gray-900">{{ examenesMesCount }}</p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3" *ngIf="!loading && !errorMessage">
        <section class="rounded-lg bg-white shadow lg:col-span-2">
          <div class="border-b border-gray-200 px-6 py-4">
            <h2 class="text-xl font-semibold text-gray-900">Actividad reciente</h2>
          </div>

          <div class="overflow-x-auto" *ngIf="recientes.length > 0; else emptyActivity">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Destinatario</th>
                  <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Tipo examen</th>
                  <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Fecha</th>
                  <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Estado</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 bg-white">
                <tr *ngFor="let examen of recientes">
                  <td class="px-6 py-4 text-sm font-medium text-gray-900">{{ examen.destinatarioNombre }}</td>
                  <td class="px-6 py-4 text-sm text-gray-600">{{ examen.tipoExamen }}</td>
                  <td class="px-6 py-4 text-sm text-gray-600">{{ getExamenDate(examen) | date : 'dd/MM/yyyy' }}</td>
                  <td class="px-6 py-4">
                    <span class="inline-flex rounded-full px-2 py-1 text-xs font-semibold" [class]="getEstadoBadgeClass(examen.estado)">
                      {{ getEstadoLabel(examen.estado) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <ng-template #emptyActivity>
            <div class="px-6 py-8 text-sm text-gray-500">Aún no hay exámenes registrados en este centro.</div>
          </ng-template>
        </section>

        <section class="space-y-6">
          <div class="rounded-lg bg-white p-5 shadow">
            <h2 class="text-lg font-semibold text-gray-900">Seguimiento de exámenes</h2>
            <div class="mt-4 space-y-3">
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-600">Listos</span>
                <span class="font-semibold text-gray-900">{{ examenesListosCount }}</span>
              </div>
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-600">Notificados</span>
                <span class="font-semibold text-gray-900">{{ examenesNotificadosCount }}</span>
              </div>
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-600">Visualizados</span>
                <span class="font-semibold text-gray-900">{{ examenesVisualizadosCount }}</span>
              </div>
            </div>
            <div class="mt-4 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">
              Ratio visualización: <span class="font-semibold text-gray-900">{{ visualizadosRatio }}%</span>
            </div>
          </div>

          <div class="rounded-lg bg-white p-5 shadow">
            <h2 class="text-lg font-semibold text-gray-900">Acciones rápidas</h2>
            <div class="mt-4 grid grid-cols-1 gap-3">
              <a routerLink="/admin-centro/pacientes/crear" class="rounded-lg bg-primary-50 px-4 py-3 text-sm font-medium text-primary-700 transition hover:bg-primary-100">
                Registrar paciente
              </a>
              <a routerLink="/admin-centro/entidades/crear" class="rounded-lg bg-secondary-50 px-4 py-3 text-sm font-medium text-secondary-700 transition hover:bg-secondary-100">
                Registrar entidad
              </a>
              <a routerLink="/admin-centro/examenes/nuevo" class="rounded-lg bg-gray-100 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-200">
                Cargar nuevo examen
              </a>
            </div>
          </div>
        </section>
      </div>

      <div *ngIf="loading" class="flex items-center justify-center py-16">
        <svg class="h-10 w-10 animate-spin text-primary-600" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
      </div>

      <div *ngIf="!loading && errorMessage" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {{ errorMessage }}
      </div>
    </div>
  `
})
export class DashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private destinatarioService = inject(DestinatarioService);
  private examenService = inject(ExamenService);

  readonly estadoExamen = EstadoExamen;

  loading = true;
  errorMessage = '';

  pacientesCount = 0;
  pacientesParticularesCount = 0;
  entidadesActivasCount = 0;
  examenesMesCount = 0;
  examenesListosCount = 0;
  examenesNotificadosCount = 0;
  examenesVisualizadosCount = 0;

  recientes: Examen[] = [];

  ngOnInit(): void {
    this.loadDashboardData();
  }

  private loadDashboardData(): void {
    this.loading = true;
    this.errorMessage = '';

    const centroSaludId = this.authService.getCurrentCentroSaludId();

    if (!centroSaludId) {
      this.errorMessage = 'No se pudo identificar el centro de salud de la sesión.';
      this.loading = false;
      return;
    }

    forkJoin({
      pacientes: this.destinatarioService.getPacientesByCentro(centroSaludId),
      entidades: this.destinatarioService.getEntidadesByCentro(centroSaludId),
      examenes: this.examenService.getExamenesByCentro(centroSaludId)
    }).subscribe({
      next: ({ pacientes, entidades, examenes }) => {
        const now = new Date();

        this.pacientesCount = pacientes.length;
        this.pacientesParticularesCount = pacientes.filter(paciente => !paciente.entidadId).length;
        this.entidadesActivasCount = entidades.filter(entidad => entidad.activo).length;

        this.examenesMesCount = examenes.filter(examen => {
          const fecha = this.toDate(examen.fechaRealizacion) || this.toDate(examen.fechaCreacion);
          return !!fecha && fecha.getFullYear() === now.getFullYear() && fecha.getMonth() === now.getMonth();
        }).length;

        this.examenesListosCount = examenes.filter(examen => examen.estado === EstadoExamen.LISTO).length;
        this.examenesNotificadosCount = examenes.filter(examen => examen.estado === EstadoExamen.NOTIFICADO).length;
        this.examenesVisualizadosCount = examenes.filter(examen => examen.estado === EstadoExamen.VISUALIZADO).length;

        this.recientes = examenes.slice(0, 6);
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar dashboard de admin centro:', error);
        this.errorMessage = 'No se pudo cargar el resumen del dashboard. Intenta nuevamente.';
        this.loading = false;
      }
    });
  }

  get totalSeguimiento(): number {
    return this.examenesListosCount + this.examenesNotificadosCount + this.examenesVisualizadosCount;
  }

  get visualizadosRatio(): number {
    if (!this.totalSeguimiento) return 0;
    return Math.round((this.examenesVisualizadosCount / this.totalSeguimiento) * 100);
  }

  getEstadoBadgeClass(estado: string): string {
    if (estado === EstadoExamen.VISUALIZADO) return 'bg-secondary-100 text-secondary-700';
    if (estado === EstadoExamen.NOTIFICADO) return 'bg-primary-100 text-primary-700';
    if (estado === EstadoExamen.LISTO) return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-700';
  }

  getEstadoLabel(estado: string): string {
    if (estado === EstadoExamen.VISUALIZADO) return 'Visualizado';
    if (estado === EstadoExamen.NOTIFICADO) return 'Notificado';
    if (estado === EstadoExamen.LISTO) return 'Listo';
    return estado;
  }

  getExamenDate(examen: Examen): Date | null {
    return this.toDate(examen.fechaRealizacion) || this.toDate(examen.fechaCreacion);
  }

  private toDate(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

    if (
      typeof value === 'object' &&
      value !== null &&
      'toDate' in value &&
      typeof (value as { toDate: unknown }).toDate === 'function'
    ) {
      const parsed = (value as { toDate: () => Date }).toDate();
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
  }
}
