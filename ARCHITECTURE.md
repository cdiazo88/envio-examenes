# 🏗️ Arquitectura del Sistema de Gestión de Exámenes

## 📐 Visión General

Este sistema está construido con **Angular 17** usando **Standalone Components**, **Firebase** como backend (Firestore, Authentication, Storage) y **TailwindCSS** para el diseño.

## 🎯 Arquitectura de Tres Capas

### 1. Capa de Presentación (Frontend)
- **Framework**: Angular 17 con Standalone Components
- **Enrutamiento**: Angular Router con lazy loading
- **Estado**: RxJS Observables y BehaviorSubjects
- **Estilos**: TailwindCSS

### 2. Capa de Lógica de Negocio (Services)
- **Servicios**: Injectable services con dependency injection
- **Guards**: Protección de rutas basada en autenticación y roles
- **Interceptors**: (Para futuras implementaciones)

### 3. Capa de Datos (Firebase)
- **Authentication**: Gestión de usuarios y sesiones
- **Firestore**: Base de datos NoSQL
- **Storage**: Almacenamiento de archivos (PDF/Imágenes)

---

## 📊 Modelo de Datos

### Colecciones en Firestore

#### 1. **users**
```typescript
{
  uid: string,
  email: string,
  role: 'super_admin' | 'admin_centro' | 'destinatario',
  nombre: string,
  apellido: string,
  telefono?: string,
  centroSaludId?: string,  // Solo para admin_centro
  activo: boolean,
  fechaCreacion: Timestamp,
  fechaActualizacion: Timestamp
}
```

#### 2. **centrosSalud**
```typescript
{
  id: string,
  nombre: string,
  direccion: string,
  telefono: string,
  email: string,
  ciudad: string,
  provincia: string,
  codigoPostal: string,
  ruc?: string,
  logo?: string,
  activo: boolean,
  adminEmail?: string,
  fechaCreacion: Timestamp,
  fechaActualizacion: Timestamp
}
```

#### 3. **pacientes**
```typescript
{
  id: string,
  tipo: 'paciente',
  centroSaludId: string,
  nombre: string,
  apellido: string,
  cedula: string,
  email: string,
  telefono?: string,
  fechaNacimiento: Date,
  genero: 'M' | 'F' | 'Otro',
  direccion?: string,
  activo: boolean,
  credencialesGeneradas: boolean,
  passwordTemporal?: string,
  fechaCreacion: Timestamp,
  fechaActualizacion: Timestamp
}
```

#### 4. **entidades**
```typescript
{
  id: string,
  tipo: 'entidad',
  centroSaludId: string,
  nombreEntidad: string,
  ruc: string,
  razonSocial: string,
  email: string,
  telefono?: string,
  contactoNombre?: string,
  direccion?: string,
  activo: boolean,
  credencialesGeneradas: boolean,
  passwordTemporal?: string,
  fechaCreacion: Timestamp,
  fechaActualizacion: Timestamp
}
```

#### 5. **examenes**
```typescript
{
  id: string,
  centroSaludId: string,
  destinatarioId: string,
  destinatarioTipo: 'paciente' | 'entidad',
  destinatarioNombre: string,
  tipoExamen: string,
  descripcion?: string,
  archivos: Array<{
    nombre: string,
    url: string,
    tipo: 'application/pdf' | 'image/jpeg' | 'image/png',
    tamano: number,
    fechaCarga: Timestamp
  }>,
  estado: 'pendiente' | 'listo' | 'notificado' | 'visualizado' | 'descargado',
  fechaCreacion: Timestamp,
  fechaActualizacion: Timestamp,
  fechaVisualizacion?: Timestamp,
  fechaDescarga?: Timestamp,
  creadoPor: string,
  observaciones?: string
}
```

#### 6. **notificaciones**
```typescript
{
  id: string,
  destinatarioId: string,
  examenId?: string,
  tipo: 'examen_listo' | 'credenciales_generadas' | 'sistema',
  titulo: string,
  mensaje: string,
  leida: boolean,
  fechaCreacion: Timestamp,
  fechaLectura?: Timestamp
}
```

