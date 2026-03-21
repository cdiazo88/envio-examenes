import { Injectable, inject } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
  signOut,
  user,
  updatePassword,
  User as FirebaseUser,
  sendPasswordResetEmail
} from '@angular/fire/auth';
import {
  Firestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
  DocumentReference
} from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { Observable, from, BehaviorSubject, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { User, UserRole, LoginCredentials, SessionInfo } from '@core/models';

/**
 * Servicio de autenticación
 * Maneja login, logout, recuperación de contraseña y gestión de sesión
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private static readonly PACIENTE_SESSION_TIMEOUT_MS = 5 * 60 * 1000;
  private static readonly LOGIN_KEY_STORAGE_KEY = 'login_key';

  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);

  // Observable del usuario actual de Firebase
  private user$ = user(this.auth);

  // BehaviorSubject para la información de sesión completa
  private sessionSubject = new BehaviorSubject<SessionInfo | null>(null);
  public session$ = this.sessionSubject.asObservable();
  private pacienteSessionRemainingSecondsSubject = new BehaviorSubject<number | null>(null);
  public pacienteSessionRemainingSeconds$ = this.pacienteSessionRemainingSecondsSubject.asObservable();

  private sessionTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
  private sessionCountdownIntervalHandle: ReturnType<typeof setInterval> | null = null;
  private sessionTimeoutDeadline: number | null = null;
  private sessionExpiryWarningShown = false;
  private activityListenersAttached = false;
  private readonly activityEvents: Array<keyof WindowEventMap> = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
  private readonly onUserActivity = () => this.resetPacienteSessionTimer();

  constructor() {
    // Inicializar sesión al cargar el servicio
    this.initializeSession();
  }

  /**
   * Inicializa la sesión del usuario autenticado
   */
  private initializeSession(): void {
    this.user$.pipe(
      switchMap(firebaseUser => {
        if (firebaseUser) {
          const email = firebaseUser.email || '';
          return this.getUserData(firebaseUser.uid).pipe(
            switchMap(session => {
              if (session) {
                return from(this.enrichDestinatarioSession(session));
              }

              if (!email) {
                return of(null);
              }

              return from(this.recoverDestinatarioSession(firebaseUser.uid, email));
            })
          );
        }
        return of(null);
      })
    ).subscribe(userData => {
      this.sessionSubject.next(userData);
      this.updatePacienteSessionTracking(userData);
    });
  }

  /**
   * Obtiene los datos completos del usuario desde Firestore
   */
  private getUserData(uid: string): Observable<SessionInfo | null> {
    const userRef = doc(this.firestore, `users/${uid}`) as DocumentReference<User>;
    return from(getDoc(userRef)).pipe(
      map(docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          return {
            uid: data.uid,
            email: data.email,
            role: data.role,
            centroSaludId: data.centroSaludId,
            nombre: data.nombre,
            apellido: data.apellido
          } as SessionInfo;
        }
        return null;
      })
    );
  }

  /**
   * Inicia sesión con email y contraseña
   */
  login(credentials: LoginCredentials): Observable<SessionInfo | null> {
    return from(
      signInWithEmailAndPassword(this.auth, credentials.email, credentials.password)
    ).pipe(
      switchMap(userCredential => {
        const uid = userCredential.user.uid;
        const email = userCredential.user.email || credentials.email;

        return this.getUserData(uid).pipe(
          switchMap(session => {
            if (session) {
              return from(this.enrichDestinatarioSession(session));
            }

            return from(this.recoverDestinatarioSession(uid, email));
          }),
          map(session => {
            this.sessionSubject.next(session);
            this.updatePacienteSessionTracking(session);
            return session;
          })
        );
      })
    );
  }

  private async recoverDestinatarioSession(uid: string, email: string): Promise<SessionInfo | null> {
    const pacientesRef = collection(this.firestore, 'pacientes');
    const pacienteQuery = query(pacientesRef, where('email', '==', email), limit(1));
    const pacienteSnapshot = await getDocs(pacienteQuery);

    if (!pacienteSnapshot.empty) {
      const paciente = pacienteSnapshot.docs[0].data() as any;
      const session: SessionInfo = {
        uid,
        email,
        role: UserRole.DESTINATARIO,
        destinatarioTipo: 'paciente',
        centroSaludId: paciente.centroSaludId,
        nombre: paciente.nombre,
        apellido: paciente.apellido || ''
      };
      return session;
    }

    const entidadesRef = collection(this.firestore, 'entidades');
    const entidadQuery = query(entidadesRef, where('email', '==', email), limit(1));
    const entidadSnapshot = await getDocs(entidadQuery);

    if (!entidadSnapshot.empty) {
      const entidad = entidadSnapshot.docs[0].data() as any;
      const session: SessionInfo = {
        uid,
        email,
        role: UserRole.DESTINATARIO,
        destinatarioTipo: 'entidad',
        centroSaludId: entidad.centroSaludId,
        nombre: entidad.nombreEntidad,
        apellido: ''
      };
      return session;
    }

    return null;
  }

  private async enrichDestinatarioSession(session: SessionInfo): Promise<SessionInfo> {
    if (session.role !== UserRole.DESTINATARIO || session.destinatarioTipo || !session.email) {
      return session;
    }

    const destinatarioTipo = await this.resolveDestinatarioTipoByEmail(session.email);
    if (!destinatarioTipo) {
      return session;
    }

    return {
      ...session,
      destinatarioTipo
    };
  }

  private async resolveDestinatarioTipoByEmail(email: string): Promise<'paciente' | 'entidad' | null> {
    const pacientesRef = collection(this.firestore, 'pacientes');
    const pacienteQuery = query(pacientesRef, where('email', '==', email), limit(1));
    const pacienteSnapshot = await getDocs(pacienteQuery);

    if (!pacienteSnapshot.empty) {
      return 'paciente';
    }

    const entidadesRef = collection(this.firestore, 'entidades');
    const entidadQuery = query(entidadesRef, where('email', '==', email), limit(1));
    const entidadSnapshot = await getDocs(entidadQuery);

    if (!entidadSnapshot.empty) {
      return 'entidad';
    }

    return null;
  }

  /**
   * Cierra la sesión del usuario
   */
  async logout(): Promise<void> {
    this.stopPacienteSessionTracking();
    const loginQueryParams = this.getLoginQueryParams();
    await signOut(this.auth);
    this.sessionSubject.next(null);

    if (loginQueryParams) {
      this.router.navigate(['/auth/login'], { queryParams: loginQueryParams });
      return;
    }

    this.router.navigate(['/auth/login']);
  }

  getLoginQueryParams(): { key: string } | null {
    const loginKey = this.getPersistedLoginKey();
    if (!loginKey) {
      return null;
    }

    return { key: loginKey };
  }

  private getPersistedLoginKey(): string {
    if (typeof window === 'undefined') {
      return '';
    }

    const storedValue = window.sessionStorage.getItem(AuthService.LOGIN_KEY_STORAGE_KEY);
    if (!storedValue) {
      return '';
    }

    return storedValue
      .trim()
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, 60);
  }

  private updatePacienteSessionTracking(session: SessionInfo | null): void {
    if (this.isPacienteSession(session)) {
      this.startPacienteSessionTracking();
      this.resetPacienteSessionTimer();
      return;
    }

    this.stopPacienteSessionTracking();
  }

  private isPacienteSession(session: SessionInfo | null): boolean {
    return session?.role === UserRole.DESTINATARIO && session.destinatarioTipo === 'paciente';
  }

  private startPacienteSessionTracking(): void {
    if (typeof window === 'undefined' || this.activityListenersAttached) {
      return;
    }

    this.activityEvents.forEach(eventName => {
      window.addEventListener(eventName, this.onUserActivity);
    });
    this.activityListenersAttached = true;
  }

  private stopPacienteSessionTracking(): void {
    if (typeof window !== 'undefined' && this.activityListenersAttached) {
      this.activityEvents.forEach(eventName => {
        window.removeEventListener(eventName, this.onUserActivity);
      });
      this.activityListenersAttached = false;
    }

    if (this.sessionTimeoutHandle) {
      clearTimeout(this.sessionTimeoutHandle);
      this.sessionTimeoutHandle = null;
    }

    if (this.sessionCountdownIntervalHandle) {
      clearInterval(this.sessionCountdownIntervalHandle);
      this.sessionCountdownIntervalHandle = null;
    }

    this.sessionTimeoutDeadline = null;
    this.sessionExpiryWarningShown = false;
    this.pacienteSessionRemainingSecondsSubject.next(null);
  }

  private resetPacienteSessionTimer(): void {
    if (!this.isPacienteSession(this.sessionSubject.value)) {
      return;
    }

    if (this.sessionTimeoutHandle) {
      clearTimeout(this.sessionTimeoutHandle);
    }

    this.sessionTimeoutDeadline = Date.now() + AuthService.PACIENTE_SESSION_TIMEOUT_MS;
    this.sessionExpiryWarningShown = false;
    this.updatePacienteCountdown();
    this.startPacienteCountdownInterval();

    this.sessionTimeoutHandle = setTimeout(() => {
      this.logoutBySessionTimeout();
    }, AuthService.PACIENTE_SESSION_TIMEOUT_MS);
  }

  private startPacienteCountdownInterval(): void {
    if (this.sessionCountdownIntervalHandle) {
      return;
    }

    this.sessionCountdownIntervalHandle = setInterval(() => {
      this.updatePacienteCountdown();
    }, 1000);
  }

  private updatePacienteCountdown(): void {
    if (!this.sessionTimeoutDeadline) {
      this.pacienteSessionRemainingSecondsSubject.next(null);
      return;
    }

    const remainingMs = Math.max(0, this.sessionTimeoutDeadline - Date.now());
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    this.pacienteSessionRemainingSecondsSubject.next(remainingSeconds);

    if (!this.sessionExpiryWarningShown && remainingSeconds === 60 && typeof window !== 'undefined') {
      this.sessionExpiryWarningShown = true;
      window.alert('Tu sesión expirará en 1 minuto por inactividad.');
    }
  }

  private async logoutBySessionTimeout(): Promise<void> {
    if (!this.isPacienteSession(this.sessionSubject.value)) {
      return;
    }

    await this.logout();
  }

  /**
   * Envía email de recuperación de contraseña
   */
  resetPassword(email: string): Observable<void> {
    return from(sendPasswordResetEmail(this.auth, email));
  }

  /**
   * Cambia la contraseña del usuario actual
   */
  changePassword(newPassword: string): Observable<void> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) {
      throw new Error('No hay usuario autenticado');
    }
    return from(updatePassword(currentUser, newPassword));
  }

  /**
   * Obtiene la sesión actual
   */
  getCurrentSession(): SessionInfo | null {
    return this.sessionSubject.value;
  }

  /**
   * Verifica si el usuario está autenticado
   */
  isAuthenticated(): boolean {
    return this.sessionSubject.value !== null;
  }

  /**
   * Verifica si el usuario tiene un rol específico
   */
  hasRole(role: UserRole): boolean {
    const session = this.getCurrentSession();
    return session?.role === role;
  }

  /**
   * Verifica si el usuario es SuperAdmin
   */
  isSuperAdmin(): boolean {
    return this.hasRole(UserRole.SUPER_ADMIN);
  }

  /**
   * Verifica si el usuario es Admin de Centro
   */
  isAdminCentro(): boolean {
    return this.hasRole(UserRole.ADMIN_CENTRO);
  }

  /**
   * Verifica si el usuario es Destinatario
   */
  isDestinatario(): boolean {
    return this.hasRole(UserRole.DESTINATARIO);
  }

  /**
   * Obtiene el UID del usuario actual
   */
  getCurrentUserId(): string | null {
    return this.sessionSubject.value?.uid || null;
  }

  /**
   * Obtiene el Centro de Salud del usuario actual (si aplica)
   */
  getCurrentCentroSaludId(): string | undefined {
    return this.sessionSubject.value?.centroSaludId;
  }
}
