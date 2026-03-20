# 🏥 Sistema de Gestión de Exámenes de Salud - Guía de Inicio

## 📋 Prerrequisitos

Antes de comenzar, asegúrate de tener instalado:

- **Node.js** (v18 o superior)
- **npm** (v9 o superior)
- **Angular CLI** (v17 o superior)
- **Firebase CLI** (opcional, para deploy)

## 🚀 Instalación

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar Firebase

#### a) Crear proyecto en Firebase Console

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Crea un nuevo proyecto
3. Habilita **Authentication** con Email/Password
4. Crea una base de datos **Firestore**
5. Configura **Storage**

#### b) Obtener credenciales

1. En la configuración del proyecto, ve a "Configuración del proyecto"
2. Copia las credenciales de configuración de Firebase
3. Pega las credenciales en:
   - `src/environments/environment.development.ts` (desarrollo)
   - `src/environments/environment.ts` (producción)

Ejemplo:
```typescript
export const environment = {
  production: false,
  firebase: {
    apiKey: "TU_API_KEY",
    authDomain: "tu-proyecto.firebaseapp.com",
    projectId: "tu-proyecto-id",
    storageBucket: "tu-proyecto.appspot.com",
    messagingSenderId: "123456789",
    appId: "tu-app-id"
  }
};
```

#### c) Actualizar .firebaserc

Edita el archivo `.firebaserc` y reemplaza `tu-proyecto-id` con tu ID de proyecto Firebase:

```json
{
  "projects": {
    "default": "tu-proyecto-id-real"
  }
}
```

### 3. Desplegar Firebase Rules

```bash
# Instalar Firebase CLI si no lo tienes
npm install -g firebase-tools

# Iniciar sesión
firebase login

# Desplegar las reglas de seguridad
firebase deploy --only firestore:rules,storage:rules
```

### 4. Crear usuario SuperAdmin inicial

Debes crear manualmente el primer usuario SuperAdmin en Firebase Console:

1. Ve a **Authentication** > **Users**
2. Agrega un usuario con email y contraseña
3. Copia el **UID** del usuario creado
4. Ve a **Firestore Database**
5. Crea la colección `users` y un documento con el UID copiado:

```json
{
  "uid": "UID_DEL_USUARIO",
  "email": "admin@ejemplo.com",
  "role": "super_admin",
  "nombre": "Admin",
  "apellido": "Sistema",
  "activo": true,
  "fechaCreacion": [TIMESTAMP],
  "fechaActualizacion": [TIMESTAMP]
}
```

### 5. Reset total para salida a producción (opcional, destructivo)

Si necesitas dejar limpio el sistema antes de producción, existe un script que:

- Elimina **todas** las cuentas de Firebase Authentication
- Elimina todos los documentos de `users`
- Elimina todos los documentos de `centrosSalud`
- Crea un nuevo usuario `super_admin` en Auth + Firestore

Comando:

```bash
npm --prefix functions run reset:prod -- --confirm RESET_PROD --email nuevoadmin@empresa.cl --password "PasswordSegura123!" --nombre "Nuevo" --apellido "Administrador"
```

Simulación previa (sin borrar datos):

```bash
npm --prefix functions run reset:prod -- --dry-run --email nuevoadmin@empresa.cl --password "PasswordSegura123!" --nombre "Nuevo" --apellido "Administrador"
```

> ⚠️ Esta operación es irreversible. Ejecutar solo en el proyecto Firebase correcto.

## 💻 Desarrollo

### Iniciar servidor de desarrollo

```bash
npm start
# o
ng serve
```

La aplicación estará disponible en `http://localhost:4200/`

### Build para producción

```bash
npm run build
# o
ng build --configuration=production
```

Los archivos compilados estarán en la carpeta `dist/`

## 🔐 Estructura de Roles

### 1. SuperAdmin
- **Acceso**: `/super-admin`
- **Permisos**:
  - CRUD completo de Centros de Salud
  - Gestión de administradores de centros
  - Vista global del sistema

### 2. Admin de Centro
- **Acceso**: `/admin-centro`
- **Permisos**:
  - Gestión de pacientes y entidades
  - Carga de exámenes (PDF/Imágenes)
  - Generación automática de credenciales
  - Vista limitada a su centro

### 3. Destinatario (Paciente/Entidad)
- **Acceso**: `/destinatario`
- **Permisos**:
  - Consulta de sus propios exámenes
  - Descarga de documentos
  - Actualización de perfil

## 📁 Estructura del Proyecto

```
src/
├── app/
│   ├── core/                    # Servicios core y guards
│   │   ├── guards/              # Guards de autenticación y roles
│   │   ├── models/              # Interfaces y tipos
│   │   └── services/            # Servicios de negocio
│   ├── features/                # Módulos de funcionalidades
│   │   ├── auth/                # Autenticación
│   │   ├── super-admin/         # Dashboard SuperAdmin
│   │   ├── admin-centro/        # Dashboard Admin Centro
│   │   └── destinatario/        # Portal Destinatarios
│   ├── shared/                  # Componentes compartidos
│   │   └── components/          # Componentes reutilizables
│   ├── app.component.ts         # Componente raíz
│   ├── app.config.ts            # Configuración de la app
│   └── app.routes.ts            # Configuración de rutas
├── environments/                # Configuración de entornos
└── styles.scss                  # Estilos globales con Tailwind
```

