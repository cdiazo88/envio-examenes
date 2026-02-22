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
  CollectionReference,
  DocumentReference
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Observable, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import {
  Destinatario,
  Paciente,
  Entidad,
  CreatePacienteDto,
  CreateEntidadDto,
  TipoDestinatario,
  UserRole
} from '@core/models';

/**
 * Servicio de gestión de Destinatarios (Pacientes y Entidades)
 */
@Injectable({
  providedIn: 'root'
})
export class DestinatarioService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private functions = inject(Functions);

  private pacientesCollection = collection(
    this.firestore,
    'pacientes'
  ) as CollectionReference<Paciente>;

  private entidadesCollection = collection(
    this.firestore,
    'entidades'
  ) as CollectionReference<Entidad>;

  /**
   * Genera una contraseña temporal aleatoria
   */
  private generateTempPassword(): string {
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }

  /**
   * Elimina campos undefined de un objeto (Firestore no los acepta)
   */
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
   * Limpia autenticación asociada a un destinatario por email.
   * Intenta eliminar cuenta en Firebase Auth cuando se dispone de contraseña temporal,
   * y siempre elimina el documento en colección users.
   */
  private async cleanupAuthByEmail(email?: string, passwordTemporal?: string): Promise<void> {
    if (!email) return;

    try {
      const deleteRecipientAuth = httpsCallable<{ email: string }, { success: boolean }>(
        this.functions,
        'deleteRecipientAuth'
      );
      await deleteRecipientAuth({ email });
      return;
    } catch (error) {
      console.warn('Cloud Function deleteRecipientAuth no disponible o falló. Se intenta fallback local:', error);
    }

    const usersRef = collection(this.firestore, 'users');
    const userQuery = query(usersRef, where('email', '==', email));
    const userSnapshot = await getDocs(userQuery);

    if (!userSnapshot.empty && passwordTemporal) {
      try {
        const firebaseApiKey = this.auth.app.options.apiKey;

        const signInResponse = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email,
              password: passwordTemporal,
              returnSecureToken: true
            })
          }
        );

        if (signInResponse.ok) {
          const signInData = await signInResponse.json();
          const deleteResponse = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${firebaseApiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idToken: signInData.idToken })
            }
          );

          if (!deleteResponse.ok) {
            const deleteError = await deleteResponse.json();
            console.warn('No se pudo eliminar usuario en Firebase Auth:', deleteError);
          }
        } else {
          const signInError = await signInResponse.json();
          console.warn('No se pudo autenticar para borrar usuario en Firebase Auth:', signInError);
        }
      } catch (error) {
        console.warn('Error al intentar eliminar usuario en Firebase Auth:', error);
      }
    }

    if (!userSnapshot.empty) {
      await Promise.all(userSnapshot.docs.map(userDoc => deleteDoc(doc(this.firestore, `users/${userDoc.id}`))));
    }
  }

  /**
   * Crea un nuevo Paciente
   */
  createPaciente(data: CreatePacienteDto, centroSaludId: string): Observable<Paciente> {
    // Si es particular, siempre generar contraseña
    const esParticular = !data.entidadId || data.entidadId === '';
    const passwordTemporal = esParticular ? this.generateTempPassword() : undefined;

    const newPaciente: any = {
      tipo: TipoDestinatario.PACIENTE,
      centroSaludId,
      nombre: data.nombre,
      apellido: data.apellido,
      cedula: data.cedula,
      email: data.email,
      telefono: data.telefono,
      fechaNacimiento: data.fechaNacimiento,
      genero: data.genero,
      direccion: data.direccion,
      entidadId: data.entidadId && data.entidadId !== '' ? data.entidadId : undefined,
      activo: true,
      credencialesGeneradas: esParticular, // Siempre true si es particular
      passwordTemporal: passwordTemporal, // Guardar la contraseña generada
      fechaCreacion: new Date(),
      fechaActualizacion: new Date()
    };

    // Eliminar campos undefined antes de guardar en Firestore
    const cleanedPaciente = this.cleanUndefinedFields(newPaciente);

    return from(addDoc(this.pacientesCollection, cleanedPaciente)).pipe(
      map(async (docRef) => {
        // Si es particular, crear usuario usando REST API (no cierra sesión actual)
        if (esParticular && passwordTemporal) {
          try {
            const firebaseApiKey = this.auth.app.options.apiKey;
            const createUserResponse = await fetch(
              `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseApiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: data.email,
                  password: passwordTemporal,
                  returnSecureToken: true
                })
              }
            );

            if (!createUserResponse.ok) {
              const error = await createUserResponse.json();
              console.error('Error de Firebase Auth:', error);
              // Si falla, eliminar el documento del paciente
              await deleteDoc(doc(this.pacientesCollection, docRef.id));
              throw new Error(error.error?.message || 'Error al crear usuario');
            }

            const userData = await createUserResponse.json();
            const uid = userData.localId;

            // Guardar info del usuario en colección users
            const userDoc = doc(this.firestore, `users/${uid}`);
            await setDoc(userDoc, {
              uid,
              email: data.email,
              role: UserRole.DESTINATARIO,
              nombre: data.nombre,
              apellido: data.apellido,
              telefono: data.telefono,
              centroSaludId,
              activo: true,
              fechaCreacion: new Date(),
              fechaActualizacion: new Date()
            });

            console.log(`✅ Paciente particular creado. Email: ${data.email}, Password: ${passwordTemporal}`);
          } catch (authError: any) {
            console.error('Error al crear credenciales:', authError);
            throw authError;
          }
        }

        return { id: docRef.id, ...cleanedPaciente } as Paciente;
      }),
      switchMap(promise => from(promise))
    );
  }

  /**
   * Crea una nueva Entidad
   */
  createEntidad(data: CreateEntidadDto, centroSaludId: string): Observable<Entidad> {
    const passwordTemporal = data.generarCredenciales ? this.generateTempPassword() : undefined;

    const newEntidad: any = {
      tipo: TipoDestinatario.ENTIDAD,
      centroSaludId,
      nombreEntidad: data.nombreEntidad,
      ruc: data.ruc,
      razonSocial: data.razonSocial,
      email: data.email,
      telefono: data.telefono,
      contactoNombre: data.contactoNombre,
      direccion: data.direccion,
      activo: true,
      credencialesGeneradas: data.generarCredenciales,
      passwordTemporal: passwordTemporal, // Guardar la contraseña generada
      fechaCreacion: new Date(),
      fechaActualizacion: new Date()
    };

    // Eliminar campos undefined antes de guardar en Firestore
    const cleanedEntidad = this.cleanUndefinedFields(newEntidad);

    return from(addDoc(this.entidadesCollection, cleanedEntidad)).pipe(
      map(async (docRef) => {
        // Si se generan credenciales, crear usuario usando REST API (no cierra sesión actual)
        if (data.generarCredenciales && passwordTemporal) {
          try {
            const firebaseApiKey = this.auth.app.options.apiKey;
            const createUserResponse = await fetch(
              `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseApiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: data.email,
                  password: passwordTemporal,
                  returnSecureToken: true
                })
              }
            );

            if (!createUserResponse.ok) {
              const error = await createUserResponse.json();
              console.error('Error de Firebase Auth:', error);
              // Si falla, eliminar el documento de la entidad
              await deleteDoc(doc(this.entidadesCollection, docRef.id));
              throw new Error(error.error?.message || 'Error al crear usuario');
            }

            const userData = await createUserResponse.json();
            const uid = userData.localId;

            const userDoc = doc(this.firestore, `users/${uid}`);
            await setDoc(userDoc, {
              uid,
              email: data.email,
              role: UserRole.DESTINATARIO,
              nombre: data.nombreEntidad,
              apellido: '',
              telefono: data.telefono,
              centroSaludId,
              activo: true,
              fechaCreacion: new Date(),
              fechaActualizacion: new Date()
            });

            console.log(`✅ Entidad creada. Email: ${data.email}, Password: ${passwordTemporal}`);
          } catch (authError: any) {
            console.error('Error al crear credenciales:', authError);
            throw authError;
          }
        }

        return { id: docRef.id, ...cleanedEntidad } as Entidad;
      }),
      switchMap(promise => from(promise))
    );
  }

  /**
   * Obtiene todos los pacientes de un centro
   */
  getPacientesByCentro(centroSaludId: string): Observable<Paciente[]> {
    const q = query(
      this.pacientesCollection,
      where('centroSaludId', '==', centroSaludId)
    );
    return from(getDocs(q)).pipe(
      map(snapshot => {
        const pacientes = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        // Ordenar en el cliente por apellido
        return pacientes.sort((a, b) => a.apellido.localeCompare(b.apellido));
      })
    );
  }

  /**
   * Obtiene todas las entidades de un centro
   */
  getEntidadesByCentro(centroSaludId: string): Observable<Entidad[]> {
    const q = query(
      this.entidadesCollection,
      where('centroSaludId', '==', centroSaludId)
    );
    return from(getDocs(q)).pipe(
      map(snapshot => {
        const entidades = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        // Ordenar en el cliente por nombre de entidad
        return entidades.sort((a, b) => a.nombreEntidad.localeCompare(b.nombreEntidad));
      })
    );
  }

  /**
   * Obtiene un paciente por ID
   */
  getPacienteById(id: string): Observable<Paciente | null> {
    const pacienteRef = doc(this.firestore, `pacientes/${id}`) as DocumentReference<Paciente>;
    return from(getDoc(pacienteRef)).pipe(
      map(docSnap => docSnap.exists() ? { ...docSnap.data(), id: docSnap.id } : null)
    );
  }

  /**
   * Obtiene un paciente por email
   */
  getPacienteByEmail(email: string): Observable<Paciente | null> {
    const q = query(this.pacientesCollection, where('email', '==', email));
    return from(getDocs(q)).pipe(
      map(snapshot => {
        if (snapshot.empty) return null;
        const docSnap = snapshot.docs[0];
        return { ...docSnap.data(), id: docSnap.id } as Paciente;
      })
    );
  }

  /**
   * Obtiene una entidad por ID
   */
  getEntidadById(id: string): Observable<Entidad | null> {
    const entidadRef = doc(this.firestore, `entidades/${id}`) as DocumentReference<Entidad>;
    return from(getDoc(entidadRef)).pipe(
      map(docSnap => docSnap.exists() ? { ...docSnap.data(), id: docSnap.id } : null)
    );
  }

  /**
   * Obtiene una entidad por email
   */
  getEntidadByEmail(email: string): Observable<Entidad | null> {
    const q = query(this.entidadesCollection, where('email', '==', email));
    return from(getDocs(q)).pipe(
      map(snapshot => {
        if (snapshot.empty) return null;
        const docSnap = snapshot.docs[0];
        return { ...docSnap.data(), id: docSnap.id } as Entidad;
      })
    );
  }

  /**
   * Obtiene pacientes asociados a una entidad
   */
  getPacientesByEntidad(entidadId: string): Observable<Paciente[]> {
    const q = query(this.pacientesCollection, where('entidadId', '==', entidadId));
    return from(getDocs(q)).pipe(
      map(snapshot => {
        const pacientes = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Paciente));
        return pacientes.sort((a, b) => a.apellido.localeCompare(b.apellido));
      })
    );
  }

  /**
   * Actualiza un paciente
   */
  updatePaciente(id: string, data: Partial<Paciente>, nuevaPassword?: string): Observable<void> {
    const pacienteRef = doc(this.firestore, `pacientes/${id}`);
    
    return from(getDoc(pacienteRef)).pipe(
      switchMap(async (docSnap) => {
        if (!docSnap.exists()) {
          throw new Error('Paciente no encontrado');
        }

        const paciente = docSnap.data() as Paciente;
        const updateData: any = { ...data, fechaActualizacion: new Date() };

        // Si hay nueva contraseña y el paciente tiene credenciales
        if (nuevaPassword && paciente.credencialesGeneradas && paciente.email) {
          try {
            // Buscar el usuario en la colección users por email
            const usersRef = collection(this.firestore, 'users');
            const q = query(usersRef, where('email', '==', paciente.email));
            const userSnapshot = await getDocs(q);

            if (!userSnapshot.empty) {
              const userDoc = userSnapshot.docs[0];
              const userId = userDoc.id;
              const firebaseApiKey = this.auth.app.options.apiKey;

              // Eliminar el usuario actual de Firebase Auth
              const deleteUserResponse = await fetch(
                `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${firebaseApiKey}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ localId: userId })
                }
              );

              // Crear nuevo usuario con la misma email pero nueva contraseña
              const createUserResponse = await fetch(
                `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseApiKey}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    email: paciente.email,
                    password: nuevaPassword,
                    returnSecureToken: true
                  })
                }
              );

              if (!createUserResponse.ok) {
                const error = await createUserResponse.json();
                throw new Error(error.error?.message || 'Error al actualizar contraseña');
              }

              const userData = await createUserResponse.json();
              const newUid = userData.localId;

              // Eliminar el documento del usuario anterior
              await deleteDoc(doc(this.firestore, `users/${userId}`));

              // Crear nuevo documento de usuario con el nuevo uid
              await setDoc(doc(this.firestore, `users/${newUid}`), {
                uid: newUid,
                email: paciente.email,
                role: UserRole.DESTINATARIO,
                nombre: data.nombre || paciente.nombre,
                apellido: data.apellido || paciente.apellido,
                telefono: data.telefono || paciente.telefono,
                centroSaludId: paciente.centroSaludId,
                activo: true,
                fechaCreacion: userDoc.data()?.['fechaCreacion'] || new Date(),
                fechaActualizacion: new Date()
              });

              // Actualizar la contraseña temporal en los datos del paciente
              updateData.passwordTemporal = nuevaPassword;
            }
          } catch (error) {
            console.error('Error al actualizar contraseña:', error);
            throw error;
          }
        }

        // Actualizar el documento del paciente
        await updateDoc(pacienteRef, updateData);
      })
    );
  }

  /**
   * Actualiza una entidad
   */
  updateEntidad(id: string, data: Partial<Entidad>): Observable<void> {
    const entidadRef = doc(this.firestore, `entidades/${id}`);
    const updateData = { ...data, fechaActualizacion: new Date() };
    return from(updateDoc(entidadRef, updateData as any));
  }

  /**
   * Elimina un paciente
   */
  deletePaciente(id: string): Observable<void> {
    const pacienteRef = doc(this.firestore, `pacientes/${id}`);
    return from(getDoc(pacienteRef)).pipe(
      switchMap(async (docSnap) => {
        if (docSnap.exists()) {
          const paciente = docSnap.data() as Paciente;
          await this.cleanupAuthByEmail(paciente.email, paciente.passwordTemporal);
        }

        await deleteDoc(pacienteRef);
      })
    );
  }

  /**
   * Elimina una entidad
   */
  deleteEntidad(id: string): Observable<void> {
    const entidadRef = doc(this.firestore, `entidades/${id}`);
    return from(getDoc(entidadRef)).pipe(
      switchMap(async (docSnap) => {
        if (docSnap.exists()) {
          const entidad = docSnap.data() as Entidad;
          await this.cleanupAuthByEmail(entidad.email, entidad.passwordTemporal);
        }

        await deleteDoc(entidadRef);
      })
    );
  }
}
