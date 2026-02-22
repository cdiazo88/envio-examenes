/**
 * Estados de un examen
 */
export enum EstadoExamen {
  PENDIENTE = 'pendiente',
  LISTO = 'listo',
  NOTIFICADO = 'notificado',
  VISUALIZADO = 'visualizado',
  DESCARGADO = 'descargado'
}

/**
 * Tipos de archivo de examen
 */
export enum TipoArchivo {
  PDF = 'application/pdf',
  IMAGEN_JPG = 'image/jpeg',
  IMAGEN_PNG = 'image/png'
}

/**
 * Interfaz de Archivo de Examen
 */
export interface ArchivoExamen {
  nombre: string;
  url: string;
  tipo: TipoArchivo;
  tamano: number; // en bytes
  fechaCarga: Date;
}

/**
 * Interfaz de Examen
 */
export interface Examen {
  id: string;
  centroSaludId: string;
  destinatarioId: string;
  destinatarioTipo: 'paciente' | 'entidad';
  destinatarioNombre: string; // Desnormalizado para búsquedas
  destinatarioDocumento?: string; // RUT/CI desnormalizado para búsquedas
  accessEmails?: string[]; // Emails con acceso al examen (paciente/entidad)
  tipoExamen: string;
  fechaRealizacion: Date;
  descripcion?: string;
  archivos: ArchivoExamen[];
  estado: EstadoExamen;
  fechaCreacion: Date;
  fechaActualizacion: Date;
  fechaVisualizacion?: Date;
  fechaDescarga?: Date;
  creadoPor: string; // UID del admin que lo creó
  observaciones?: string;
}

/**
 * DTO para crear un examen
 */
export interface CreateExamenDto {
  destinatarioId: string;
  tipoExamen: string;
  fechaRealizacion: Date;
  descripcion?: string;
  observaciones?: string;
  archivos: File[];
}

/**
 * Interfaz para estadísticas de exámenes
 */
export interface EstadisticasExamenes {
  total: number;
  pendientes: number;
  listos: number;
  notificados: number;
  visualizados: number;
  porCentroSalud?: { [centroId: string]: number };
}
