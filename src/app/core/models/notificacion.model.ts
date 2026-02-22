/**
 * Interfaz de notificación
 */
export interface Notificacion {
  id: string;
  destinatarioId: string;
  examenId: string;
  tipo: 'examen_listo' | 'credenciales_generadas' | 'sistema';
  titulo: string;
  mensaje: string;
  leida: boolean;
  fechaCreacion: Date;
  fechaLectura?: Date;
}

/**
 * DTO para crear notificación
 */
export interface CreateNotificacionDto {
  destinatarioId: string;
  examenId?: string;
  tipo: 'examen_listo' | 'credenciales_generadas' | 'sistema';
  titulo: string;
  mensaje: string;
}
