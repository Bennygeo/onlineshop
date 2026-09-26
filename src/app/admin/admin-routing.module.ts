import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminComponent } from './admin.component';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard.component';
import { AdminProductsComponent } from './admin-products/admin-products.component';
import { AdminProductsListComponent } from './admin-products/admin-products-list/admin-products-list.component';
import { AdminProductAddComponent } from './admin-products/admin-product-add/admin-product-add.component';
import { AdminCategoriesComponent } from './admin-products/admin-categories/admin-categories.component';
import { AdminProductBulkComponent } from './admin-products/admin-product-bulk/admin-product-bulk.component';
import { AdminOrdersComponent } from './admin-orders/admin-orders.component';
import { AdminDeliveryComponent } from './admin-delivery/admin-delivery.component';
import { AdminLoginComponent } from './admin-login/admin-login.component';
import { AdminUsersComponent } from './admin-users/admin-users.component';
import { AdminBannersComponent } from './admin-banners/admin-banners.component';
import { AdminReportsComponent } from './admin-reports/admin-reports.component';
import { AdminZonesComponent } from './admin-zones/admin-zones.component';
import { AdminAuthGuard } from './guards/admin-auth.guard';

const routes: Routes = [
  {
    path: 'login',
    component: AdminLoginComponent
  },
  {
    path: '',
    component: AdminComponent,
    canActivate: [AdminAuthGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: AdminDashboardComponent },
      { path: 'reports', component: AdminReportsComponent },
      { path: 'users', component: AdminUsersComponent },
      { path: 'banners', component: AdminBannersComponent },
      {
        path: 'products',
        component: AdminProductsComponent,
        children: [
          { path: '', redirectTo: 'list', pathMatch: 'full' },
          { path: 'list', component: AdminProductsListComponent },
          { path: 'add', component: AdminProductAddComponent },
          { path: 'categories', component: AdminCategoriesComponent },
          { path: 'bulk', component: AdminProductBulkComponent }
        ]
      },
      { path: 'orders', component: AdminOrdersComponent },
      { path: 'delivery', component: AdminDeliveryComponent },
      { path: 'zones', component: AdminZonesComponent }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule { }
