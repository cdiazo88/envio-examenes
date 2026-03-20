import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ExamenService, DestinatarioService, AuthService, StorageService, CatalogoExamenCentroService } from '@core/services';
import { Paciente, Entidad, Examen, ArchivoExamen, TipoArchivo } from '@core/models';
import { formatRutChile, normalizeRut } from '@shared/utils/rut-chile.util';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-examen-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './examen-form.component.html',
  styleUrls: ['./examen-form.component.scss']
})
export class ExamenFormComponent implements OnInit {
  examenForm!: FormGroup;
  loading = false;
  submitted = false;
  isEditMode = false;
  examenId: string | null = null;
  currentExamen: Examen | null = null;
  existingArchivos: ArchivoExamen[] = [];
  replacementFiles: { [index: number]: File } = {};
  
  // Listas
  pacientes: Paciente[] = [];
  entidades: Entidad[] = [];
  selectedPaciente: Paciente | null = null;
  preselectedPacienteId: string | null = null;
  pacienteSearch = '';
  filteredPacientes: Paciente[] = [];
  showPacienteResults = false;
  
  // Archivos
  selectedFiles: File[] = [];
  
  // Tipos de examen comunes
  tiposExamen = [
    'Otro'
  ];

  private readonly defaultTiposExamen = [
    'Hemograma Completo',
    'Perfil Lipídico',
    'Glucosa en Sangre',
    'Perfil Hepático',
    'Perfil Renal',
    'Examen de Orina',
    'Radiografía',
    'Tomografía',
    'Resonancia Magnética',
    'Ecografía',
    'Electrocardiograma'
  ];

  constructor(
    private fb: FormBuilder,
    private examenService: ExamenService,
    private destinatarioService: DestinatarioService,
    private storageService: StorageService,
    private catalogoExamenCentroService: CatalogoExamenCentroService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.preselectedPacienteId = this.route.snapshot.queryParamMap.get('pacienteId');
    this.examenId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.examenId;
    this.initForm();
    this.loadDestinatarios();
    this.loadTiposExamen();

    if (this.isEditMode && this.examenId) {
      this.loadExamenToEdit(this.examenId);
    }
  }

  private loadTiposExamen(): void {
    const centroSaludId = this.authService.getCurrentCentroSaludId();
    if (!centroSaludId) {
      this.tiposExamen = [...this.defaultTiposExamen, 'Otro'];
      return;
    }

    this.catalogoExamenCentroService.getByCentro(centroSaludId).subscribe({
      next: (catalogo) => {
        const activos = catalogo
          .filter(item => item.activo)
          .map(item => item.nombre)
          .filter(Boolean)
          .filter((nombre, index, arr) => arr.indexOf(nombre) === index)
          .sort((a, b) => a.localeCompare(b));

        const base = activos.length > 0 ? activos : [...this.defaultTiposExamen];
        this.tiposExamen = [...base, 'Otro'];
      },
      error: (error) => {
        console.error('Error al cargar catálogo de tipos de examen:', error);
        this.tiposExamen = [...this.defaultTiposExamen, 'Otro'];
      }
    });
  }

  initForm(): void {
    const today = new Date().toISOString().split('T')[0];
    
    this.examenForm = this.fb.group({
      destinatarioId: ['', [Validators.required]],
      tipoExamen: ['', [Validators.required]],
      tipoExamenCustom: [''],
      fechaRealizacion: [today, [Validators.required]],
      descripcion: [''],
      observaciones: ['']
    });

    this.examenForm.get('destinatarioId')?.valueChanges.subscribe((destinatarioId: string) => {
      this.selectedPaciente = this.pacientes.find(p => p.id === destinatarioId) || null;

      if (!this.selectedPaciente) {
        this.pacienteSearch = '';
      }
    });

    // Watch tipoExamen changes
    this.examenForm.get('tipoExamen')?.valueChanges.subscribe((value) => {
      if (value === 'Otro') {
        this.examenForm.get('tipoExamenCustom')?.setValidators([Validators.required]);
      } else {
        this.examenForm.get('tipoExamenCustom')?.clearValidators();
      }
      this.examenForm.get('tipoExamenCustom')?.updateValueAndValidity();
    });
  }

