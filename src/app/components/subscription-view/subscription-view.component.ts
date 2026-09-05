import { Component, Input, OnInit } from '@angular/core';
import { DateE } from 'src/app/utils/custom-classes';
import { DeliveryStatus } from '../subs-child-view/subs-child-view.component';
import { ApiService } from 'src/app/services/api.service';
import { User } from 'src/app/modals/user';
import { LoginService } from 'src/app/services/login.service';
import { OrderService } from 'src/app/services/order.service';
import { CartService } from 'src/app/services/cart.service';
import { DatePipe } from '@angular/common';
import { Wallet } from 'src/app/utils/types';


@Component({
  selector: 'app-subscription-view',
  templateUrl: './subscription-view.component.html',
  styleUrl: './subscription-view.component.scss',
  providers: [DatePipe]
})
export class SubscriptionViewComponent implements OnInit {

  @Input() subsData: any;

  viewFlg: boolean = false;
  editFlg: boolean = false;
  pauseFlg: boolean = false;

  alertFlg: boolean = false;
  alert: AlertType = {
    type: 'type1',
    msg: ""
  };

  pausePlay: PausePlayType = {
    msg: "",
    type: "paused",
  }

  activeSubsData: any = {};
  activeSubsDataCopy: any = {};
  //have the live price
  liveProductsData: any = {};

  todaysDate: DateE = new DateE();

  isModifiedFlg: boolean = false;

  constructor(private apiSerivice: ApiService,
    private cartS: CartService,
    private user: User,
    private loginS: LoginService,
    private orderService: OrderService,
    private datePipe: DatePipe
  ) {
    this.loginS.walletUpdateEvent.subscribe((res) => {
      this.user = this.loginS.user;
    });
  }

  ngOnInit(): void {
    this.init();
  }

  init() {
    this.activeSubsData.datesArray = [];
    let products: Array<any> = [];
    for (var order_id in this.subsData) {
      this.subsData[order_id].map((product: any) => {
        products.push(product);
      });
    }

    let products_list = products.map(item => { return item.productID });
    this.apiSerivice.postApi("products/download_multiple_products.php", {
      "data": JSON.stringify(products_list)
    }).subscribe({
      next: (res) => {
        res.live.map(item => {
          this.liveProductsData[item.id] = item;
        });

        for (var order_id in this.subsData) {
          this.subsData[order_id].map((product: any) => {
            if (product.subscriptionType === SubscriptionType.RANGE) this.updateProduct(product, JSON.parse(product.rangeDates), product.subscriptionType);
            if (product.subscriptionType === SubscriptionType.MULTI) this.updateProduct(product, JSON.parse(product.subscribedDates || []), product.subscriptionType);
          });
        }
      }
    });

    //open the window if the user switching from payment page
    if (this.cartS.editSubsPaymentTrack) {
      this.activeSubsData = this.cartS.editSubsPaymentTrack.activeSubs;
      this.editUpdateAction();
    }

  }

