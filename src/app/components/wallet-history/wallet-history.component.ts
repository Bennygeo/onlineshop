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
    this.loginS.popupEvent.next({
      flag: true,
      msg: this.walletData.description
    });
  }

}