## 🔧 Scripts Disponibles

```bash
# Desarrollo
npm start                 # Inicia servidor de desarrollo

# Build
npm run build            # Build de producción
npm run build:prod       # Build explícito de producción
npm run build:dev        # Build de desarrollo
npm run watch            # Build en modo watch

# Tests
npm test                 # Ejecuta tests unitarios
```

## 🤖 CI/CD con GitHub Actions

Se agregaron 2 workflows:

- `.github/workflows/ci.yml`: valida build de producción en Pull Requests a `main`.
- `.github/workflows/deploy-firebase.yml`: despliega a Firebase en push a `main` y también manualmente (`workflow_dispatch`).

### Secretos requeridos en GitHub

En tu repositorio, configura estos secrets para autenticación sin claves (OIDC):

- `GCP_WORKLOAD_IDENTITY_PROVIDER`: recurso completo del provider, por ejemplo:
  `projects/123456789/locations/global/workloadIdentityPools/github-pool/providers/github-provider`
- `GCP_SERVICE_ACCOUNT_EMAIL`: email de la service account usada para deploy, por ejemplo:
  `github-deploy@envio-examenes.iam.gserviceaccount.com`

Pasos sugeridos:

1. En Google Cloud, crea un Workload Identity Pool y un Provider de GitHub OIDC.
2. Crea/usa una Service Account para deploy.
3. Concede a esa Service Account permisos necesarios para Firebase (Hosting, Functions, Firestore Rules, Storage Rules).
4. Autoriza al principal del repo GitHub a impersonar la Service Account (`roles/iam.workloadIdentityUser`).
5. En GitHub: Settings → Secrets and variables → Actions → New repository secret.
6. Crea los secrets `GCP_WORKLOAD_IDENTITY_PROVIDER` y `GCP_SERVICE_ACCOUNT_EMAIL` con sus valores.

> Si tu organización bloquea creación de claves de Service Account, este enfoque OIDC es el recomendado y no requiere JSON privado.

### Flujo de despliegue

- PR a `main`: corre CI y valida que el build productivo compile.
- Merge/push a `main`: ejecuta deploy automático de `hosting`, `functions`, `firestore rules/indexes` y `storage rules`.
- Manual: desde la pestaña Actions puedes ejecutar el workflow `Deploy Firebase` cuando lo necesites.

## 🛡️ Seguridad

### Firebase Security Rules

Las reglas de seguridad están configuradas en:
- **Firestore**: `firestore.rules`
- **Storage**: `storage.rules`

Estas reglas garantizan:
- ✅ Acceso basado en roles
- ✅ Validación de datos
- ✅ Protección de archivos
- ✅ Límites de tamaño de archivos

### Buenas Prácticas

1. **Nunca** commitees las credenciales de Firebase al repositorio
2. Usa variables de entorno para configuración sensible
3. Mantén actualizadas las dependencias de seguridad
4. Revisa regularmente los logs de Firebase

## 🎨 Personalización

### Colores de TailwindCSS

Los colores están definidos en `tailwind.config.js`:

```javascript
colors: {
  primary: { ... },      // Azul
  secondary: { ... },    // Verde
  danger: { ... }        // Rojo
}
```

Puedes personalizarlos según tus necesidades.

## 📱 Características

- ✅ **Responsive Design**: Diseñado para móviles, tablets y desktop
- ✅ **Standalone Components**: Arquitectura moderna de Angular 17
- ✅ **Lazy Loading**: Carga optimizada de módulos
- ✅ **Firebase Integration**: Auth, Firestore y Storage configurados
- ✅ **TailwindCSS**: Diseño moderno y personalizable
- ✅ **TypeScript**: Tipado fuerte para mayor seguridad

## 🐛 Solución de Problemas

### Error: Firebase not configured
- Verifica que las credenciales en `environment.ts` sean correctas
- Asegúrate de que el proyecto Firebase esté activo

### Error: Permission denied
- Verifica que las Firebase Rules estén desplegadas
- Confirma que el usuario tenga el rol correcto en Firestore

### Error: Module not found
- Ejecuta `npm install` para instalar las dependencias
- Verifica los paths en `tsconfig.json`

## 📞 Soporte

Si encuentras algún problema o tienes preguntas:

1. Revisa la documentación de [Angular](https://angular.io/docs)
2. Consulta la documentación de [Firebase](https://firebase.google.com/docs)
3. Revisa los logs de la consola del navegador

## 📄 Licencia

Este proyecto es privado y confidencial.

---

¡Desarrollado con ❤️ para gestionar exámenes de salud de manera eficiente!
