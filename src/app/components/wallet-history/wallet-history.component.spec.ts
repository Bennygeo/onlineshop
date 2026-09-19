import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WalletHistoryComponent } from './wallet-history.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Payment } from 'src/app/modal/payment';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('WalletHistoryComponent', () => {
  let component: WalletHistoryComponent;
  let fixture: ComponentFixture<WalletHistoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [WalletHistoryComponent],
      providers: [Payment],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(WalletHistoryComponent);
    component = fixture.componentInstance;
    component.walletData = {
      amount: '100',
      type: 'CREDIT',
      status: 'authorized',
      date: '2026-01-01',
      description: 'Test Wallet',
      trxn_id: 'TXN123'
    } as any;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
