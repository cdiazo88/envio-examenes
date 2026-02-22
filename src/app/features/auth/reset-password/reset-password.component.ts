import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/services';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss']
})
export class ResetPasswordComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);

  resetForm: FormGroup;
  loading = false;
  success = false;
  errorMessage = '';

  constructor() {
    this.resetForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  onSubmit(): void {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.success = false;

    this.authService.resetPassword(this.resetForm.value.email).subscribe({
      next: () => {
        this.loading = false;
        this.success = true;
        this.resetForm.reset();
      },
      error: (error) => {
        this.loading = false;
        console.error('Error al enviar email:', error);
        
        if (error.code === 'auth/user-not-found') {
          this.errorMessage = 'No existe una cuenta con este correo';
        } else {
          this.errorMessage = 'Error al enviar el email. Intenta nuevamente';
        }
      }
    });
  }

  get email() {
    return this.resetForm.get('email');
  }
}
