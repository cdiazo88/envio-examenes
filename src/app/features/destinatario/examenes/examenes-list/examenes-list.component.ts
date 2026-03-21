import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Examen, Entidad, Paciente } from '@core/models';
import { AuthService, DestinatarioService, ExamenService } from '@core/services';
import { forkJoin } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { formatRutChile, normalizeRut } from '@shared/utils/rut-chile.util';

@Component({
  selector: 'app-examenes-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6">
      <div class="mb-6">
        <h2 class="text-2xl font-bold text-gray-800">Mis Exámenes</h2>
        <p class="text-gray-600 mt-1">Exámenes disponibles para tu perfil</p>
      </div>

      <div *ngIf="!loading && !errorMessage && destinatarioTipo !== 'paciente'" class="mb-6">
        <div class="bg-white rounded-lg shadow p-4">
          <label for="rutFilter" class="block text-sm font-medium text-gray-700 mb-2">Filtrar por RUT, nombre o apellido del paciente</label>
          <input
            id="rutFilter"
            type="text"
            [(ngModel)]="rutFilter"
            (input)="applyRutFilter()"
            placeholder="Ej: 12.345.678-5 o Juan Pérez"
            class="form-input">
          <p class="text-sm text-gray-500 mt-2">
            Mostrando {{ filteredExamenes.length }} de {{ examenes.length }} exámenes
          </p>
        </div>
      </div>

      <div *ngIf="loading" class="flex justify-center items-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>

      <div *ngIf="!loading && errorMessage" class="alert alert-warning mb-6">
        {{ errorMessage }}
      </div>

      <div *ngIf="!loading && !errorMessage" class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div class="card">
          <p class="text-sm text-gray-500">Perfil</p>
          <p class="text-lg font-semibold text-gray-900">{{ destinatarioTipoLabel }}</p>
        </div>
        <div class="card">
          <p class="text-sm text-gray-500">{{ destinatarioTipo === 'entidad' ? 'Entidad' : 'Paciente' }}</p>
          <p class="text-lg font-semibold text-gray-900">{{ destinatarioNombre || 'No identificado' }}</p>
        </div>
        <div class="card">
          <p class="text-sm text-gray-500">Total exámenes</p>
          <p class="text-lg font-semibold text-gray-900">{{ examenes.length }}</p>
        </div>
      </div>

      <div *ngIf="!loading && !errorMessage && filteredExamenes.length === 0" class="bg-white rounded-lg shadow p-12 text-center">
        <h3 class="text-lg font-medium text-gray-900">No hay exámenes disponibles</h3>
        <p class="text-gray-500 mt-1">No hay resultados para el filtro actual o aún no existen exámenes para tu entidad.</p>
      </div>

      <div *ngIf="!loading && !errorMessage && filteredExamenes.length > 0" class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paciente</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RUT / CI</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo Examen</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha Realización</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Archivos</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr *ngFor="let examen of filteredExamenes" class="hover:bg-gray-50 transition-colors">
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ examen.destinatarioNombre }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ formatRut(examen.destinatarioDocumento || '') || 'No disponible' }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ examen.tipoExamen }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ getFecha(examen.fechaRealizacion || examen.fechaCreacion) }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <div class="flex items-center gap-3">
                  <span>{{ examen.archivos.length }} archivo(s)</span>
                  <button
                    type="button"
                    class="btn btn-outline btn-sm"
                    (click)="openImageViewer(examen)"
                    [disabled]="!hasImageFiles(examen)">
                    Imágenes
                  </button>
                  <button
                    type="button"
                    class="btn btn-secondary btn-sm"
                    (click)="openPdf(examen)"
                    [disabled]="!hasPdfFile(examen)">
                    PDF
                  </button>
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    (click)="downloadExamenFiles(examen)"
                    [disabled]="isDownloadingFiles(examen)">
                    {{ isDownloadingFiles(examen) ? 'Guardando...' : 'Guardar todo' }}
                  </button>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span class="badge" [ngClass]="getEstadoClass(examen.estado)">{{ getEstadoLabel(examen.estado) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div *ngIf="viewerOpen && selectedExamen && currentArchivo" class="fixed inset-0 z-50 bg-gray-900/70 flex items-center justify-center p-4">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
          <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 class="text-lg font-semibold text-gray-900">{{ selectedExamen.tipoExamen }}</h3>
              <p class="text-sm text-gray-500">
                {{ selectedExamen.destinatarioNombre }} · {{ currentFileIndex + 1 }} / {{ viewerArchivos.length }}
              </p>
            </div>
            <button type="button" class="text-gray-500 hover:text-gray-700" (click)="closeViewer()">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <div class="flex-1 bg-gray-100 flex items-center justify-center p-4 overflow-auto">
            <img
              *ngIf="currentArchivo"
              [src]="currentArchivo.url"
              [alt]="currentArchivo.nombre"
              class="max-h-full max-w-full object-contain rounded">
          </div>

          <div class="px-6 py-4 border-t border-gray-200 flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <button type="button" class="btn btn-outline" (click)="prevFile()" [disabled]="currentFileIndex === 0">Anterior</button>
              <button type="button" class="btn btn-outline" (click)="nextFile()" [disabled]="currentFileIndex >= viewerArchivos.length - 1">Siguiente</button>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-sm text-gray-600 truncate max-w-[320px]" [title]="currentArchivo.nombre">{{ currentArchivo.nombre }}</span>
              <button type="button" class="btn btn-secondary" (click)="downloadFile(currentArchivo.url, currentArchivo.nombre)">Descargar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ExamenesListComponent implements OnInit {
  loading = false;
  errorMessage = '';
  examenes: Examen[] = [];
  filteredExamenes: Examen[] = [];
  destinatarioTipo: 'paciente' | 'entidad' | 'desconocido' = 'desconocido';
  destinatarioNombre = '';
  rutFilter = '';
  viewerOpen = false;
  selectedExamen: Examen | null = null;
  viewerArchivos: Examen['archivos'] = [];
  currentFileIndex = 0;
  private downloadingExamIds = new Set<string>();

  constructor(
    private authService: AuthService,
    private destinatarioService: DestinatarioService,
    private examenService: ExamenService
  ) {}

  ngOnInit(): void {
    this.loadExamenesEntidad();
  }

  loadExamenesEntidad(): void {
    const session = this.authService.getCurrentSession();
    if (!session?.email) {
      this.errorMessage = 'No se pudo identificar la sesión actual.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    forkJoin({
      paciente: this.destinatarioService.getPacienteByEmail(session.email),
      entidad: this.destinatarioService.getEntidadByEmail(session.email)
    }).subscribe({
      next: ({ paciente, entidad }) => {
        if (entidad?.id) {
          this.loadAsEntidad(entidad, session.centroSaludId, session.uid);
          return;
        }

        if (paciente?.id) {
          this.loadAsPaciente(paciente, session.centroSaludId, session.uid);
          return;
        }

        this.errorMessage = 'No encontramos un paciente o entidad asociado a este correo.';
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al identificar destinatario:', error);
        this.errorMessage = 'No se pudo identificar el perfil destinatario.';
        this.loading = false;
      }
    });
  }

  private loadAsPaciente(paciente: Paciente, centroSaludId?: string, sessionUid?: string): void {
    if (!paciente.id) {
      this.errorMessage = 'No se pudo identificar el paciente.';
      this.loading = false;
      return;
    }

    this.destinatarioTipo = 'paciente';
    this.destinatarioNombre = `${paciente.nombre} ${paciente.apellido}`;

    this.examenService.getExamenesByAccessEmail(paciente.email).subscribe({
      next: (examenes) => {
        this.examenes = this.mergeExamenes(examenes)
          .map(examen => ({
            ...examen,
            destinatarioDocumento: examen.destinatarioDocumento || paciente.cedula
          }))
          .sort((a, b) => this.getSortTimestamp(b) - this.getSortTimestamp(a));

        this.applyRutFilter();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar exámenes de paciente:', error);
        this.errorMessage = 'No se pudieron cargar tus exámenes.';
        this.loading = false;
      }
    });
  }

  private loadAsEntidad(entidad: Entidad, centroSaludId?: string, sessionUid?: string): void {
    if (!entidad.id) {
      this.errorMessage = 'No se pudo identificar la entidad.';
      this.loading = false;
      return;
    }

    this.destinatarioTipo = 'entidad';
    this.destinatarioNombre = entidad.nombreEntidad;

    this.destinatarioService.getPacientesByEntidad(entidad.id).subscribe({
      next: (pacientesEntidad) => {
        const pacientesById = new Map(pacientesEntidad.filter(p => !!p.id).map(p => [p.id as string, p]));

        this.examenService.getExamenesByAccessEmail(entidad.email).subscribe({
          next: (examenes) => {
            this.examenes = this.mergeExamenes(examenes)
              .map(examen => {
                if (examen.destinatarioDocumento) {
                  return examen;
                }

                const paciente = pacientesById.get(examen.destinatarioId);
                return {
                  ...examen,
                  destinatarioDocumento: paciente?.cedula || examen.destinatarioDocumento
                };
              })
              .sort((a, b) => this.getSortTimestamp(b) - this.getSortTimestamp(a));

            this.applyRutFilter();
            this.loading = false;
          },
          error: (error) => {
            console.error('Error al cargar exámenes de entidad:', error);
            this.errorMessage = 'No se pudieron cargar los exámenes de la entidad.';
            this.loading = false;
          }
        });
      },
      error: (error) => {
        console.error('Error al cargar pacientes de entidad:', error);
        this.errorMessage = 'No se pudieron cargar los pacientes asociados de la entidad.';
        this.loading = false;
      }
    });
  }

  get destinatarioTipoLabel(): string {
    if (this.destinatarioTipo === 'paciente') return 'Paciente particular';
    if (this.destinatarioTipo === 'entidad') return 'Entidad';
    return 'No identificado';
  }

  applyRutFilter(): void {
    const term = this.normalizeSearchValue(this.rutFilter);
    const rutTerm = normalizeRut(this.rutFilter);

    if (!term) {
      this.filteredExamenes = this.examenes;
      return;
    }

    this.filteredExamenes = this.examenes.filter(examen => {
      const documento = this.normalizeSearchValue(examen.destinatarioDocumento || '');
      const documentoNormalized = normalizeRut(examen.destinatarioDocumento || '');
      const nombreCompleto = this.normalizeSearchValue(examen.destinatarioNombre || '');

      return (
        documento.includes(term) ||
        (rutTerm.length > 0 && documentoNormalized.includes(rutTerm)) ||
        nombreCompleto.includes(term)
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

  formatRut(value: string): string {
    return formatRutChile(value);
  }

  downloadFile(url: string, fileName: string): void {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async downloadExamenFiles(examen: Examen): Promise<void> {
    if (!examen.id || !examen.archivos?.length) {
      return;
    }

    this.downloadingExamIds.add(examen.id);

    try {
      const savedInFolder = await this.saveAllFilesToFolder(examen);
      if (!savedInFolder) {
        this.downloadAllFilesIndividually(examen);
        alert('No fue posible guardar en carpeta (restricción del navegador/CORS). Se inició la descarga individual de archivos.');
      }
    } finally {
      this.downloadingExamIds.delete(examen.id);
    }
  }

  isDownloadingFiles(examen: Examen): boolean {
    return !!examen.id && this.downloadingExamIds.has(examen.id);
  }

  openImageViewer(examen: Examen): void {
    const images = examen.archivos.filter(archivo => this.isImage(archivo.tipo));
    if (!images.length) return;

    this.selectedExamen = examen;
    this.viewerArchivos = images;
    this.currentFileIndex = 0;
    this.viewerOpen = true;
  }

  openPdf(examen: Examen): void {
    const pdf = examen.archivos.find(archivo => this.isPdf(archivo.tipo, archivo.nombre));
    if (!pdf) return;

    window.open(pdf.url, '_blank', 'noopener,noreferrer');
  }

  closeViewer(): void {
    this.viewerOpen = false;
    this.selectedExamen = null;
    this.viewerArchivos = [];
    this.currentFileIndex = 0;
  }

  prevFile(): void {
    if (this.currentFileIndex > 0) {
      this.currentFileIndex--;
    }
  }

  nextFile(): void {
    if (this.currentFileIndex < this.viewerArchivos.length - 1) {
      this.currentFileIndex++;
    }
  }

  get currentArchivo() {
    if (!this.viewerArchivos?.length) return null;
    return this.viewerArchivos[this.currentFileIndex] || null;
  }

  isImage(tipo: string): boolean {
    return tipo.startsWith('image/');
  }

  isPdf(tipo: string, nombre: string): boolean {
    return tipo === 'application/pdf' || nombre.toLowerCase().endsWith('.pdf');
  }

  hasImageFiles(examen: Examen): boolean {
    return examen.archivos.some(archivo => this.isImage(archivo.tipo));
  }

  hasPdfFile(examen: Examen): boolean {
    return examen.archivos.some(archivo => this.isPdf(archivo.tipo, archivo.nombre));
  }

  private buildDownloadEntryName(originalName: string, index: number): string {
    const dotIndex = originalName.lastIndexOf('.');
    const extension = dotIndex >= 0 ? originalName.slice(dotIndex) : '';
    const baseName = dotIndex >= 0 ? originalName.slice(0, dotIndex) : originalName;
    const safeName = this.sanitizeFileName(baseName) || `archivo_${index + 1}`;
    return `${String(index + 1).padStart(2, '0')}_${safeName}${extension}`;
  }

  private buildDownloadFolderName(examen: Examen): string {
    const destinatario = this.sanitizeFileName(examen.destinatarioNombre || 'destinatario');
    const fecha = this.formatDateForFileName(examen.fechaRealizacion || examen.fechaCreacion || examen.fechaActualizacion);
    return `${destinatario}_${fecha}`;
  }

  private formatDateForFileName(value: unknown): string {
    const date = this.parseDate(value);
    if (!date) {
      return 'sin_fecha';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private sanitizeFileName(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
  }

  private downloadAllFilesIndividually(examen: Examen): void {
    if (!examen.archivos?.length) {
      return;
    }

    examen.archivos.forEach((archivo, index) => {
      setTimeout(() => {
        this.downloadFile(archivo.url, this.buildDownloadEntryName(archivo.nombre, index));
      }, index * 200);
    });
  }

  private async saveAllFilesToFolder(examen: Examen): Promise<boolean> {
    const directoryPicker = (window as any).showDirectoryPicker;
    if (typeof directoryPicker !== 'function') {
      return false;
    }

    try {
      const rootDir = await directoryPicker({ mode: 'readwrite' });
      const examDir = await rootDir.getDirectoryHandle(this.buildDownloadFolderName(examen), { create: true });
      const failedFiles: string[] = [];
      let savedFiles = 0;

      for (let index = 0; index < examen.archivos.length; index += 1) {
        const archivo = examen.archivos[index];
        const fileName = this.buildDownloadEntryName(archivo.nombre, index);

        try {
          const response = await fetch(archivo.url);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const blob = await response.blob();
          const fileHandle = await examDir.getFileHandle(fileName, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          savedFiles += 1;
        } catch (error) {
          if (savedFiles === 0 || this.isFetchBlockedError(error)) {
            console.warn('Guardado en carpeta no disponible para este origen/archivo. Se aplicará fallback de descarga individual.');
            return false;
          }

          console.error(`No se pudo guardar el archivo ${fileName} en carpeta`, error);
          failedFiles.push(fileName);
        }
      }

      if (failedFiles.length > 0) {
        alert(`Se guardaron archivos con errores parciales. Fallaron ${failedFiles.length} archivo(s).`);
      } else {
        alert('Todos los archivos del examen se guardaron correctamente en la carpeta seleccionada.');
      }

      return true;
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        return true;
      }

      console.error('No se pudo guardar en carpeta, se usará descarga individual.', error);
      return false;
    }
  }

  private isFetchBlockedError(error: unknown): boolean {
    return error instanceof TypeError;
  }

  getFecha(value: unknown): string {
    const date = this.parseDate(value);
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
    if (estado === 'listo') return 'badge-success';
    if (estado === 'pendiente') return 'badge-warning';
    if (estado === 'notificado') return 'badge-info';
    return 'badge-success';
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

  private getSortTimestamp(examen: Examen): number {
    return (
      this.parseDate(examen.fechaActualizacion)?.getTime() ||
      this.parseDate(examen.fechaRealizacion)?.getTime() ||
      this.parseDate(examen.fechaCreacion)?.getTime() ||
      0
    );
  }

  private mergeExamenes(examenes: Examen[]): Examen[] {
    const byId = new Map<string, Examen>();

    examenes.forEach(examen => {
      if (!examen?.id) return;

      const current = byId.get(examen.id);
      if (!current) {
        byId.set(examen.id, examen);
        return;
      }

      const currentScore = this.getSortTimestamp(current);
      const newScore = this.getSortTimestamp(examen);
      if (newScore >= currentScore) {
        byId.set(examen.id, examen);
      }
    });

    return Array.from(byId.values());
  }
}
