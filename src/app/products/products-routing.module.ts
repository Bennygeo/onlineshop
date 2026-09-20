import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CartListComponent } from '../components/cart-list/cart-list.component';
import { ProductListComponent } from '../components/product-list/product-list.component';
import { SearchComponent } from '../components/search/search.component';
import { ProductDetailComponent } from '../components/product-detail/product-detail.component';

const routes: Routes = [
  {
    path: 'category',
    component: ProductListComponent
  },
  {
    path: 'category/:id',
    component: ProductListComponent
  },
  {
    path: 'details/:id',
    component: ProductDetailComponent
  },
  {
    path: 'detail/:id',
    component: ProductDetailComponent
  },
  {
    path: 'item/:id',
    component: ProductDetailComponent
  },
  {
    path: "cart",
    component: CartListComponent
  },
  {
    path: "search",
    component: SearchComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ProductsRoutingModule { }
