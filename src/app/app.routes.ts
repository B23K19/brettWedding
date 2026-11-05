import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layout/invitation/invitation').then((m) => m.Invitation),
  }
];
