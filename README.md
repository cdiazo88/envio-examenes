# 🏥 Sistema de Gestión de Exámenes de Salud

Plataforma web para la gestión integral de exámenes médicos con tres niveles de acceso: SuperAdmin, Admin de Centro y Destinatarios.

## 🚀 Tecnologías

- **Angular 17** (Standalone Components)
- **Firebase** (Authentication, Firestore, Storage)
- **TailwindCSS** (Diseño responsivo)
- **TypeScript** (Tipado fuerte)

## 📋 Características

### SuperAdmin
- ✅ CRUD completo de Centros de Salud
- ✅ Gestión de administradores de centros
- ✅ Vista global del sistema

### Admin de Centro
- ✅ Gestión de pacientes
- ✅ Gestión de entidades
- ✅ Carga de exámenes (PDF/Imágenes)
- ✅ Generación automática de credenciales
- ✅ Notificaciones por email

### Destinatarios (Paciente/Entidad)
- ✅ Consulta de resultados de exámenes
- ✅ Descarga de documentos
- ✅ Historial de exámenes

## 🛠️ Instalación

```bash
# Instalar dependencias
npm install

# Servir en desarrollo
npm start

# Build para producción
npm run build
```

## 🔧 Configuración de Firebase

1. Crear proyecto en Firebase Console
2. Habilitar Authentication (Email/Password)
3. Crear base de datos Firestore
4. Configurar Storage
5. Copiar credenciales a `src/environments/environment.ts`

## 📁 Estructura del Proyecto

```
src/
├── app/
│   ├── core/                    # Servicios core y guards
│   │   ├── guards/              # Guards de autenticación y roles
│   │   ├── models/              # Interfaces y tipos
│   │   ├── services/            # Servicios de negocio
│   │   └── interceptors/        # HTTP interceptors
│   ├── features/                # Módulos de funcionalidades
│   │   ├── auth/                # Autenticación
│   │   ├── super-admin/         # Dashboard SuperAdmin
│   │   ├── admin-centro/        # Dashboard Admin Centro
│   │   └── destinatario/        # Portal Destinatarios
│   ├── shared/                  # Componentes compartidos
│   │   ├── components/          # Componentes reutilizables
│   │   └── pipes/               # Pipes personalizados
│   └── app.routes.ts            # Configuración de rutas
├── environments/                # Configuración de entornos
└── styles.scss                  # Estilos globales

## 🔐 Seguridad

- Firebase Security Rules configuradas
- Guards de autenticación en todas las rutas protegidas
- Validación de roles en frontend y backend
- Tokens de autenticación seguros

## 📱 Responsive Design

Diseñado con TailwindCSS para una experiencia óptima en:
- 📱 Móviles
- 💻 Tablets
- 🖥️ Desktop

## 📧 Contacto

Desarrollado por Carlos Díaz
