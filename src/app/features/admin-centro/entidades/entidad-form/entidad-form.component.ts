import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { DestinatarioService, AuthService } from '@core/services';
import { Entidad } from '@core/models';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-entidad-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './entidad-form.component.html',
  styleUrls: ['./entidad-form.component.scss']
})
export class EntidadFormComponent implements OnInit {
  entidadForm!: FormGroup;
  isEditMode = false;
  entidadId: string | null = null;
  loading = false;
  submitted = false;
  showCredentialsModal = false;
  shouldNavigateAfterModal = false;
  credentialsNombre = '';
  credentialsEmail = '';
  credentialsPassword = '';
  credentialsWarning = '';
  copiedState: 'none' | 'email' | 'password' | 'all' = 'none';

  constructor(
    private fb: FormBuilder,
    private destinatarioService: DestinatarioService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.initForm();
    
    this.entidadId = this.route.snapshot.paramMap.get('id');
    if (this.entidadId) {
      this.isEditMode = true;
      this.loadEntidad(this.entidadId);
    }
  }

  initForm(): void {
    this.entidadForm = this.fb.group({
      nombreEntidad: ['', [Validators.required, Validators.minLength(3)]],
      ruc: ['', [Validators.required, Validators.pattern(/^\d{13}$/)]],
      razonSocial: ['', [Validators.required]],
      contactoNombre: [''],
      email: ['', [Validators.required, Validators.email]],
      telefono: ['', [Validators.pattern(/^\d{7,15}$/)]],
      direccion: [''],
      generarCredenciales: [true]
    });
  }

  loadEntidad(id: string): void {
    this.loading = true;
    this.destinatarioService.getEntidadById(id).subscribe({
      next: (entidad) => {
        if (entidad) {
          this.entidadForm.patchValue({
            nombreEntidad: entidad.nombreEntidad,
            ruc: entidad.ruc,
            razonSocial: entidad.razonSocial,
            contactoNombre: entidad.contactoNombre,
            email: entidad.email,
            telefono: entidad.telefono,
            direccion: entidad.direccion
          });
          
          this.entidadForm.get('email')?.disable();
          this.entidadForm.get('generarCredenciales')?.disable();
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar entidad:', error);
        alert('Error al cargar los datos de la entidad');
        this.router.navigate(['/admin-centro/entidades']);
        this.loading = false;
      }
    });
  }

  async onSubmit(): Promise<void> {
    this.submitted = true;

    if (this.entidadForm.invalid) {
      Object.keys(this.entidadForm.controls).forEach(key => {
        this.entidadForm.get(key)?.markAsTouched();
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
      if (this.isEditMode && this.entidadId) {
        const entidadData: Partial<Entidad> = {
          nombreEntidad: this.entidadForm.value.nombreEntidad,
          ruc: this.entidadForm.value.ruc,
          razonSocial: this.entidadForm.value.razonSocial,
          contactoNombre: this.entidadForm.value.contactoNombre,
          telefono: this.entidadForm.value.telefono,
          direccion: this.entidadForm.value.direccion
        };

        await firstValueFrom(this.destinatarioService.updateEntidad(this.entidadId, entidadData));
        alert('✅ Entidad actualizada exitosamente');
      } else {
        const entidadData = {
          ...this.entidadForm.value
        };

        const entidadCreada = await firstValueFrom(this.destinatarioService.createEntidad(entidadData, session.centroSaludId)) as Entidad;
        
        if (this.entidadForm.value.generarCredenciales && entidadCreada.passwordTemporal) {
          this.openCredentialsModal(
            entidadCreada.nombreEntidad,
            entidadCreada.email,
            entidadCreada.passwordTemporal,
            'Guarda esta contraseña y entrégasela al contacto de la entidad de forma segura. La entidad podrá ingresar con estas credenciales para ver los exámenes de sus empleados o pacientes asociados.',
            true
          );
          this.loading = false;
          shouldNavigate = false;
        } else {
          alert('✅ Entidad creada exitosamente');
        }
      }

      if (shouldNavigate) {
        this.router.navigate(['/admin-centro/entidades']);
      }
    } catch (error: any) {
      console.error('Error completo al guardar entidad:', error);
      
      let errorMessage = '❌ Error al guardar la entidad.';
      
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
    this.copiedState = 'none';

    if (this.shouldNavigateAfterModal) {
      this.shouldNavigateAfterModal = false;
      this.router.navigate(['/admin-centro/entidades']);
    }
  }

  async copyEmail(): Promise<void> {
    if (!this.credentialsEmail) return;
    const copied = await this.copyToClipboard(this.credentialsEmail);
    this.copiedState = copied ? 'email' : 'none';
  }

  async copyPassword(): Promise<void> {
    if (!this.credentialsPassword) return;
    const copied = await this.copyToClipboard(this.credentialsPassword);
    this.copiedState = copied ? 'password' : 'none';
  }

  async copyAllCredentials(): Promise<void> {
    const credentialsText = `Nombre: ${this.credentialsNombre}\nEmail: ${this.credentialsEmail}\nContraseña: ${this.credentialsPassword}`;
    const copied = await this.copyToClipboard(credentialsText);
    this.copiedState = copied ? 'all' : 'none';
  }

  private async copyToClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    }
  }

  cancel(): void {
    this.router.navigate(['/admin-centro/entidades']);
  }

  hasError(fieldName: string, errorType: string): boolean {
    const field = this.entidadForm.get(fieldName);
    return !!(field && field.hasError(errorType) && (field.dirty || field.touched || this.submitted));
  }

  getErrorMessage(fieldName: string): string {
    const field = this.entidadForm.get(fieldName);
    
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
      if (fieldName === 'ruc') return 'RUC debe tener 13 dígitos';
      if (fieldName === 'telefono') return 'Teléfono inválido (7-15 dígitos)';
      return 'Formato inválido';
    }

    return '';
  }
}
