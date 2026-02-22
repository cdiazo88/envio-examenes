/**
 * Tipos de destinatarios
 */
export enum TipoDestinatario {
  PACIENTE = 'paciente',
  ENTIDAD = 'entidad'
}

/**
 * Interfaz base para destinatarios
 */
export interface DestinatarioBase {
  id: string;
  tipo: TipoDestinatario;
  centroSaludId: string;
  email: string;
  telefono?: string;
  activo: boolean;
  credencialesGeneradas: boolean;
  passwordTemporal?: string;
  fechaCreacion: Date;
  fechaActualizacion: Date;
}

/**
 * Interfaz de Paciente
 */
export interface Paciente extends DestinatarioBase {
  tipo: TipoDestinatario.PACIENTE;
  nombre: string;
  apellido: string;
  cedula: string;
  fechaNacimiento: Date;
  genero: 'M' | 'F' | 'Otro';
  direccion?: string;
  entidadId?: string; // Si está asociado a una entidad, null/undefined = particular
}

/**
 * Interfaz de Entidad (Lab, clínica, etc.)
 */
export interface Entidad extends DestinatarioBase {
  tipo: TipoDestinatario.ENTIDAD;
  nombreEntidad: string;
  ruc: string;
  razonSocial: string;
  contactoNombre?: string;
  direccion?: string;
}

/**
 * Union type de destinatarios
 */
export type Destinatario = Paciente | Entidad;

/**
 * DTO para crear Paciente
 */
export interface CreatePacienteDto {
  nombre: string;
  apellido: string;
  cedula: string;
  email: string;
  telefono?: string;
  fechaNacimiento: Date;
  genero: 'M' | 'F' | 'Otro';
  direccion?: string;
  entidadId?: string; // Si es null/undefined = particular con credenciales
  generarCredenciales: boolean;
}

/**
 * DTO para crear Entidad
 */
export interface CreateEntidadDto {
  nombreEntidad: string;
  ruc: string;
  razonSocial: string;
  email: string;
  telefono?: string;
  contactoNombre?: string;
  direccion?: string;
  generarCredenciales: boolean;
}
