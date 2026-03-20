import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  CollectionReference,
  DocumentReference
} from '@angular/fire/firestore';
import { Observable, from, forkJoin } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import {
  Examen,
  CreateExamenDto,
  EstadoExamen,
  ArchivoExamen,
  TipoArchivo,
  EstadisticasExamenes
} from '@core/models';
import { StorageService } from './storage.service';
import { AuthService } from './auth.service';

/**
 * Servicio de gestión de Exámenes
 */
@Injectable({
  providedIn: 'root'
})
export class ExamenService {
  private firestore = inject(Firestore);
  private storageService = inject(StorageService);
  private authService = inject(AuthService);

  private examenesCollection = collection(
    this.firestore,
    'examenes'
  ) as CollectionReference<Examen>;

  private cleanUndefinedFields<T extends Record<string, any>>(obj: T): Partial<T> {
    const cleaned: any = {};
    Object.keys(obj).forEach(key => {
      if (obj[key] !== undefined) {
        cleaned[key] = obj[key];
      }
    });
    return cleaned;
  }

  /**
   * Crea un nuevo examen con sus archivos
   */
  createExamen(
    data: CreateExamenDto,
    destinatarioNombre: string,
    destinatarioTipo: 'paciente' | 'entidad',
    destinatarioDocumento?: string,
    accessEmails?: string[]
  ): Observable<Examen> {
    const session = this.authService.getCurrentSession();
    if (!session) {
      throw new Error('Usuario no autenticado');
    }

    const centroSaludId = session.centroSaludId;
    if (!centroSaludId) {
      throw new Error('Centro de salud no definido');
    }

    // Subir archivos primero
    const basePath = `examenes/${centroSaludId}/${data.destinatarioId}`;
    
    return this.storageService.uploadMultipleFiles(data.archivos, basePath).pipe(
      switchMap(urls => {
        // Crear objetos de archivo con metadata
        const archivos: ArchivoExamen[] = data.archivos.map((file, index) => ({
          nombre: file.name,
          url: urls[index],
          tipo: file.type as TipoArchivo,
          tamano: file.size,
          fechaCarga: new Date()
        }));

        const normalizedAccessEmails = (accessEmails || [])
          .flatMap(email => [email, email.toLowerCase()])
          .filter(Boolean)
          .filter((email, index, arr) => arr.indexOf(email) === index);

        const newExamen = {
          centroSaludId,
          destinatarioId: data.destinatarioId,
          destinatarioTipo,
          destinatarioNombre,
          destinatarioDocumento,
          accessEmails: normalizedAccessEmails,
          tipoExamen: data.tipoExamen,
          fechaRealizacion: data.fechaRealizacion,
          descripcion: data.descripcion,
          observaciones: data.observaciones,
          archivos,
          estado: EstadoExamen.LISTO,
          fechaCreacion: new Date(),
          fechaActualizacion: new Date(),
          creadoPor: session.uid
        };

        const cleanedExamen = this.cleanUndefinedFields(newExamen);

        return from(addDoc(this.examenesCollection, cleanedExamen as any)).pipe(
          map(docRef => ({ id: docRef.id, ...cleanedExamen } as Examen))
        );
      })
    );
  }

  /**
   * Obtiene exámenes de un destinatario específico
   */
  getExamenesByDestinatario(destinatarioId: string): Observable<Examen[]> {
    return from(this.getExamenesByDestinatarioPaged(destinatarioId));
  }

