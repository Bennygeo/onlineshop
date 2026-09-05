import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CartListComponent } from '../components/cart-list/cart-list.component';
import { ProductListComponent } from '../components/product-list/product-list.component';
import { SearchComponent } from '../components/search/search.component';

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
