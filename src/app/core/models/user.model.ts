/**
 * Tipos de roles en el sistema
 */
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN_CENTRO = 'admin_centro',
  DESTINATARIO = 'destinatario'
}

/**
 * Interfaz de Usuario del sistema
 */
export interface User {
  uid: string;
  email: string;
  role: UserRole;
  nombre: string;
  apellido: string;
  telefono?: string;
  centroSaludId?: string; // Solo para admin_centro
  activo: boolean;
  fechaCreacion: Date;
  fechaActualizacion: Date;
}

/**
 * Interfaz para crear un nuevo usuario
 */
export interface CreateUserDto {
  email: string;
  password: string;
  role: UserRole;
  nombre: string;
  apellido: string;
  telefono?: string;
  centroSaludId?: string;
}
