import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { RazorpayService } from './razorpay.service';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';
import { LoginService } from './login.service';
import { Payment } from '../modal/payment';

describe('RazorpayService', () => {
  let service: RazorpayService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      providers: [RazorpayService, ApiService, StorageService, LoginService, Payment],
    });
    service = TestBed.inject(RazorpayService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
