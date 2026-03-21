import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@core/services';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  private static readonly LOGIN_KEY_STORAGE_KEY = 'login_key';

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  loginForm: FormGroup;
  loading = false;
  errorMessage = '';
  loginKey = '';

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });

    this.route.queryParamMap.subscribe(params => {
      const keyFromQuery = this.sanitizeKey(params.get('key'));

      if (keyFromQuery) {
        this.loginKey = keyFromQuery;
        this.persistLoginKey(keyFromQuery);
        return;
      }

      this.loginKey = this.getPersistedLoginKey();
    });
  }

  get loginTitle(): string {
    return this.loginKey ? `Resultado de Exámenes de ${this.loginKey}` : 'Resultado de Exámenes';
  }

  private sanitizeKey(value: string | null): string {
    if (!value) {
      return '';
    }

    return value
      .trim()
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, 60);
  }

  private persistLoginKey(key: string): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.sessionStorage.setItem(LoginComponent.LOGIN_KEY_STORAGE_KEY, key);
  }

  private getPersistedLoginKey(): string {
    if (typeof window === 'undefined') {
      return '';
    }

    const storedValue = window.sessionStorage.getItem(LoginComponent.LOGIN_KEY_STORAGE_KEY);
    return this.sanitizeKey(storedValue);
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
