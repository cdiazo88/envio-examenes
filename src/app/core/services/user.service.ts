import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  CollectionReference,
  DocumentReference
} from '@angular/fire/firestore';
import {
  Auth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from '@angular/fire/auth';
import { Observable, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { User, CreateUserDto, UserRole } from '@core/models';

/**
 * Servicio de gestión de usuarios
 */
@Injectable({
  providedIn: 'root'
})
export class UserService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  private usersCollection = collection(this.firestore, 'users') as CollectionReference<User>;

  /**
   * Crea un nuevo usuario en Firebase Auth y Firestore
   */
  createUser(userData: CreateUserDto): Observable<User> {
    return from(
      createUserWithEmailAndPassword(this.auth, userData.email, userData.password)
    ).pipe(
      map(async (userCredential) => {
        const newUser: User = {
          uid: userCredential.user.uid,
          email: userData.email,
          role: userData.role,
          nombre: userData.nombre,
          apellido: userData.apellido,
          telefono: userData.telefono,
          centroSaludId: userData.centroSaludId,
          activo: true,
          fechaCreacion: new Date(),
          fechaActualizacion: new Date()
        };

        // Guardar en Firestore
        const docRef = doc(this.firestore, `users/${userCredential.user.uid}`);
        await setDoc(docRef, { ...newUser });

        return newUser;
      }),
      switchMap(promise => from(promise))
    );
  }

  /**
   * Obtiene un usuario por ID
   */
  getUserById(uid: string): Observable<User | null> {
    const userRef = doc(this.firestore, `users/${uid}`) as DocumentReference<User>;
    return from(getDoc(userRef)).pipe(
      map(docSnap => docSnap.exists() ? docSnap.data() : null)
    );
  }

  /**
   * Obtiene todos los usuarios (solo SuperAdmin)
   */
  getAllUsers(): Observable<User[]> {
    return from(getDocs(this.usersCollection)).pipe(
      map(snapshot => snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })))
    );
  }

  /**
   * Obtiene usuarios por rol
   */
  getUsersByRole(role: UserRole): Observable<User[]> {
    const q = query(this.usersCollection, where('role', '==', role));
    return from(getDocs(q)).pipe(
      map(snapshot => snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })))
    );
  }

  /**
   * Obtiene administradores de un centro específico
   */
  getAdminsByCentro(centroSaludId: string): Observable<User[]> {
    const q = query(
      this.usersCollection,
      where('centroSaludId', '==', centroSaludId),
      where('role', '==', UserRole.ADMIN_CENTRO)
    );
    return from(getDocs(q)).pipe(
      map(snapshot => snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })))
    );
  }

  /**
   * Actualiza un usuario
   */
  updateUser(uid: string, data: Partial<User>): Observable<void> {
    const userRef = doc(this.firestore, `users/${uid}`);
    const updateData = {
      ...data,
      fechaActualizacion: new Date()
    };
    return from(updateDoc(userRef, updateData as any));
  }

  /**
   * Desactiva un usuario (no lo elimina)
   */
  deactivateUser(uid: string): Observable<void> {
    return this.updateUser(uid, { activo: false });
  }

  /**
   * Activa un usuario
   */
  activateUser(uid: string): Observable<void> {
    return this.updateUser(uid, { activo: true });
  }

  /**
   * Envía email de restablecimiento de contraseña
   */
  sendPasswordReset(email: string): Observable<void> {
    return from(sendPasswordResetEmail(this.auth, email));
  }
}
