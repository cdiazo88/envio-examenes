import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { CentroSaludService, UserService } from '@core/services';
import { CentroSalud } from '@core/models';

@Component({
  selector: 'app-centro-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './centro-form.component.html',
  styleUrls: ['./centro-form.component.scss']
})
export class CentroFormComponent implements OnInit {
  centroForm!: FormGroup;
  isEditMode = false;
  centroId: string | null = null;
  loading = false;
  submitted = false;

  constructor(
    private fb: FormBuilder,
    private centroSaludService: CentroSaludService,
    private userService: UserService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.initForm();
    
    // Check if we're in edit mode
    this.centroId = this.route.snapshot.paramMap.get('id');
    if (this.centroId) {
      this.isEditMode = true;
      this.loadCentro(this.centroId);
    }
  }

  initForm(): void {
    this.centroForm = this.fb.group({
      // Centro Info
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      direccion: ['', [Validators.required]],
      telefono: ['', [Validators.required, Validators.pattern(/^\d{7,15}$/)]],
      email: ['', [Validators.required, Validators.email]],
      
      // Admin Info (only for create mode)
      adminNombre: ['', [Validators.required]],
      adminApellido: ['', [Validators.required]],
      adminEmail: ['', [Validators.required, Validators.email]],
      adminPassword: ['', [Validators.required, Validators.minLength(6)]]
    });

    // Remove admin password validation in edit mode
    if (this.isEditMode) {
      this.centroForm.get('adminPassword')?.clearValidators();
      this.centroForm.get('adminPassword')?.updateValueAndValidity();
    }
  }

  loadCentro(id: string): void {
    this.loading = true;
    this.centroSaludService.getCentroById(id).subscribe({
      next: (centro) => {
        if (centro) {
          this.centroForm.patchValue({
            nombre: centro.nombre,
            direccion: centro.direccion,
            telefono: centro.telefono,
            email: centro.email,
            adminNombre: centro.adminNombre,
            adminApellido: centro.adminApellido,
            adminEmail: centro.adminEmail
          });
          
          // In edit mode, disable admin fields
          this.centroForm.get('adminEmail')?.disable();
          this.centroForm.get('adminPassword')?.disable();
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar centro:', error);
        alert('Error al cargar los datos del centro');
        this.router.navigate(['/super-admin/centros']);
        this.loading = false;
      }
    });
  }

  async onSubmit(): Promise<void> {
    this.submitted = true;

    if (this.centroForm.invalid) {
      // Mark all fields as touched to show validation errors
      Object.keys(this.centroForm.controls).forEach(key => {
        this.centroForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.loading = true;

    try {
      if (this.isEditMode && this.centroId) {
        // Update existing centro
        const centroData: Partial<CentroSalud> = {
          nombre: this.centroForm.value.nombre,
          direccion: this.centroForm.value.direccion,
          telefono: this.centroForm.value.telefono,
          email: this.centroForm.value.email,
          adminNombre: this.centroForm.value.adminNombre,
          adminApellido: this.centroForm.value.adminApellido
        };

        await this.centroSaludService.updateCentro(this.centroId, centroData);
        alert('Centro actualizado exitosamente');
      } else {
        // Create new centro with admin
        const centroData: Omit<CentroSalud, 'id' | 'fechaCreacion' | 'fechaActualizacion'> = {
          nombre: this.centroForm.value.nombre,
          direccion: this.centroForm.value.direccion,
          telefono: this.centroForm.value.telefono,
          email: this.centroForm.value.email,
          adminNombre: this.centroForm.value.adminNombre,
          adminApellido: this.centroForm.value.adminApellido,
          adminEmail: this.centroForm.value.adminEmail,
          adminId: '', // Will be set by service
          activo: true
        };

        await this.centroSaludService.createCentroWithAdmin(
          centroData,
          this.centroForm.value.adminPassword
        );
        
        alert(`✅ Centro creado exitosamente!\n\n` +
              `El administrador puede iniciar sesión con:\n` +
              `📧 Email: ${this.centroForm.value.adminEmail}\n` +
              `🔑 Password: ${this.centroForm.value.adminPassword}`);
      }

      this.router.navigate(['/super-admin/centros']);
    } catch (error: any) {
      console.error('Error al guardar centro:', error);
      
      if (error.code === 'auth/email-already-in-use') {
        alert('El email del administrador ya está en uso');
      } else {
        alert('Error al guardar el centro. Por favor, intenta nuevamente.');
      }
      
      this.loading = false;
    }
  }

  cancel(): void {
    this.router.navigate(['/super-admin/centros']);
  }

  // Utility methods for template
  hasError(fieldName: string, errorType: string): boolean {
    const field = this.centroForm.get(fieldName);
    return !!(field && field.hasError(errorType) && (field.dirty || field.touched || this.submitted));
  }

  getErrorMessage(fieldName: string): string {
    const field = this.centroForm.get(fieldName);
    
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
      return 'Formato inválido';
    }

    return '';
  }
}
