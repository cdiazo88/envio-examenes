/**
 * Interfaz de respuesta de autenticación
 */
export interface AuthResponse {
  user: {
    uid: string;
    email: string;
    displayName?: string;
  };
  token: string;
}

/**
 * Interfaz de credenciales de login
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Interface para cambio de contraseña
 */
export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * Interfaz de sesión actual
 */
export interface SessionInfo {
  uid: string;
  email: string;
  role: string;
  centroSaludId?: string;
  nombre: string;
  apellido: string;
}
