import { Routes } from '@angular/router';
import { authGuard, noAuthGuard, superAdminGuard, adminCentroGuard, destinatarioGuard } from '@core/guards';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/auth/login',
    pathMatch: 'full'
  },
  {
    path: 'auth',
    canActivate: [noAuthGuard],
    children: [
      {
        path: 'login',
        loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
      },
      {
        path: 'reset-password',
        loadComponent: () => import('./features/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent)
      }
    ]
  },
  {
    path: 'super-admin',
    canActivate: [authGuard, superAdminGuard],
    loadComponent: () => import('./features/super-admin/layout/layout.component').then(m => m.LayoutComponent),
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/super-admin/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'centros',
        loadComponent: () => import('./features/super-admin/centros/centros-list/centros-list.component').then(m => m.CentrosListComponent)
      },
      {
        path: 'centros/crear',
        loadComponent: () => import('./features/super-admin/centros/centro-form/centro-form.component').then(m => m.CentroFormComponent)
      },
      {
        path: 'centros/editar/:id',
        loadComponent: () => import('./features/super-admin/centros/centro-form/centro-form.component').then(m => m.CentroFormComponent)
      },
      {
        path: 'centros/:id/examenes',
        loadComponent: () => import('./features/super-admin/centros/centro-examenes/centro-examenes.component').then(m => m.CentroExamenesComponent)
      }
    ]
  },
  {
    path: 'admin-centro',
    canActivate: [authGuard, adminCentroGuard],
    loadComponent: () => import('./features/admin-centro/layout/layout.component').then(m => m.LayoutComponent),
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/admin-centro/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'pacientes',
        loadComponent: () => import('./features/admin-centro/pacientes/pacientes-list/pacientes-list.component').then(m => m.PacientesListComponent)
      },
      {
        path: 'pacientes/crear',
        loadComponent: () => import('./features/admin-centro/pacientes/paciente-form/paciente-form.component').then(m => m.PacienteFormComponent)
      },
      {
        path: 'pacientes/editar/:id',
        loadComponent: () => import('./features/admin-centro/pacientes/paciente-form/paciente-form.component').then(m => m.PacienteFormComponent)
      },
      {
        path: 'entidades',
        loadComponent: () => import('./features/admin-centro/entidades/entidades-list/entidades-list.component').then(m => m.EntidadesListComponent)
      },
      {
        path: 'entidades/crear',
        loadComponent: () => import('./features/admin-centro/entidades/entidad-form/entidad-form.component').then(m => m.EntidadFormComponent)
      },
      {
        path: 'entidades/editar/:id',
        loadComponent: () => import('./features/admin-centro/entidades/entidad-form/entidad-form.component').then(m => m.EntidadFormComponent)
      },
      {
        path: 'examenes',
        loadComponent: () => import('./features/admin-centro/examenes/examenes-list/examenes-list.component').then(m => m.ExamenesListComponent)
      },
      {
        path: 'examenes/nuevo',
        loadComponent: () => import('./features/admin-centro/examenes/examen-form/examen-form.component').then(m => m.ExamenFormComponent)
      },
      {
        path: 'examenes/editar/:id',
        loadComponent: () => import('./features/admin-centro/examenes/examen-form/examen-form.component').then(m => m.ExamenFormComponent)
      }
    ]
  },
  {
    path: 'destinatario',
    canActivate: [authGuard, destinatarioGuard],
    loadComponent: () => import('./features/destinatario/layout/layout.component').then(m => m.LayoutComponent),
    children: [
      {
        path: '',
        redirectTo: 'examenes',
        pathMatch: 'full'
      },
      {
        path: 'examenes',
        loadComponent: () => import('./features/destinatario/examenes/examenes-list/examenes-list.component').then(m => m.ExamenesListComponent)
      },
      {
        path: 'examenes/:id',
        loadComponent: () => import('./features/destinatario/examenes/examen-detail/examen-detail.component').then(m => m.ExamenDetailComponent)
      }
    ]
  },
  {
    path: 'unauthorized',
    loadComponent: () => import('./shared/components/unauthorized/unauthorized.component').then(m => m.UnauthorizedComponent)
  },
  {
    path: '**',
    loadComponent: () => import('./shared/components/not-found/not-found.component').then(m => m.NotFoundComponent)
  }
];
