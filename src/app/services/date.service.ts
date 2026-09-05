
import { Injectable } from '@angular/core';
import { ProductsModule } from '../products/products.module';
import { DateE } from '../utils/custom-classes';

@Injectable({
  providedIn: ProductsModule
})
export class DateService extends DateE {
  constructor() {
    super()
  }
}

