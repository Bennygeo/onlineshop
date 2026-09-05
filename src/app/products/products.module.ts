import { CommonModule, DatePipe } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { ProductListComponent } from '../components/product-list/product-list.component';
import { ProductComponent } from '../components/product/product.component';

import { ProductsRoutingModule } from './products-routing.module';

import { MatLegacyFormFieldModule as MatFormFieldModule } from '@angular/material/legacy-form-field';

import { MatRadioModule } from '@angular/material/radio';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

import { MatLegacyInputModule as MatInputModule } from '@angular/material/legacy-input';
import { Utils } from '../utils/utils';
import { CartComponent } from '../components/cart/cart.component';
import { CartListComponent } from '../components/cart-list/cart-list.component';
import { ReplaceAll } from '../pipes/replace-all.pipe';
import { SharedModule } from '../shared/shared.module';
import { SearchComponent } from '../components/search/search.component';
import { CalendarComponent } from '../components/calendar/calendar.component';

@NgModule({
  declarations: [
    //producty
    ProductComponent,
    ProductListComponent,
    //cart
    CartComponent,
    CartListComponent,
    ReplaceAll,
    SearchComponent,
    CalendarComponent
  ],
  imports: [
    ProductsRoutingModule,
    CommonModule,
    HttpClientModule,
    MatFormFieldModule,
    FormsModule,
    ReactiveFormsModule,
    MatRadioModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatInputModule,
    SharedModule
  ],
  providers: [
    Utils,
    DatePipe,
    ReplaceAll
  ]
})
export class ProductsModule { }
