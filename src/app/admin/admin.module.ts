import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AdminRoutingModule } from './admin-routing.module';
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
import { SharedModule } from '../shared/shared.module';

@NgModule({
  declarations: [
    AdminComponent,
    AdminDashboardComponent,
    AdminReportsComponent,
    AdminProductsComponent,
    AdminProductsListComponent,
    AdminProductAddComponent,
    AdminCategoriesComponent,
    AdminProductBulkComponent,
    AdminOrdersComponent,
    AdminDeliveryComponent,
    AdminLoginComponent,
    AdminUsersComponent,
    AdminBannersComponent,
    AdminZonesComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    AdminRoutingModule,
    SharedModule
  ]
})
export class AdminModule { }
