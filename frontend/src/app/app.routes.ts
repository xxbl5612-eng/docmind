import { Routes } from '@angular/router';
import { AuthGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/landing/landing.component').then(m => m.LandingComponent),
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register.component').then(m => m.RegisterComponent),
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [AuthGuard],
  },
  {
    path: 'documents/:id',
    loadComponent: () => import('./pages/document-editor/document-editor.component').then(m => m.DocumentEditorComponent),
    canActivate: [AuthGuard],
  },
  {
    path: 'documents/:id/versions',
    loadComponent: () => import('./pages/version-history/version-history.component').then(m => m.VersionHistoryComponent),
    canActivate: [AuthGuard],
  },
  {
    path: 'documents/:id/collaboration',
    loadComponent: () => import('./pages/collaboration/collaboration.component').then(m => m.CollaborationComponent),
    canActivate: [AuthGuard],
  },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin-dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent),
    canActivate: [AuthGuard],
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent),
    canActivate: [AuthGuard],
  },
  {
    path: 'auth/github/callback',
    loadComponent: () => import('./pages/auth-callback/auth-callback.component').then(m => m.AuthCallbackComponent),
  },
  {
    path: 'github/import',
    loadComponent: () => import('./pages/github-import/github-import.component').then(m => m.GitHubImportComponent),
    canActivate: [AuthGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
