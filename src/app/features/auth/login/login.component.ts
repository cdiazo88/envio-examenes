import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@core/services';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  loginForm: FormGroup;
  loading = false;
  errorMessage = '';

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.authService.login(this.loginForm.value).subscribe({
      next: (session) => {
        if (session) {
          // Redirigir según el rol
          switch (session.role) {
            case 'super_admin':
              this.router.navigate(['/super-admin']);
              break;
            case 'admin_centro':
              this.router.navigate(['/admin-centro']);
              break;
            case 'destinatario':
              this.router.navigate(['/destinatario']);
              break;
            default:
              this.router.navigate(['/']);
          }
          return;
        }

        this.loading = false;
        this.errorMessage = 'No se encontró un perfil activo para este usuario.';
      },
      error: (error) => {
        this.loading = false;
        console.error('Error al iniciar sesión:', error);
        
        // Mensajes de error personalizados
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
          this.errorMessage = 'Email o contraseña incorrectos';
        } else if (error.code === 'auth/too-many-requests') {
          this.errorMessage = 'Demasiados intentos fallidos. Intenta más tarde';
        } else {
          this.errorMessage = 'Error al iniciar sesión. Intenta nuevamente';
        }
      }
    });
  }

  get email() {
    return this.loginForm.get('email');
  }

  get password() {
    return this.loginForm.get('password');
  }
}
