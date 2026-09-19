import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { CouponService } from './coupon.service';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';

describe('CouponService', () => {
  let service: CouponService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      providers: [CouponService, ApiService, StorageService],
    });
    service = TestBed.inject(CouponService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
