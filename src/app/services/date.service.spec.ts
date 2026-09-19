import { TestBed } from '@angular/core/testing';
import { DateService } from './date.service';
import { ProductsModule } from '../products/products.module';

describe('DateService', () => {
  let service: DateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProductsModule],
    });
    service = TestBed.inject(DateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
