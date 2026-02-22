import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { DestinatarioService, AuthService } from '@core/services';
import { Paciente, Entidad } from '@core/models';
import { CredentialsModalComponent } from '@shared/components/credentials-modal/credentials-modal.component';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-paciente-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, CredentialsModalComponent],
  templateUrl: './paciente-form.component.html',
  styleUrls: ['./paciente-form.component.scss']
})
export class PacienteFormComponent implements OnInit {
  pacienteForm!: FormGroup;
  isEditMode = false;
  pacienteId: string | null = null;
  currentPaciente: Paciente | null = null;
  loading = false;
  submitted = false;
  entidades: Entidad[] = [];
  showCredentialsModal = false;
  shouldNavigateAfterModal = false;
  credentialsNombre = '';
  credentialsEmail = '';
  credentialsPassword = '';
  credentialsWarning = '';

  constructor(
    private fb: FormBuilder,
    private destinatarioService: DestinatarioService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadEntidades();
    
    this.pacienteId = this.route.snapshot.paramMap.get('id');
    if (this.pacienteId) {
      this.isEditMode = true;
      this.loadPaciente(this.pacienteId);
    }
  }

  initForm(): void {
    this.pacienteForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      apellido: ['', [Validators.required, Validators.minLength(2)]],
      cedula: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      email: ['', [Validators.required, Validators.email]],
      telefono: ['', [Validators.pattern(/^\d{7,15}$/)]],
      fechaNacimiento: ['', [Validators.required]],
      genero: ['', [Validators.required]],
      direccion: [''],
      entidadId: [''], // Vacío = Particular
      generarCredenciales: [{ value: true, disabled: false }],
      nuevaPassword: ['', [Validators.minLength(8)]] // Para cambiar la contraseña en edición
    });

    // Escuchar cambios en el selector de entidad
    this.pacienteForm.get('entidadId')?.valueChanges.subscribe(entidadId => {
      this.onEntidadChange(entidadId);
    });
  }

  loadEntidades(): void {
    const session = this.authService.getCurrentSession();
    if (session?.centroSaludId) {
      this.destinatarioService.getEntidadesByCentro(session.centroSaludId).subscribe({
        next: (entidades) => {
          this.entidades = entidades.filter(e => e.activo);
        },
        error: (error) => {
          console.error('Error al cargar entidades:', error);
        }
      });
    }
  }

  onEntidadChange(entidadId: string): void {
    const generarCredencialesControl = this.pacienteForm.get('generarCredenciales');
    
    if (!entidadId || entidadId === '') {
      // Es PARTICULAR: siempre genera credenciales
      generarCredencialesControl?.setValue(true);
      generarCredencialesControl?.disable();
    } else {
      // Está asociado a ENTIDAD: NO genera credenciales (la entidad ve sus exámenes)
      generarCredencialesControl?.setValue(false);
      generarCredencialesControl?.disable();
    }
  }

  loadPaciente(id: string): void {
    this.loading = true;
    this.destinatarioService.getPacienteById(id).subscribe({
      next: (paciente) => {
        if (paciente) {
          this.currentPaciente = paciente; // Guardar el paciente actual
          
          const fechaNac = paciente.fechaNacimiento instanceof Date 
            ? paciente.fechaNacimiento 
            : (paciente.fechaNacimiento as any).toDate();
          
          this.pacienteForm.patchValue({
            nombre: paciente.nombre,
            apellido: paciente.apellido,
            cedula: paciente.cedula,
            email: paciente.email,
            telefono: paciente.telefono,
            fechaNacimiento: fechaNac.toISOString().split('T')[0],
            genero: paciente.genero,
            direccion: paciente.direccion,
            entidadId: paciente.entidadId || ''
          });
          
          this.pacienteForm.get('email')?.disable();
          this.pacienteForm.get('entidadId')?.disable();
          this.pacienteForm.get('generarCredenciales')?.disable();
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar paciente:', error);
        alert('Error al cargar los datos del paciente');
        this.router.navigate(['/admin-centro/pacientes']);
        this.loading = false;
      }
    });
  }

  async onSubmit(): Promise<void> {
    this.submitted = true;

    if (this.pacienteForm.invalid) {
      Object.keys(this.pacienteForm.controls).forEach(key => {
        this.pacienteForm.get(key)?.markAsTouched();
      });
      return;
    }

    const session = this.authService.getCurrentSession();
    if (!session?.centroSaludId) {
      alert('Error: Centro de salud no identificado');
      return;
    }

    this.loading = true;
    let shouldNavigate = true;

    try {
      if (this.isEditMode && this.pacienteId) {
        const pacienteData: Partial<Paciente> = {
          nombre: this.pacienteForm.value.nombre,
          apellido: this.pacienteForm.value.apellido,
          cedula: this.pacienteForm.value.cedula,
          telefono: this.pacienteForm.value.telefono,
          fechaNacimiento: new Date(this.pacienteForm.value.fechaNacimiento),
          genero: this.pacienteForm.value.genero,
          direccion: this.pacienteForm.value.direccion
        };

        // Si se proporciona nueva contraseña, incluirla
        const nuevaPassword = this.pacienteForm.value.nuevaPassword?.trim();
        if (nuevaPassword) {
          (pacienteData as any).passwordTemporal = nuevaPassword;
        }

        await firstValueFrom(this.destinatarioService.updatePaciente(this.pacienteId, pacienteData, nuevaPassword));
        
        if (nuevaPassword) {
          this.openCredentialsModal(
            `${this.pacienteForm.value.nombre} ${this.pacienteForm.value.apellido}`,
            this.currentPaciente?.email || '',
            nuevaPassword,
            'Entrégale esta nueva contraseña al paciente de forma segura.',
            true
          );
          this.loading = false;
          shouldNavigate = false;
        } else {
          alert('✅ Paciente actualizado exitosamente');
        }
      } else {
        const formValue = this.pacienteForm.getRawValue(); // Obtiene valores incluso de controles deshabilitados
        const pacienteData = {
          ...formValue,
          fechaNacimiento: new Date(formValue.fechaNacimiento),
          entidadId: formValue.entidadId || undefined
        };

        const pacienteCreado = await firstValueFrom(this.destinatarioService.createPaciente(pacienteData, session.centroSaludId)) as Paciente;
        
        // Verificar si es particular (sin entidad asociada)
        const esParticular = !pacienteData.entidadId || pacienteData.entidadId === '';
        
        if (esParticular && pacienteCreado.passwordTemporal) {
          this.openCredentialsModal(
            `${pacienteCreado.nombre} ${pacienteCreado.apellido}`,
            pacienteCreado.email,
            pacienteCreado.passwordTemporal,
            'Guarda esta contraseña y entrégasela al paciente de forma segura. El paciente podrá ingresar con estas credenciales para ver sus exámenes.',
            true
          );
          this.loading = false;
          shouldNavigate = false;
        } else if (!esParticular) {
          const entidad = this.entidades.find(e => e.id === pacienteData.entidadId);
          alert(`✅ Paciente asociado a ${entidad?.nombreEntidad} creado exitosamente.`);
        } else {
          alert('✅ Paciente creado exitosamente.');
        }
      }

      if (shouldNavigate) {
        this.router.navigate(['/admin-centro/pacientes']);
      }
    } catch (error: any) {
      console.error('Error completo al guardar paciente:', error);
      
      let errorMessage = '❌ Error al guardar el paciente.';
      
      if (error.code === 'auth/email-already-in-use' || error.message?.includes('EMAIL_EXISTS')) {
        errorMessage = '❌ El email ya está en uso. Por favor usa otro email.';
      } else if (error.message?.includes('WEAK_PASSWORD')) {
        errorMessage = '❌ La contraseña generada no cumple con los requisitos.';
      } else if (error.message) {
        errorMessage += ` Detalle: ${error.message}`;
      }
      
      alert(errorMessage);
      this.loading = false;
    }
  }

  openCredentialsModal(
    nombre: string,
    email: string,
    password: string,
    warningText: string,
    navigateAfterClose: boolean
  ): void {
    this.credentialsNombre = nombre;
    this.credentialsEmail = email;
    this.credentialsPassword = password;
    this.credentialsWarning = warningText;
    this.shouldNavigateAfterModal = navigateAfterClose;
    this.showCredentialsModal = true;
  }

  closeCredentialsModal(): void {
    this.showCredentialsModal = false;

    if (this.shouldNavigateAfterModal) {
      this.shouldNavigateAfterModal = false;
      this.router.navigate(['/admin-centro/pacientes']);
    }
  }

  cancel(): void {
    this.router.navigate(['/admin-centro/pacientes']);
  }

  hasError(fieldName: string, errorType: string): boolean {
    const field = this.pacienteForm.get(fieldName);
    return !!(field && field.hasError(errorType) && (field.dirty || field.touched || this.submitted));
  }

  getErrorMessage(fieldName: string): string {
    const field = this.pacienteForm.get(fieldName);
    
    if (!field || (!field.dirty && !field.touched && !this.submitted)) {
      return '';
    }

    if (field.hasError('required')) {
      return 'Este campo es requerido';
    }
    if (field.hasError('email')) {
      return 'Email inválido';
    }
    if (field.hasError('minlength')) {
      const minLength = field.getError('minlength').requiredLength;
      return `Mínimo ${minLength} caracteres`;
    }
    if (field.hasError('pattern')) {
      if (fieldName === 'cedula') return 'Cédula debe tener 10 dígitos';
      if (fieldName === 'telefono') return 'Teléfono inválido (7-15 dígitos)';
      return 'Formato inválido';
    }

    return '';
  }

  getMaxDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  getEntidadNombre(): string {
    const entidadId = this.pacienteForm.get('entidadId')?.value;
    if (!entidadId) return '';
    const entidad = this.entidades.find(e => e.id === entidadId);
    return entidad?.nombreEntidad || '';
  }
}
