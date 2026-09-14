import { Component, Input, OnInit } from '@angular/core';
import { Payment } from 'src/app/modal/payment';
import { LoginService } from 'src/app/services/login.service';
import { Wallet } from 'src/app/utils/types';

@Component({
  selector: 'wallet-history',
  templateUrl: './wallet-history.component.html',
  styleUrls: ['./wallet-history.component.scss']
})
export class WalletHistoryComponent implements OnInit {

  @Input() walletData: Wallet;
  copied: boolean = false;

  constructor(public payment: Payment, private loginS: LoginService) { }

  ngOnInit(): void {
  }

  safeDate(rawDate: any): Date {
    if (!rawDate || rawDate === "undefined" || rawDate === "null" || rawDate === "Invalid Date" || rawDate === "0000-00-00 00:00:00" || rawDate === "0000-00-00") {
      return new Date();
    }
    if (rawDate instanceof Date) {
      return isNaN(rawDate.getTime()) ? new Date() : rawDate;
    }
    const d = new Date(rawDate);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  descView() {
    if (!this.walletData?.description) return;
    this.loginS.popupEvent.next({
      flag: true,
      msg: this.walletData.description
    });
  }

  copyTrxnId(event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    const id = this.walletData?.trxn_id;
    if (!id) return;

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(id).then(() => {
        this.showCopiedState();
      }).catch(() => {
        this.fallbackCopy(id);
      });
    } else {
      this.fallbackCopy(id);
    }
  }

  private fallbackCopy(text: string) {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.showCopiedState();
    } catch (e) {
      console.warn('Clipboard copy fallback error:', e);
    }
  }

  private showCopiedState() {
    this.copied = true;
    setTimeout(() => {
      this.copied = false;
    }, 2000);
  }

  get isSuccessful(): boolean {
    const s = this.walletData?.status;
    return s === this.payment.PaymentStaus.AUTHORIZED || 
           s === this.payment.PaymentStaus.CAPTURED || 
           s === this.payment.PaymentStaus.PLACED || 
           s === 'success' || 
           s === 'SUCCESS';
  }

  get isFailed(): boolean {
    const s = this.walletData?.status;
    return s === this.payment.PaymentStaus.FAILED || 
           s === this.payment.PaymentStaus.CANCELLED || 
           s === 'failed' || 
           s === 'cancelled' ||
           s === 'FAILED' ||
           s === 'CANCELLED';
  }

  get isCredit(): boolean {
    return this.walletData?.type === 'Credit';
  }
}
