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
  CollectionReference,
  DocumentReference,
  setDoc
} from '@angular/fire/firestore';
import { Observable, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { CentroSalud, CreateCentroSaludDto } from '@core/models';
import { UserService } from './user.service';
import { UserRole } from '@core/models';
import { Auth, createUserWithEmailAndPassword } from '@angular/fire/auth';

/**
 * Servicio de gestión de Centros de Salud
 */
@Injectable({
  providedIn: 'root'
})
export class CentroSaludService {
  private firestore = inject(Firestore);
  private userService = inject(UserService);
  private auth = inject(Auth);

  private centrosCollection = collection(
    this.firestore,
    'centrosSalud'
  ) as CollectionReference<CentroSalud>;

  /**
   * Crea un nuevo Centro de Salud
   * Si se proporcionan datos de admin, crea el usuario administrador
   */
  createCentro(data: CreateCentroSaludDto): Observable<CentroSalud> {
    if (!data.adminEmail || !data.adminNombre || !data.adminApellido) {
      throw new Error('Se requieren datos del administrador');
    }

    const newCentro: Omit<CentroSalud, 'id'> = {
      nombre: data.nombre,
      direccion: data.direccion,
      telefono: data.telefono,
      email: data.email,
      adminId: '', // Se establecerá después de crear el usuario
      adminNombre: data.adminNombre,
      adminApellido: data.adminApellido,
      adminEmail: data.adminEmail,
      activo: true,
      fechaCreacion: new Date(),
      fechaActualizacion: new Date()
    };

    return from(addDoc(this.centrosCollection, newCentro as any)).pipe(
      map(async (docRef) => {
        // Si se proporcionaron datos de admin, crear el usuario
        if (data.adminEmail && data.adminPassword && data.adminNombre && data.adminApellido) {
          await this.userService.createUser({
            email: data.adminEmail,
            password: data.adminPassword,
            role: UserRole.ADMIN_CENTRO,
            nombre: data.adminNombre,
            apellido: data.adminApellido,
            centroSaludId: docRef.id
          }).toPromise();
        }

        return { id: docRef.id, ...newCentro } as CentroSalud;
      }),
      switchMap(promise => from(promise))
    );
  }

  /**
   * Obtiene todos los Centros de Salud
   */
  getAllCentros(): Observable<CentroSalud[]> {
    const q = query(this.centrosCollection, orderBy('nombre', 'asc'));
    return from(getDocs(q)).pipe(
      map(snapshot => snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })))
    );
  }

  /**
   * Obtiene solo los centros activos
   */
  getActiveCentros(): Observable<CentroSalud[]> {
    const q = query(
      this.centrosCollection,
      where('activo', '==', true)
    );
    return from(getDocs(q)).pipe(
      map(snapshot => {
        const centros = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        // Ordenar en el cliente por nombre
        return centros.sort((a, b) => a.nombre.localeCompare(b.nombre));
      })
    );
  }

  /**
   * Obtiene un Centro de Salud por ID
   */
  getCentroById(id: string): Observable<CentroSalud | null> {
    const centroRef = doc(this.firestore, `centrosSalud/${id}`) as DocumentReference<CentroSalud>;
    return from(getDoc(centroRef)).pipe(
      map(docSnap => docSnap.exists() ? { ...docSnap.data(), id: docSnap.id } : null)
    );
  }

  /**
   * Actualiza un Centro de Salud
   */
  updateCentro(id: string, data: Partial<CentroSalud>): Observable<void> {
    const centroRef = doc(this.firestore, `centrosSalud/${id}`);
    const updateData = {
      ...data,
      fechaActualizacion: new Date()
    };
    return from(updateDoc(centroRef, updateData as any));
  }

  /**
   * Desactiva un Centro de Salud
   */
  deactivateCentro(id: string): Observable<void> {
    return this.updateCentro(id, { activo: false });
  }

  /**
   * Activa un Centro de Salud
   */
  activateCentro(id: string): Observable<void> {
    return this.updateCentro(id, { activo: true });
  }

  /**
   * Elimina un Centro de Salud (solo si no tiene datos relacionados)
   */
  deleteCentro(id: string): Observable<void> {
    const centroRef = doc(this.firestore, `centrosSalud/${id}`);
    return from(deleteDoc(centroRef));
  }

  /**
   * Alias para getAllCentros
   */
  getCentros(): Observable<CentroSalud[]> {
    return this.getAllCentros();
  }

  /**
   * Crea un centro de salud con su administrador
   * Usa la REST API de Firebase para no cerrar la sesión del SuperAdmin
   */
  async createCentroWithAdmin(
    centroData: Omit<CentroSalud, 'id' | 'fechaCreacion' | 'fechaActualizacion'>,
    adminPassword: string
  ): Promise<string> {
    try {
      // 1. Crear usuario usando Firebase REST API (no cierra la sesión actual)
      const firebaseApiKey = this.auth.app.options.apiKey;
      const createUserResponse = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: centroData.adminEmail,
            password: adminPassword,
            returnSecureToken: true
          })
        }
      );

      if (!createUserResponse.ok) {
        const error = await createUserResponse.json();
        throw new Error(error.error?.message || 'Error al crear usuario');
      }

      const userData = await createUserResponse.json();
      const adminUid = userData.localId;

      // 2. Crear documento del centro en Firestore
      const centroRef = doc(collection(this.firestore, 'centrosSalud'));
      const centroId = centroRef.id;

      const centroCompleto: CentroSalud = {
        ...centroData,
        id: centroId,
        adminId: adminUid,
        fechaCreacion: new Date(),
        fechaActualizacion: new Date()
      };

      await setDoc(centroRef, centroCompleto);

      // 3. Crear documento del usuario administrador en Firestore
      const userRef = doc(this.firestore, `users/${adminUid}`);
      await setDoc(userRef, {
        uid: adminUid,
        email: centroData.adminEmail,
        nombre: centroData.adminNombre,
        apellido: centroData.adminApellido,
        role: UserRole.ADMIN_CENTRO,
        centroSaludId: centroId,
        activo: true,
        fechaCreacion: new Date(),
        fechaActualizacion: new Date()
      });

      return centroId;
    } catch (error: any) {
      console.error('Error al crear centro con admin:', error);
      // Proporcionar mensaje de error más específico
      if (error.message?.includes('EMAIL_EXISTS')) {
        throw new Error('El email del administrador ya está registrado');
      }
      throw error;
    }
  }

  /**
   * Obtiene invitación pendiente por email
   */
  async getInvitacionPendiente(email: string): Promise<any> {
    const invitacionesRef = collection(this.firestore, 'invitaciones');
    const q = query(invitacionesRef, where('email', '==', email), where('estado', '==', 'pendiente'));
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }
    return null;
  }

  /**
   * Completa el registro del administrador después de que se registre
   */
  async completarRegistroAdmin(invitacionId: string, adminUid: string): Promise<void> {
    // Actualizar la invitación
    const invitacionRef = doc(this.firestore, `invitaciones/${invitacionId}`);
    await updateDoc(invitacionRef, {
      estado: 'completada',
      adminUid: adminUid,
      fechaCompletada: new Date()
    });

    // Obtener datos de la invitación
    const invitacionDoc = await getDoc(invitacionRef);
    const invitacion = invitacionDoc.data();

    if (invitacion) {
      // Actualizar el centro con el adminId real
      const centroRef = doc(this.firestore, `centrosSalud/${invitacion['centroId']}`);
      await updateDoc(centroRef, {
        adminId: adminUid
      });
    }
  }
}