  getExamenesByAccessEmail(email: string): Observable<Examen[]> {
    const emailLower = email.toLowerCase();
    const queryByEmail = (value: string) => {
      const q = query(this.examenesCollection, where('accessEmails', 'array-contains', value));
      return from(getDocs(q)).pipe(
        map(snapshot => snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Examen)))
      );
    };

    const requests = emailLower === email
      ? [queryByEmail(email)]
      : [queryByEmail(email), queryByEmail(emailLower)];

    return forkJoin(requests).pipe(
      map(resultSets => {
        const merged = resultSets.flat();
        const byId = new Map<string, Examen>();

        merged.forEach(examen => {
          if (!examen.id) return;
          const current = byId.get(examen.id);
          if (!current || this.getComparableDate(examen) >= this.getComparableDate(current)) {
            byId.set(examen.id, examen);
          }
        });

        return Array.from(byId.values()).sort((a, b) => this.getComparableDate(b) - this.getComparableDate(a));
      })
    );
  }

  private getComparableDate(examen: Examen): number {
    return this.parseDate(examen.fechaActualizacion || examen.fechaRealizacion || examen.fechaCreacion)?.getTime() || 0;
  }

  private async getExamenesByDestinatarioPaged(destinatarioId: string): Promise<Examen[]> {
    const pageSize = 2;
    const allDocs: any[] = [];
    let lastDoc: any = null;

    while (true) {
      const q = lastDoc
        ? query(
            this.examenesCollection,
            where('destinatarioId', '==', destinatarioId),
            orderBy('fechaCreacion', 'desc'),
            startAfter(lastDoc),
            limit(pageSize)
          )
        : query(
            this.examenesCollection,
            where('destinatarioId', '==', destinatarioId),
            orderBy('fechaCreacion', 'desc'),
            limit(pageSize)
          );

      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        break;
      }

      allDocs.push(...snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      lastDoc = snapshot.docs[snapshot.docs.length - 1];

      if (snapshot.docs.length < pageSize) {
        break;
      }
    }

    return allDocs as Examen[];
  }

  private parseDate(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

    if (
      typeof value === 'object' &&
      value !== null &&
      'toDate' in value &&
      typeof (value as { toDate: unknown }).toDate === 'function'
    ) {
      const parsed = (value as { toDate: () => Date }).toDate();
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
  }

  /**
   * Obtiene exámenes de un centro de salud
   */
  getExamenesByCentro(centroSaludId: string): Observable<Examen[]> {
    const q = query(
      this.examenesCollection,
      where('centroSaludId', '==', centroSaludId),
      orderBy('fechaCreacion', 'desc')
    );
    return from(getDocs(q)).pipe(
      map(snapshot => snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })))
    );
  }

  /**
   * Obtiene un examen por ID
   */
  getExamenById(id: string): Observable<Examen | null> {
    const examenRef = doc(this.firestore, `examenes/${id}`) as DocumentReference<Examen>;
    return from(getDoc(examenRef)).pipe(
      map(docSnap => docSnap.exists() ? { ...docSnap.data(), id: docSnap.id } : null)
    );
  }

  /**
   * Actualiza el estado de un examen
   */
  updateEstado(id: string, estado: EstadoExamen): Observable<void> {
    const examenRef = doc(this.firestore, `examenes/${id}`);
    const updateData: any = {
      estado,
      fechaActualizacion: new Date()
    };

    if (estado === EstadoExamen.VISUALIZADO) {
      updateData.fechaVisualizacion = new Date();
    } else if (estado === EstadoExamen.DESCARGADO) {
      updateData.fechaDescarga = new Date();
    }

    return from(updateDoc(examenRef, updateData));
  }

  /**
   * Actualiza un examen
   */
  updateExamen(id: string, data: Partial<Examen>): Observable<void> {
    const examenRef = doc(this.firestore, `examenes/${id}`);
    const updateData = this.cleanUndefinedFields({
      ...data,
      fechaActualizacion: new Date()
    });
    return from(updateDoc(examenRef, updateData as any));
  }

  /**
   * Elimina un examen y sus archivos
   */
  deleteExamen(id: string): Observable<void> {
    return this.getExamenById(id).pipe(
      switchMap(examen => {
        if (!examen) {
          throw new Error('Examen no encontrado');
        }

        // Eliminar archivos de Storage
        const urls = examen.archivos.map(a => a.url);
        return this.storageService.deleteMultipleFiles(urls).pipe(
          switchMap(() => {
            const examenRef = doc(this.firestore, `examenes/${id}`);
            return from(deleteDoc(examenRef));
          })
        );
      })
    );
  }

  /**
   * Obtiene los últimos exámenes de un centro
   */
  getRecentExamenes(centroSaludId: string, limitCount: number = 10): Observable<Examen[]> {
    const q = query(
      this.examenesCollection,
      where('centroSaludId', '==', centroSaludId),
      orderBy('fechaCreacion', 'desc'),
      limit(limitCount)
    );
    return from(getDocs(q)).pipe(
      map(snapshot => snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })))
    );
  }

  /**
   * Obtiene estadísticas de exámenes
   */
  getEstadisticas(centroSaludId?: string): Observable<EstadisticasExamenes> {
    let q;
    if (centroSaludId) {
      q = query(this.examenesCollection, where('centroSaludId', '==', centroSaludId));
    } else {
      q = query(this.examenesCollection);
    }

    return from(getDocs(q)).pipe(
      map(snapshot => {
        const examenes = snapshot.docs.map(doc => doc.data());
        
        return {
          total: examenes.length,
          pendientes: examenes.filter(e => e.estado === EstadoExamen.PENDIENTE).length,
          listos: examenes.filter(e => e.estado === EstadoExamen.LISTO).length,
          notificados: examenes.filter(e => e.estado === EstadoExamen.NOTIFICADO).length,
          visualizados: examenes.filter(e => e.estado === EstadoExamen.VISUALIZADO).length
        };
      })
    );
  }
}