  updateProduct(product, dates, type) {
    product['total_count'] = dates.length;
    product['remaining_count'] = 0;
    product['img_url'] = this.liveProductsData[product.productID].img_url;
    product['name'] = this.liveProductsData[product.productID].name;

    dates.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    });

    if (dates.length === 0) {
      product['next_delivery'] = this.getnextDelivery(product, dates, 0);
      product['total_count'] += JSON.parse(product.pausedDates).length;
    } else {
      if (product['subscriptionType'] === "range" && product.subsStatus === 'paused') {
        product['total_count'] = JSON.parse(product.rangeDates).length + JSON.parse(product.pausedDates).length;
      } else if (product['subscriptionType'] === "range" && product.subsStatus === 'resume') {
        product['total_count'] = JSON.parse(product.rangeDates).length;
      }
    }

    dates.map((item, index) => {
      const date = new DateE(item.date);
      if (item.status) {
        if (date.isToday() && item.status === DeliveryStatus.DELIVERED) {
          product['next_delivery'] = this.getnextDelivery(product, dates, index);
          product['remaining_count']++;
        } else if (date.isToday() && item.status !== DeliveryStatus.DELIVERED) {
          product['next_delivery'] = this.getnextDelivery(product, dates, index);
          product['remaining_count']++;
        } else if (DateE.isDatePast(new Date(item.date))) {
          product['remaining_count']++;
        }

        if (item.status === DeliveryStatus.SHEDULED && index === 0) {
          product['next_delivery'] = this.getnextDelivery(product, dates, index - 1);
        }
      } else {
        if (date.isToday()) product['next_delivery'] = this.getnextDelivery(product, dates, index);
      }
    });
  }

  getnextDelivery(product: any, dates: Array<any>, index: number) {
    //this happens -> when paused before starting the delivery
    if (dates.length === 0 && product.subsStatus === "paused") return "Paused";

    if (product.subsStatus === "paused") {
      return "Paused";
    } else if (dates[index + 1]) {
      return this.datePipe.transform(dates[index + 1].date, 'd - MMM - y');
    } else {
      return "Expiring Today";
    }
  }

  modifiedData = {};
  plusMinusSubsValue(item, val: any, index: number) {
    this.alert.index = index;
    // this.alertFlg = true;
    let diff = val - item.count;
    this.alert.initCount = item.count;
    this.alert.updatedCount = val;

    this.modifiedData[index] = item;
    this.modifiedData[index]['diff'] = diff;

    this.isModifiedFlg = false;
    for (let key in this.modifiedData) {
      if (this.modifiedData[key].diff != 0) {
        this.isModifiedFlg = true;
        break;
      }
    }
  }

  cancelUpdateAction() {
    this.alertFlg = false;
    //reset to original value
    // this.activeSubsData.datesArray[this.alert.index].count = 0;
    window.setTimeout(() => {
      // this.activeSubsData.datesArray[this.alert.index].count = this.alert.initCount + "";
    });
  }

  editUpdateAction() {
    let cloneDatesArray = this.activeSubsData.datesArray.slice(0);
    let modifiedData = {};

    modifiedData = (this.cartS.editSubsPaymentTrack) ? this.cartS.editSubsPaymentTrack.modifiedData : this.modifiedData;
    for (let key in modifiedData) {
      cloneDatesArray[key].count = Number(modifiedData[key].count) + Number(modifiedData[key].diff)
    }

    //update subscription
    this.orderService.updateSubscription({
      orderID: this.activeSubsData.orderID,
      productID: this.activeSubsData.productID,
      type: this.activeSubsData.subscriptionType,
      datesArray: JSON.stringify([...this.activeSubsData.pastDates, ...cloneDatesArray])
    }).subscribe({
      next: (res) => {
        if (res === "UPDATED") {
          this.activeSubsData.datesArray = cloneDatesArray;

          this.isModifiedFlg = false;
          if (this.cartS.editSubsPaymentTrack) {
            this.editFlg = true;
          } else {
            this.alertFlg = false;
          }

          let totalCount = 0;
          for (let key in modifiedData) {
            totalCount += Number(modifiedData[key].diff);
          }
          this.alert.price = Math.abs(this.activeSubsData.price * totalCount);
          this.alert.walletType = (totalCount < 0) ? WalletType.CREDIT : WalletType.DEBIT;

          // let _totalAmt = this.activeSubsData.price * Math.abs(totalCount);
          const totalAmt = (this.alert.walletType === WalletType.CREDIT) ? (this.user.wallet * 1 + this.alert.price) : (this.user.wallet * 1 - this.alert.price);
          if (this.cartS.editSubsPaymentTrack) {
            this.saveChangesAction(modifiedData);
            this.alertFlg = false;
          }

          this.cartS.writeWallet({
            amount: this.alert.price,
            description: this.alert.desc,
            timestamp: new Date().getTime(),
            total: totalAmt,
            trxn_id: Date.now().toString(),
            type: this.alert.walletType,
            mobile: this.user.mobile,
            status: "placed",
            trxn_type: "Account"
          }).subscribe((res: Wallet) => {
            this.user.walletHistory.unshift(res);
            this.user.wallet = res.total;
            this.loginS.walletUpdateEvent.next([res]);
            this.modifiedData = {};
            this.cartS.editSubsPaymentTrack = undefined;
          });
        } else {
          // this.activeSubsData.datesArray[this.alert.index].count = this.alert.initCount + "";
        }
      },
      error: (err: Error) => {
        // this.activeSubsData.datesArray[this.alert.index].count = this.alert.initCount + "";
        alert(err);
      }
    });


  }

  viewAction(subs) {
    this.activeSubsData = subs;
    this.viewFlg = true;
  }

  hideAction(subs: any) {

  }

  editAction(subs: any) {
    this.activeSubsData = subs;
    this.editFlg = true;
    this.getPastAndFutureDates(subs);

    this.isModifiedFlg = false;
    for (let key in this.modifiedData) {
      if (this.modifiedData[key].diff != 0) {
        this.isModifiedFlg = true;
        break;
      }
    }
  }

  getPastAndFutureDates(subs) {
    if (subs.subscriptionType === SubscriptionType.RANGE) {
      //filter future dates
      this.activeSubsData.datesArray = JSON.parse(this.activeSubsData.rangeDates).filter(((item: any) => {
        let date = new DateE(item.date);
        return (!date.isToday() && !DateE.isDatePast(date));
      }));

      this.activeSubsData.pastDates = JSON.parse(this.activeSubsData.rangeDates).filter(((item: any) => {
        let date = new DateE(item.date);
        return (date.isToday() || DateE.isDatePast(date));
      }));
    }

    if (subs.subscriptionType === SubscriptionType.MULTI) {
      //filter future dates
      this.activeSubsData.datesArray = JSON.parse(this.activeSubsData.subscribedDates).filter((item: any) => {
        let date = new DateE(item.date);
        return (!new DateE(date).isToday() && !DateE.isDatePast(date));
      });

      this.activeSubsData.pastDates = JSON.parse(this.activeSubsData.subscribedDates).filter(((item: any) => {
        let date = new DateE(item.date);
        return (date.isToday() || DateE.isDatePast(date));
      }));
    }
    console.log("Copied!");
    this.activeSubsDataCopy.datesArray = this.activeSubsData.datesArray.slice(0);
  }

  pauseAction(subs: any) {
    this.activeSubsData = subs;

    this.pauseFlg = true;
    this.getPastAndFutureDates(subs);

    if (this.activeSubsData['subsStatus'] === 'active' || this.activeSubsData['subsStatus'] === 'resume') {

      this.pausePlay = {
        type: "paused",
        msg: '',
        nextDate: this.activeSubsData.next_delivery,
        deliveredCount: this.activeSubsData.pastDates.reduce((acc, item) => acc + (item.count * 1), 0),
        remainingCount: this.activeSubsData.datesArray.reduce((acc, item) => acc + (item.count * 1), 0),
        lastDelivered: (this.activeSubsData.pastDates && this.activeSubsData.pastDates.length > 0) ? this.datePipe.transform(this.activeSubsData.pastDates.at(-1).date, 'mediumDate') : 'Yet to start',
        noOfDaysDelivered: this.activeSubsData.pastDates.length,
        name: this.activeSubsData.name,
        remainingToBeDelivered: this.activeSubsData.datesArray.length,
        btnName: "Pause"
      }

      this.pausePlay.msg = `<h4>Pause Subscription</h4>
        You will not receive your delivery scheduled on <br><b>${this.pausePlay.nextDate}</b><br/><br/>
        Total ${this.pausePlay.name} delivered: <b>${this.pausePlay.deliveredCount}</b><br/><br/>
        Remaining ${this.pausePlay.name} to be delivered: <b>${this.pausePlay.remainingCount}</b><br/>
        <hr/>
        Total number of days delivered: <b>${this.pausePlay.noOfDaysDelivered}</b><br/><br/>
        Remaining number of days to be delivered: <b>${this.pausePlay.remainingToBeDelivered}</b><br/>
        <hr/>
        Last subscription delivered on: <b>${this.pausePlay.lastDelivered}</b><br/><br/>
        <b>You can resume anytime to continue your subscription.</b>`;
    } else if (this.activeSubsData['subsStatus'] === 'paused') {
      const pastDatesFlg = (this.activeSubsData.pastDates && this.activeSubsData.pastDates.length > 0);
      const nextDelivery = this.datePipe.transform(JSON.parse(this.activeSubsData.pausedDates)[0].date, 'mediumDate');

      this.activeSubsData.datesArray = JSON.parse(this.activeSubsData.pausedDates);
      this.activeSubsData.pastDates = (pastDatesFlg) ? this.activeSubsData.pastDates : [];

      this.pausePlay = {
        type: "resume",
        msg: '',
        nextDate: nextDelivery,
        deliveredCount: pastDatesFlg ? this.activeSubsData.pastDates.reduce((acc, item) => acc + (item.count * 1), 0) : 0,
        remainingCount: (this.activeSubsData.datesArray && this.activeSubsData.datesArray.length > 0) ? this.activeSubsData.datesArray.reduce((acc1, item) => acc1 + (item.count * 1), 0) : 0,
        lastDelivered: pastDatesFlg ? this.datePipe.transform(this.activeSubsData.pastDates.at(-1).date, 'mediumDate') : "Not yet started",
        noOfDaysDelivered: (pastDatesFlg) ? this.activeSubsData.pastDates.length : 0,
        name: this.activeSubsData.name,
        remainingToBeDelivered: JSON.parse(this.activeSubsData.pausedDates).length,
        btnName: "Resume"
      }

      this.pausePlay.msg = `<h4>Resume Subscription</h4>
        You next delivery will be scheduled on <br><b>${this.pausePlay.nextDate}</b><br/><br/>
        Total ${this.pausePlay.name} delivered: <b>${this.pausePlay.deliveredCount}</b><br/><br/>
        Remaining ${this.pausePlay.name} to be delivered: <b>${this.pausePlay.remainingCount}</b><br/>
        <hr/>
        Total number of days delivered: <b>${this.pausePlay.noOfDaysDelivered}</b><br/><br/>
        Remaining number of days to be delivered: <b>${this.pausePlay.remainingToBeDelivered}</b><br/>
        <hr/>
        Last subscription delivered on: <b>${this.pausePlay.lastDelivered}</b><br/><br/>`
    }
  }

  validateFutureDates(dates: Array<any>): Array<any> {
    dates.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    });

    let diff = DateE.dateDiff(this.todaysDate, new Date(dates[0].date));
    if (Math.sign(diff) == -1) {
      //update the date with future dates
      dates.map((date) => {
        date.date = this.datePipe.transform(new DateE(date.date).addDays(Math.abs(diff)), 'yyyy-MM-dd');
        return date;
      });
    } else {
    }
    return dates;
  }

  pausePlayConfirmAction() {
    let pausedAry = [];
    let futureDates = [];
    if (this.pausePlay.type === 'paused') {
      pausedAry = this.activeSubsData.datesArray;
      futureDates = this.activeSubsData.pastDates;
    } else if (this.pausePlay.type === 'resume') {
      pausedAry = [];
      this.activeSubsData.datesArray = this.validateFutureDates(this.activeSubsData.datesArray);
      futureDates = [...this.activeSubsData.pastDates, ...this.activeSubsData.datesArray];
    } else {
      new Error("Pause/resume type not defined.");
    }
    this.orderService.pausePlay({
      orderID: this.activeSubsData.orderID,
      productID: this.activeSubsData.productID,
      type: this.activeSubsData.subscriptionType,
      datesArray: JSON.stringify(futureDates),
      status: this.pausePlay.type,
      pausedArray: JSON.stringify(pausedAry)
    }).subscribe(res => {
      if (res === "UPDATED") {
        //update local references
        if (this.pausePlay.type === "resume") {
          const rangeAry = [...JSON.parse(this.activeSubsData.pausedDates), ...JSON.parse(this.activeSubsData.rangeDates)];
          this.activeSubsData.subsStatus = "resume"
          this.activeSubsData.rangeDates = JSON.stringify(rangeAry);
          this.activeSubsData.pausedArray = JSON.stringify([]);
          this.activeSubsData.pastDates = [];
          this.activeSubsData.datesArray = [];
        } else if (this.pausePlay.type === "paused") {
          this.activeSubsData.rangeDates = JSON.stringify(this.activeSubsData.pastDates);
          this.activeSubsData.pausedDates = JSON.stringify(this.activeSubsData.datesArray);
          this.activeSubsData.pastDates = [];
          this.activeSubsData.datesArray = [];
          this.activeSubsData.subsStatus = "paused";
        }
        this.init();
        this.popupClose();
      }
    });
  }

  popupClose() {
    this.viewFlg = false;
    this.editFlg = false;
    this.pauseFlg = false;
  }

  alertClose() {
    this.alertFlg = false;
  }

  cancelAction() {
    this.alertFlg = false;
  }

  discardChangesAction() {
    if (this.isModifiedFlg) {
      this.alert.type = "type3";
      this.alert.msg = "This will discard all your changes.<br>Are you sure to continue?";
      this.alertFlg = true;
    } else {
      this.editFlg = false;
    }
  }

  discardConfirm() {
    //reset the data
    for (let key in this.modifiedData) {
      this.modifiedData[key].count += this.modifiedData[key].diff;
      this.activeSubsData.datesArray[key].count = this.modifiedData[key].count;
      this.modifiedData[key].diff = 0;
      this.activeSubsData.datesArray[key].diff = 0;
    }

    this.alertFlg = false;
    this.editFlg = false;
  }

  //user made some changes but it won't impact on total count or the amount
  confirmAction() {

  }

  rechargeAction() {
    this.cartS.editSubsPaymentTrack = {
      activeSubs: this.activeSubsData,
      modifiedData: this.modifiedData
    };
    this.cartS.router.navigate(['/home/wallet/'], { queryParams: { pay: this.alert.price } });
  }

  saveChangesAction(data: any) {
    let totalCount = 0;
    const price = this.activeSubsData.price;
    for (let key in data) {
      totalCount += Number(data[key].diff);
    }
    const totalAmt = price * Math.abs(totalCount);

    if (totalCount !== 0) {
      if (Math.sign(totalCount) === -1) {
        this.alert.type = "type2";
        this.alert.price = totalAmt;
        this.alert.msg = `<b>₹${totalAmt}</b> will be credited to your wallet.`;
        this.alert.desc = `${Math.abs(totalCount)}  item(s) removed from your subscription`;
        this.alert.walletType = WalletType.CREDIT;

      } else if (Math.sign(totalCount) == 1) {
        let totalAmt = price * Math.abs(totalCount);
        this.alert.desc = `${Math.abs(totalCount)} item(s) added to your subscription`;
        this.alert.price = totalAmt;
        this.alert.walletType = WalletType.DEBIT;

        if (Number(this.user.wallet) >= totalAmt) {
          this.alert.type = "type2";
          this.alert.msg = `<b>₹${totalAmt}</b> will be debited from your wallet.`;
        } else {
          this.alert.type = "type1";
          this.alert.price = Math.abs(totalAmt - Number(this.user.wallet));
          this.alert.msg = `Please add <b>₹${this.alert.price}</b> to wallet to procced.`;
        }
      }
      this.alertFlg = true;
    } else {
      this.alertFlg = true;
      this.alert.type = "type4";
      this.alert.desc = "Subscription modified";
      this.alert.msg = "Are you sure to update your changes?";
    }
  }
}

export type AlertType = {
  type: 'type1' | 'type2' | 'type3' | 'type4';
  msg: string;
  price?: number;
  index?: number;
  initCount?: number;
  updatedCount?: number;
  desc?: string;
  walletType?: "Credit" | "Debit";
}

export type PausePlayType = {
  type: "paused" | "resume";
  msg: string;
  nextDate?: string;
  deliveredCount?: number;
  remainingCount?: number;
  noOfDaysDelivered?: number;
  remainingToBeDelivered?: number;
  lastDelivered?: string;
  name?: string;
  btnName?: "Pause" | "Resume"
}

export enum SubscriptionType {
  RANGE = "range",
  MULTI = "multi_day"
}

export enum WalletType {
  CREDIT = "Credit",
  DEBIT = "Debit"
}