---

## 🔐 Sistema de Autenticación y Autorización

### Flujo de Autenticación

```
1. Usuario ingresa credenciales
   ↓
2. Firebase Auth valida
   ↓
3. Se obtiene el UID
   ↓
4. Se consulta Firestore users/{uid}
   ↓
5. Se carga SessionInfo con rol
   ↓
6. Router redirige según rol
```

### Niveles de Acceso

#### SuperAdmin (`super_admin`)
- ✅ Acceso total al sistema
- ✅ CRUD de Centros de Salud
- ✅ Creación de Admins de Centro
- ✅ Vista de todas las colecciones
- 🚫 No puede ver exámenes de pacientes directamente

#### Admin de Centro (`admin_centro`)
- ✅ Gestión de pacientes y entidades de su centro
- ✅ Carga de exámenes
- ✅ Generación de credenciales
- ✅ Vista limitada a su centro (`centroSaludId`)
- 🚫 No puede ver otros centros
- 🚫 No puede crear centros

#### Destinatario (`destinatario`)
- ✅ Ver sus propios exámenes
- ✅ Descargar sus archivos
- ✅ Actualizar su perfil
- 🚫 No puede ver exámenes de otros
- 🚫 No puede gestionar nada más

---

## 🛡️ Seguridad

### Firebase Security Rules

#### Reglas Clave de Firestore

1. **Principio de Mínimo Privilegio**: Solo se otorga acceso estrictamente necesario
2. **Validación de Roles**: Todas las operaciones verifican el rol del usuario
3. **Scope por Centro**: Admins solo acceden a datos de su centro
4. **Ownership**: Destinatarios solo ven sus propios datos

#### Reglas Clave de Storage

1. **Validación de Tipo**: Solo PDF e imágenes permitidos
2. **Límites de Tamaño**: 
   - Exámenes: 10MB
   - Logos: 2MB
   - Avatares: 1MB
3. **Path-based Access**: Rutas estructuradas por centro y destinatario

### Guards de Angular

- **authGuard**: Verifica autenticación
- **noAuthGuard**: Evita acceso de usuarios autenticados a login
- **superAdminGuard**: Solo SuperAdmin
- **adminCentroGuard**: Solo Admin de Centro
- **destinatarioGuard**: Solo Destinatario
- **adminGuard**: SuperAdmin o Admin de Centro

---

## 🔄 Flujos de Trabajo Principales

### 1. Creación de Centro de Salud (SuperAdmin)

```
1. SuperAdmin crea centro en Firestore
   ↓
2. Opcionalmente crea admin del centro
   ↓
3. Se genera registro en users con role: admin_centro
   ↓
4. Se envía email con credenciales (TODO)
```

### 2. Alta de Paciente (Admin Centro)

```
1. Admin ingresa datos del paciente
   ↓
2. Se crea registro en pacientes
   ↓
3. Si genera credenciales:
   a. Se crea usuario en Firebase Auth
   b. Se guarda en users con role: destinatario
   c. Se genera password temporal
   d. Se envía email (TODO)
```

### 3. Carga de Examen (Admin Centro)

```
1. Admin selecciona destinatario
   ↓
2. Sube archivos (PDF/Imágenes)
   ↓
3. Archivos se suben a Storage:
   examenes/{centroId}/{destinatarioId}/files
   ↓
4. Se crea registro en Firestore examenes
   ↓
5. Estado inicial: 'listo'
   ↓
6. Se crea notificación para destinatario
```

### 4. Consulta de Examen (Destinatario)

```
1. Destinatario ve lista de sus exámenes
   ↓
2. Hace clic en un examen
   ↓
3. Estado cambia a 'visualizado'
   ↓
4. Puede descargar archivos
   ↓
5. Al descargar, estado cambia a 'descargado'
```

---

## 🏛️ Patrones de Diseño Utilizados

### 1. **Singleton Pattern**
- Servicios Injectable con `providedIn: 'root'`
- Una sola instancia en toda la aplicación