  loadDestinatarios(): void {
    const session = this.authService.getCurrentSession();
    if (!session?.centroSaludId) return;

    this.loading = true;

    // Cargar pacientes
    this.destinatarioService.getPacientesByCentro(session.centroSaludId).subscribe({
      next: (pacientes) => {
        this.pacientes = pacientes;
        this.filteredPacientes = [...pacientes];

        if (this.isEditMode && this.currentExamen) {
          const pacienteEdit = this.pacientes.find(p => p.id === this.currentExamen?.destinatarioId);
          if (pacienteEdit) {
            this.selectPaciente(pacienteEdit);
          }
        }

        if (this.preselectedPacienteId && this.pacientes.some(p => p.id === this.preselectedPacienteId)) {
          const preselected = this.pacientes.find(p => p.id === this.preselectedPacienteId);
          if (preselected) {
            this.selectPaciente(preselected);
          }
        }

        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar pacientes:', error);
        this.loading = false;
      }
    });

    // Cargar entidades
    this.destinatarioService.getEntidadesByCentro(session.centroSaludId).subscribe({
      next: (entidades) => {
        this.entidades = entidades;
        this.applyPacienteFilter(this.pacienteSearch);
      },
      error: (error) => {
        console.error('Error al cargar entidades:', error);
      }
    });
  }

  onFileSelected(event: any): void {
    const files = event.target.files;
    if (files && files.length > 0) {
      // Validar tamaño y tipo
      const validFiles = Array.from(files).filter((file: any) => {
        const isValidType = ['application/pdf', 'image/jpeg', 'image/png'].includes(file.type);
        const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB
        
        if (!isValidType) {
          alert(`Archivo ${file.name}: Solo se permiten PDF, JPG y PNG`);
          return false;
        }
        if (!isValidSize) {
          alert(`Archivo ${file.name}: Tamaño máximo 10MB`);
          return false;
        }
        return true;
      });

      this.selectedFiles = [...this.selectedFiles, ...(validFiles as File[])];

      event.target.value = '';
    }
  }

  removeFile(index: number): void {
    this.selectedFiles.splice(index, 1);
  }

  onReplaceFileSelected(event: any, index: number): void {
    const file = event?.target?.files?.[0] as File | undefined;
    if (!file) return;

    const isValidType = ['application/pdf', 'image/jpeg', 'image/png'].includes(file.type);
    const isValidSize = file.size <= 10 * 1024 * 1024;

    if (!isValidType) {
      alert(`Archivo ${file.name}: Solo se permiten PDF, JPG y PNG`);
      event.target.value = '';
      return;
    }

    if (!isValidSize) {
      alert(`Archivo ${file.name}: Tamaño máximo 10MB`);
      event.target.value = '';
      return;
    }

    this.replacementFiles[index] = file;
    event.target.value = '';
  }

  clearReplacement(index: number): void {
    delete this.replacementFiles[index];
  }

  removeExistingArchivo(index: number): void {
    this.existingArchivos.splice(index, 1);
    delete this.replacementFiles[index];

    const normalized: { [index: number]: File } = {};
    Object.keys(this.replacementFiles).forEach((key) => {
      const oldIndex = Number(key);
      const newIndex = oldIndex > index ? oldIndex - 1 : oldIndex;
      normalized[newIndex] = this.replacementFiles[oldIndex];
    });
    this.replacementFiles = normalized;
  }

  formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 MB';
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  getDestinatarioNombre(destinatario: Paciente): string {
    return `${destinatario.nombre} ${destinatario.apellido}`;
  }

  getPacienteTipo(paciente: Paciente): string {
    if (!paciente.entidadId) {
      return 'Particular';
    }

    const entidad = this.entidades.find(e => e.id === paciente.entidadId);
    return entidad?.nombreEntidad ? `Entidad · ${entidad.nombreEntidad}` : 'Entidad';
  }

  onPacienteSearchChange(value: string): void {
    if (this.isEditMode) return;

    this.pacienteSearch = value;
    this.showPacienteResults = true;
    this.examenForm.patchValue({ destinatarioId: '' }, { emitEvent: true });
    this.applyPacienteFilter(value);
  }

  onPacienteSearchFocus(): void {
    if (this.isEditMode) return;

    this.showPacienteResults = true;
    this.applyPacienteFilter(this.pacienteSearch);
  }

