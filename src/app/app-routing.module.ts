import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { WebComponent } from './components/web/web.component';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'home/view',
    pathMatch: 'full'
  },
  {
    path: 'web',
    redirectTo: 'home/view',
    pathMatch: 'full'
  },
  {
    path: 'products',
    loadChildren: () => import('./products/products.module').then(m => m.ProductsModule)
  },
  {
    path: 'product/:id',
    redirectTo: 'products/details/:id',
    pathMatch: 'full'
  },
  {
    path: 'p/:id',
    redirectTo: 'products/details/:id',
    pathMatch: 'full'
  },
  {
    path: 'home',
    loadChildren: () => import('./home/home.module').then(m => m.HomeModule),
  },
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.module').then(m => m.AdminModule)
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