### 2. **Observer Pattern**
- RxJS Observables para reactividad
- BehaviorSubject para estado compartido

### 3. **Guard Pattern**
- Functional guards para protección de rutas
- Composición de guards para reglas complejas

### 4. **Lazy Loading Pattern**
- Carga diferida de módulos de features
- Optimización de performance

### 5. **Repository Pattern**
- Servicios como capa de abstracción sobre Firebase
- Separación de lógica de datos

---

## 📦 Estructura de Carpetas

```
src/app/
├── core/                           # Núcleo de la aplicación
│   ├── guards/                     # Guards de autorización
│   │   ├── auth.guard.ts          # Guard de autenticación
│   │   ├── role.guard.ts          # Guards por rol
│   │   └── index.ts
│   ├── models/                     # Interfaces y tipos
│   │   ├── user.model.ts
│   │   ├── centro-salud.model.ts
│   │   ├── destinatario.model.ts
│   │   ├── examen.model.ts
│   │   ├── auth.model.ts
│   │   ├── notificacion.model.ts
│   │   └── index.ts
│   └── services/                   # Servicios de negocio
│       ├── auth.service.ts         # Autenticación
│       ├── user.service.ts         # Gestión de usuarios
│       ├── centro-salud.service.ts # Centros de salud
│       ├── destinatario.service.ts # Pacientes y entidades
│       ├── examen.service.ts       # Exámenes
│       ├── storage.service.ts      # Firebase Storage
│       └── index.ts
├── features/                       # Funcionalidades por módulo
│   ├── auth/                       # Autenticación
│   │   ├── login/
│   │   └── reset-password/
│   ├── super-admin/                # Dashboard SuperAdmin
│   │   ├── layout/
│   │   ├── dashboard/
│   │   └── centros/
│   ├── admin-centro/               # Dashboard Admin Centro
│   │   ├── layout/
│   │   ├── dashboard/
│   │   ├── pacientes/
│   │   ├── entidades/
│   │   └── examenes/
│   └── destinatario/               # Portal Destinatarios
│       ├── layout/
│       ├── examenes/
│       └── perfil/
├── shared/                         # Componentes compartidos
│   └── components/
│       ├── navbar/                 # Barra de navegación
│       ├── unauthorized/           # Página 403
│       └── not-found/              # Página 404
├── app.component.ts                # Componente raíz
├── app.config.ts                   # Configuración de providers
└── app.routes.ts                   # Configuración de rutas
```

---

## 🚀 Optimizaciones

### Performance

1. **Lazy Loading**: Módulos cargados bajo demanda
2. **OnPush Change Detection**: (Para implementar en componentes)
3. **TrackBy en ngFor**: (Para implementar en listas)
4. **Standalone Components**: Bundle size reducido

### SEO y Accesibilidad

1. **Meta tags**: Configurados en index.html
2. **Semantic HTML**: Uso de etiquetas semánticas
3. **ARIA labels**: (Para implementar)
4. **Keyboard navigation**: Soporte de teclado

### Seguridad

1. **Firebase Rules**: Validación en backend
2. **Guards**: Protección en frontend
3. **Sanitización**: Angular sanitiza automáticamente
4. **HTTPS**: Obligatorio en producción

---

## 🔮 Próximas Mejoras

### Funcionalidades Pendientes

- [ ] Sistema de notificaciones push
- [ ] Envío automático de emails
- [ ] Reportes y estadísticas avanzadas
- [ ] Sistema de auditoría
- [ ] Panel de configuración
- [ ] Multi-idioma (i18n)
- [ ] Modo oscuro
- [ ] Exportación de datos a Excel/PDF

### Mejoras Técnicas

- [ ] Implementar OnPush change detection
- [ ] Agregar tests unitarios
- [ ] Agregar tests e2e
- [ ] PWA capabilities
- [ ] Offline mode
- [ ] Caching strategies
- [ ] Service Worker

---

## 📚 Recursos

- [Angular Documentation](https://angular.io/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)
- [RxJS Documentation](https://rxjs.dev/)

---

**Última actualización**: Febrero 2026