  selectPaciente(paciente: Paciente): void {
    this.selectedPaciente = paciente;
    this.pacienteSearch = `${this.getDestinatarioNombre(paciente)} · ${formatRutChile(paciente.cedula)}`;
    this.examenForm.patchValue({ destinatarioId: paciente.id });
    this.showPacienteResults = false;
  }

  clearPacienteSelection(): void {
    if (this.isEditMode) return;

    this.selectedPaciente = null;
    this.pacienteSearch = '';
    this.examenForm.patchValue({ destinatarioId: '' });
    this.showPacienteResults = false;
    this.filteredPacientes = [...this.pacientes];
  }

  hidePacienteResults(): void {
    if (this.isEditMode) return;

    setTimeout(() => {
      this.showPacienteResults = false;
    }, 120);
  }

  private applyPacienteFilter(search: string): void {
    const term = (search || '').trim().toLowerCase();
    const rutTerm = normalizeRut(search || '');

    if (!term) {
      this.filteredPacientes = [...this.pacientes];
      return;
    }

    this.filteredPacientes = this.pacientes.filter((paciente) => {
      const nombre = this.getDestinatarioNombre(paciente).toLowerCase();
      const cedula = (paciente.cedula || '').toLowerCase();
      const cedulaNormalized = normalizeRut(paciente.cedula || '');
      const email = (paciente.email || '').toLowerCase();
      const tipo = this.getPacienteTipo(paciente).toLowerCase();

      return (
        nombre.includes(term) ||
        cedula.includes(term) ||
        cedulaNormalized.includes(rutTerm) ||
        email.includes(term) ||
        tipo.includes(term)
      );
    });
  }

  private async loadExamenToEdit(id: string): Promise<void> {
    this.loading = true;
    try {
      const examen = await firstValueFrom(this.examenService.getExamenById(id));
      if (!examen) {
        alert('Examen no encontrado.');
        this.router.navigate(['/admin-centro/examenes']);
        return;
      }

      this.currentExamen = examen;
      this.existingArchivos = [...(examen.archivos || [])];
      this.replacementFiles = {};

      const fecha = this.toDateInputValue(examen.fechaRealizacion || examen.fechaCreacion);
      const tipoConocido = this.tiposExamen.includes(examen.tipoExamen);

      this.examenForm.patchValue({
        destinatarioId: examen.destinatarioId,
        tipoExamen: tipoConocido ? examen.tipoExamen : 'Otro',
        tipoExamenCustom: tipoConocido ? '' : examen.tipoExamen,
        fechaRealizacion: fecha,
        descripcion: examen.descripcion || '',
        observaciones: examen.observaciones || ''
      });

      const paciente = this.pacientes.find(p => p.id === examen.destinatarioId);
      if (paciente) {
        this.selectPaciente(paciente);
      } else {
        this.pacienteSearch = `${examen.destinatarioNombre} · ${examen.destinatarioDocumento || ''}`.trim();
      }
    } catch (error) {
      console.error('Error al cargar examen para edición:', error);
      alert('No se pudo cargar el examen para editar.');
      this.router.navigate(['/admin-centro/examenes']);
    } finally {
      this.loading = false;
    }
  }

