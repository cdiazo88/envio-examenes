/**
 * Interfaz de Centro de Salud
 */
export interface CentroSalud {
  id?: string;
  nombre: string;
  direccion: string;
  telefono: string;
  email: string;
  // Información del administrador del centro
  adminId: string;
  adminNombre: string;
  adminApellido: string;
  adminEmail: string;
  // Estado
  activo: boolean;
  // Fechas
  fechaCreacion: Date;
  fechaActualizacion: Date;
}

/**
 * DTO para crear/actualizar Centro de Salud
 */
export interface CreateCentroSaludDto {
  nombre: string;
  direccion: string;
  telefono: string;
  email: string;
  adminNombre?: string;
  adminApellido?: string;
  adminEmail?: string;
  adminPassword?: string;
}

