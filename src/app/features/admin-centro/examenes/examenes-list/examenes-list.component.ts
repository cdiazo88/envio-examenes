import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ExamenService, AuthService } from '@core/services';
import { Examen } from '@core/models';

@Component({
  selector: 'app-examenes-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="p-6">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h2 class="text-2xl font-bold text-gray-800">Exámenes</h2>
          <p class="text-gray-600 mt-1">Gestiona exámenes cargados por paciente (particular o asociado a entidad)</p>
        </div>
        <button (click)="navigateToCreate()" class="btn btn-primary flex items-center gap-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Nuevo Examen
        </button>
      </div>

      <div *ngIf="!loading && examenes.length > 0" class="mb-6">
        <div class="bg-white rounded-lg shadow p-4">
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </div>
            <input
              type="text"
              [(ngModel)]="searchTerm"
              (input)="filtrarExamenes()"
              placeholder="Buscar por paciente, CI/RUT o tipo de examen..."
              class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm">
          </div>
          <p class="text-sm text-gray-500 mt-2">
            Mostrando {{ examenesFiltrados.length }} de {{ examenes.length }} exámenes
          </p>
        </div>
      </div>

      <div *ngIf="loading" class="flex justify-center items-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>

      <div *ngIf="!loading && examenes.length === 0" class="bg-white rounded-lg shadow p-12 text-center">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2h-3l-1-2H9L8 5H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
        </svg>
        <h3 class="mt-4 text-lg font-medium text-gray-900">No hay exámenes cargados</h3>
        <p class="mt-1 text-gray-500">Comienza cargando el primer examen para un paciente</p>
        <button (click)="navigateToCreate()" class="mt-6 btn btn-primary">Cargar Primer Examen</button>
      </div>

      <div *ngIf="!loading && examenes.length > 0" class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paciente</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CI / RUT</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo Examen</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha Realización</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Archivos</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr *ngFor="let examen of examenesFiltrados" class="hover:bg-gray-50 transition-colors">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">{{ examen.destinatarioNombre }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">{{ examen.destinatarioDocumento || 'No registrado' }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">{{ examen.tipoExamen }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">{{ getFecha(examen.fechaRealizacion) }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">{{ examen.archivos.length }} archivo(s)</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span [class]="getEstadoClass(examen.estado)">{{ getEstadoLabel(examen.estado) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class ExamenesListComponent implements OnInit {
  examenes: Examen[] = [];
  examenesFiltrados: Examen[] = [];
  loading = false;
  searchTerm = '';

  constructor(
    private examenService: ExamenService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadExamenes();
  }

  loadExamenes(): void {
    const session = this.authService.getCurrentSession();
    if (!session?.centroSaludId) return;

    this.loading = true;
    this.examenService.getExamenesByCentro(session.centroSaludId).subscribe({
      next: (examenes) => {
        this.examenes = examenes;
        this.examenesFiltrados = examenes;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar exámenes:', error);
        this.loading = false;
      }
    });
  }

  filtrarExamenes(): void {
    const term = this.searchTerm.toLowerCase().trim();
    if (!term) {
      this.examenesFiltrados = this.examenes;
      return;
    }

    this.examenesFiltrados = this.examenes.filter(examen => {
      const nombre = examen.destinatarioNombre.toLowerCase();
      const documento = (examen.destinatarioDocumento || '').toLowerCase();
      const tipoExamen = examen.tipoExamen.toLowerCase();

      return nombre.includes(term) || documento.includes(term) || tipoExamen.includes(term);
    });
  }

  navigateToCreate(): void {
    this.router.navigate(['/admin-centro/examenes/nuevo']);
  }

  getFecha(dateValue: unknown): string {
    const date = this.parseDate(dateValue);
    return date ? date.toLocaleDateString('es-EC') : 'No disponible';
  }

  getEstadoLabel(estado: string): string {
    if (estado === 'listo') return 'Listo';
    if (estado === 'pendiente') return 'Pendiente';
    if (estado === 'notificado') return 'Notificado';
    if (estado === 'visualizado') return 'Visualizado';
    if (estado === 'descargado') return 'Descargado';
    return estado;
  }

  getEstadoClass(estado: string): string {
    if (estado === 'listo') return 'badge badge-success';
    if (estado === 'pendiente') return 'badge badge-warning';
    if (estado === 'notificado') return 'badge badge-info';
    if (estado === 'visualizado') return 'badge badge-primary';
    if (estado === 'descargado') return 'badge badge-secondary';
    return 'badge';
  }

  private parseDate(value: unknown): Date | null {
    if (!value) return null;

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

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