  async onSubmit(): Promise<void> {
    this.submitted = true;

    if (this.examenForm.invalid) {
      Object.keys(this.examenForm.controls).forEach(key => {
        this.examenForm.get(key)?.markAsTouched();
      });
      return;
    }

    if (!this.isEditMode && this.selectedFiles.length === 0) {
      alert('Debes seleccionar al menos un archivo');
      return;
    }

    this.loading = true;

    try {
      const destinatarioId = this.examenForm.value.destinatarioId;
      
      const paciente = this.pacientes.find(p => p.id === destinatarioId);
      if (!paciente) {
        throw new Error('Paciente no encontrado');
      }

      const tipoExamen = this.examenForm.value.tipoExamen === 'Otro' 
        ? this.examenForm.value.tipoExamenCustom 
        : this.examenForm.value.tipoExamen;

      const examenData = {
        destinatarioId: destinatarioId,
        tipoExamen: tipoExamen,
        fechaRealizacion: new Date(this.examenForm.value.fechaRealizacion),
        descripcion: this.examenForm.value.descripcion || undefined,
        observaciones: this.examenForm.value.observaciones || undefined,
        archivos: this.selectedFiles
      };

      const accessEmails = [paciente.email];
      if (paciente.entidadId) {
        const entidad = this.entidades.find(e => e.id === paciente.entidadId);
        if (entidad?.email) {
          accessEmails.push(entidad.email);
        }
      }

      if (this.isEditMode && this.examenId) {
        const deleteUrls: string[] = [];
        const updatedArchivos = [...this.existingArchivos];

        for (const key of Object.keys(this.replacementFiles)) {
          const index = Number(key);
          const replacement = this.replacementFiles[index];
          const current = updatedArchivos[index];
          if (!replacement || !current) continue;

          const uploadedUrl = await firstValueFrom(
            this.storageService.uploadFile(replacement, this.buildStoragePath(replacement, destinatarioId))
          );

          deleteUrls.push(current.url);
          updatedArchivos[index] = {
            nombre: replacement.name,
            url: uploadedUrl,
            tipo: replacement.type as TipoArchivo,
            tamano: replacement.size,
            fechaCarga: new Date()
          };
        }

        if (this.selectedFiles.length > 0) {
          const uploadedUrls = await firstValueFrom(
            this.storageService.uploadMultipleFiles(
              this.selectedFiles,
              `examenes/${this.currentExamen?.centroSaludId || ''}/${destinatarioId}`
            )
          );

          this.selectedFiles.forEach((file, index) => {
            updatedArchivos.push({
              nombre: file.name,
              url: uploadedUrls[index],
              tipo: file.type as TipoArchivo,
              tamano: file.size,
              fechaCarga: new Date()
            });
          });
        }

        if (updatedArchivos.length === 0) {
          alert('Debes mantener al menos un archivo en el examen.');
          this.loading = false;
          return;
        }

        const updatePayload: Partial<Examen> = {
          destinatarioId,
          destinatarioNombre: this.getDestinatarioNombre(paciente),
          destinatarioDocumento: paciente.cedula,
          tipoExamen,
          fechaRealizacion: new Date(this.examenForm.value.fechaRealizacion),
          descripcion: this.examenForm.value.descripcion || undefined,
          observaciones: this.examenForm.value.observaciones || undefined,
          accessEmails,
          archivos: updatedArchivos
        };

        await firstValueFrom(this.examenService.updateExamen(this.examenId, updatePayload));

        if (deleteUrls.length > 0) {
          await firstValueFrom(this.storageService.deleteMultipleFiles(deleteUrls));
        }

        alert('✅ Examen actualizado exitosamente');
      } else {
        await firstValueFrom(this.examenService.createExamen(
          examenData,
          this.getDestinatarioNombre(paciente),
          'paciente',
          paciente.cedula,
          accessEmails
        ));

        alert('✅ Examen creado exitosamente');
      }

      this.router.navigate(['/admin-centro/examenes']);
    } catch (error: any) {
      console.error('Error al crear examen:', error);
      alert('❌ Error al crear el examen. Por favor, intenta nuevamente.');
      this.loading = false;
    }
  }

  cancel(): void {
    this.router.navigate(['/admin-centro/examenes']);
  }

  hasError(fieldName: string, errorType: string): boolean {
    const field = this.examenForm.get(fieldName);
    return !!(field && field.hasError(errorType) && (field.dirty || field.touched || this.submitted));
  }

  getErrorMessage(fieldName: string): string {
    const field = this.examenForm.get(fieldName);
    
    if (!field || (!field.dirty && !field.touched && !this.submitted)) {
      return '';
    }

    if (field.hasError('required')) {
      return 'Este campo es requerido';
    }

    return '';
  }

  private toDateInputValue(value: unknown): string {
    const parsed = this.parseDate(value) || new Date();
    const timezoneOffset = parsed.getTimezoneOffset() * 60000;
    return new Date(parsed.getTime() - timezoneOffset).toISOString().split('T')[0];
  }

  private parseDate(value: unknown): Date | null {
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

  private buildStoragePath(file: File, destinatarioId: string): string {
    const centroId = this.currentExamen?.centroSaludId || this.authService.getCurrentCentroSaludId() || 'centro';
    return `examenes/${centroId}/${destinatarioId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${file.name}`;
  }

  formatRut(value: string): string {
    return formatRutChile(value);
  }
}
