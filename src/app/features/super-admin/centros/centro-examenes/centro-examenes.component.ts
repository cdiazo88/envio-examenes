import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CatalogoExamenCentroService, CentroSaludService } from '@core/services';
import { CatalogoExamenCentro, CentroSalud } from '@core/models';

@Component({
  selector: 'app-centro-examenes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="p-6 space-y-6">
      <div>
        <div class="flex items-center gap-2 text-sm text-gray-600 mb-2">
          <a routerLink="/super-admin/centros" class="hover:text-primary-600">Centros</a>
          <span>/</span>
          <span class="text-gray-900">Catálogo de exámenes</span>
        </div>
        <h2 class="text-2xl font-bold text-gray-800">Tipos de examen por centro</h2>
        <p class="text-gray-600 mt-1" *ngIf="centro">{{ centro.nombre }}</p>
      </div>

      <div class="bg-white rounded-lg shadow p-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">Nuevo tipo de examen</label>
        <div class="flex gap-2">
          <input
            type="text"
            class="form-input"
            [(ngModel)]="nuevoTipo"
            (keyup.enter)="agregarTipo()"
            placeholder="Ej: Perfil tiroideo">
          <button class="btn btn-primary" (click)="agregarTipo()" [disabled]="loading || !nuevoTipo.trim()">
            Agregar
          </button>
        </div>
      </div>

      <div *ngIf="loading" class="flex justify-center items-center py-10">
        <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>

      <div *ngIf="!loading && catalogo.length === 0" class="bg-white rounded-lg shadow p-8 text-center text-gray-500">
        Este centro aún no tiene tipos de examen configurados.
      </div>

      <div *ngIf="!loading && catalogo.length > 0" class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr *ngFor="let item of catalogo">
              <td class="px-6 py-4 text-sm text-gray-900">{{ item.nombre }}</td>
              <td class="px-6 py-4">
                <button
                  class="px-2 py-1 rounded-full text-xs font-semibold"
                  [class]="item.activo ? 'bg-secondary-100 text-secondary-700' : 'bg-gray-100 text-gray-700'"
                  (click)="toggleActivo(item)">
                  {{ item.activo ? 'Activo' : 'Inactivo' }}
                </button>
              </td>
              <td class="px-6 py-4 text-right">
                <button class="text-red-600 hover:text-red-800 text-sm font-medium" (click)="eliminar(item)">
                  Eliminar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class CentroExamenesComponent implements OnInit {
  centroId = '';
  centro: CentroSalud | null = null;
  catalogo: CatalogoExamenCentro[] = [];
  nuevoTipo = '';
  loading = false;

  constructor(
    private route: ActivatedRoute,
    private centroService: CentroSaludService,
    private catalogoService: CatalogoExamenCentroService
  ) {}

  ngOnInit(): void {
    this.centroId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.centroId) return;
    this.cargarCentro();
    this.cargarCatalogo();
  }

  async cargarCentro(): Promise<void> {
    this.centro = await firstValueFrom(this.centroService.getCentroById(this.centroId));
  }

  cargarCatalogo(): void {
    this.loading = true;
    this.catalogoService.getByCentro(this.centroId).subscribe({
      next: (catalogo) => {
        this.catalogo = catalogo;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error cargando catálogo de exámenes:', error);
        this.loading = false;
      }
    });
  }

  agregarTipo(): void {
    const nombre = this.nuevoTipo.trim();
    if (!nombre) return;

    const existe = this.catalogo.some(item => item.nombre.toLowerCase() === nombre.toLowerCase());
    if (existe) {
      alert('Este tipo de examen ya existe para este centro.');
      return;
    }

    this.catalogoService.create(this.centroId, nombre).subscribe({
      next: () => {
        this.nuevoTipo = '';
        this.cargarCatalogo();
      },
      error: (error) => {
        console.error('Error al agregar tipo de examen:', error);
        alert('No se pudo agregar el tipo de examen.');
      }
    });
  }

  toggleActivo(item: CatalogoExamenCentro): void {
    if (!item.id) return;

    this.catalogoService.update(item.id, { activo: !item.activo }).subscribe({
      next: () => {
        item.activo = !item.activo;
      },
      error: (error) => {
        console.error('Error al actualizar estado de tipo de examen:', error);
        alert('No se pudo actualizar el estado del tipo de examen.');
      }
    });
  }

  eliminar(item: CatalogoExamenCentro): void {
    if (!item.id) return;
    const ok = confirm(`¿Eliminar el tipo de examen "${item.nombre}" para este centro?`);
    if (!ok) return;

    this.catalogoService.delete(item.id).subscribe({
      next: () => {
        this.catalogo = this.catalogo.filter(x => x.id !== item.id);
      },
      error: (error) => {
        console.error('Error al eliminar tipo de examen:', error);
        alert('No se pudo eliminar el tipo de examen.');
      }
    });
  }
}
