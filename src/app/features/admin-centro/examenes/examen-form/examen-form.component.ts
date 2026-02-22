import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ExamenService, DestinatarioService, AuthService } from '@core/services';
import { Paciente, Entidad } from '@core/models';
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
    'Electrocardiograma',
    'Otro'
  ];

  constructor(
    private fb: FormBuilder,
    private examenService: ExamenService,
    private destinatarioService: DestinatarioService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.preselectedPacienteId = this.route.snapshot.queryParamMap.get('pacienteId');
    this.initForm();
    this.loadDestinatarios();
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

      this.selectedFiles = validFiles as File[];
    }
  }

  removeFile(index: number): void {
    this.selectedFiles.splice(index, 1);
  }

  getDestinatarioNombre(destinatario: Paciente): string {
    return `${destinatario.nombre} ${destinatario.apellido}`;
  }

  getPacienteTipo(paciente: Paciente): string {
    if (!paciente.entidadId) {
      return 'Particular';
    }

    const entidad = this.entidades.find(e => e.id === paciente.entidadId);
    return entidad?.nombreEntidad ? `Mutual · ${entidad.nombreEntidad}` : 'Mutual';
  }

  onPacienteSearchChange(value: string): void {
    this.pacienteSearch = value;
    this.showPacienteResults = true;
    this.examenForm.patchValue({ destinatarioId: '' }, { emitEvent: true });
    this.applyPacienteFilter(value);
  }

  onPacienteSearchFocus(): void {
    this.showPacienteResults = true;
    this.applyPacienteFilter(this.pacienteSearch);
  }

  selectPaciente(paciente: Paciente): void {
    this.selectedPaciente = paciente;
    this.pacienteSearch = `${this.getDestinatarioNombre(paciente)} · ${paciente.cedula}`;
    this.examenForm.patchValue({ destinatarioId: paciente.id });
    this.showPacienteResults = false;
  }

  clearPacienteSelection(): void {
    this.selectedPaciente = null;
    this.pacienteSearch = '';
    this.examenForm.patchValue({ destinatarioId: '' });
    this.showPacienteResults = false;
    this.filteredPacientes = [...this.pacientes];
  }

  hidePacienteResults(): void {
    setTimeout(() => {
      this.showPacienteResults = false;
    }, 120);
  }

  private applyPacienteFilter(search: string): void {
    const term = (search || '').trim().toLowerCase();

    if (!term) {
      this.filteredPacientes = [...this.pacientes];
      return;
    }

    this.filteredPacientes = this.pacientes.filter((paciente) => {
      const nombre = this.getDestinatarioNombre(paciente).toLowerCase();
      const cedula = (paciente.cedula || '').toLowerCase();
      const email = (paciente.email || '').toLowerCase();
      const tipo = this.getPacienteTipo(paciente).toLowerCase();

      return (
        nombre.includes(term) ||
        cedula.includes(term) ||
        email.includes(term) ||
        tipo.includes(term)
      );
    });
  }

  async onSubmit(): Promise<void> {
    this.submitted = true;

    if (this.examenForm.invalid) {
      Object.keys(this.examenForm.controls).forEach(key => {
        this.examenForm.get(key)?.markAsTouched();
      });
      return;
    }

    if (this.selectedFiles.length === 0) {
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

      await firstValueFrom(this.examenService.createExamen(
        examenData,
        this.getDestinatarioNombre(paciente),
        'paciente',
        paciente.cedula,
        accessEmails
      ));

      alert('✅ Examen creado exitosamente');
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
}
