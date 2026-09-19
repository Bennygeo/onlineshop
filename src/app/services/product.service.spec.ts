import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ProductService } from './product.service';
import { CartService } from './cart.service';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';
import { LoginService } from './login.service';
import { Utils } from '../utils/utils';

describe('ProductService', () => {
  let service: ProductService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      providers: [ProductService, CartService, ApiService, StorageService, LoginService, Utils],
    });
    service = TestBed.inject(ProductService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
