import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Subject } from 'rxjs';
import { Payment } from '../modal/payment';
import { User } from '../modals/user';

function _window(): any {
  // return the global native browser window object
  return window;
}

@Injectable({
  providedIn: 'root'
})
export class RazorpayService {

  constructor(private _api: ApiService, public payment: Payment) {
    this.payment = new Payment();
  }

  changeEvent: Subject<string> = new Subject<string>();

  get nativeWindow(): any {
    return _window();
  }

  currentUserMobile: string;

  initiatePaymentModal(user: User, amt: any) {

    let receiptNumber = `Receipt#${Math.floor(Math.random() * 5123 * 43) + 10}`;
    /*
    * generate order_id from php and then proceed to payment process
    */
    //to remove the rupee symbol
    let _amt: any = amt;
    if (typeof _amt == "string") {
      _amt = (amt).slice(1) * 1;
    }
    amt = _amt;
    this.currentUserMobile = user.mobile || "7200015551";
    // this.changeEvent.next("INIT");
    this._api.postApi('wallet/razor_pay.php', { amount: amt * 100, currency: "INR", reciept: receiptNumber, payment_capture: 1, mobile: this.currentUserMobile }).subscribe({
      next: (res: any) => {
        let order = {
          currency: "INR",
          key: res['key'],
          order_id: res.order_id,
          final_amount: res.amount
        }
        try {
          var rzp1 = new this.nativeWindow.Razorpay(this.preparePaymentDetails(order, user));
          rzp1.open();
          // event.preventDefault();
        } catch (e) {
          //Razor pay transaction declined
          this.changeEvent.next("FAILED");
        }
      },
      error: (err: Error) => {
      }
    });

  }

  preparePaymentDetails(order, user: User) {
    var ref = this;
    return {
      "key": order['key'], // Enter the Key ID generated from the Dashboard
      "amount": order.final_amount, // Amount is in currency subunits. Default currency is INR. Hence, 29935 refers to 29935 paise or INR 299.35.
      "name": 'Thinkspot',
      "currency": order.currency,
      "order_id": order.order_id,//This is a sample Order ID. Create an Order using Orders API. (https://razorpay.com/docs/payment-gateway/orders/integration/#step-1-create-an-order). Refer the Checkout form table given below
      "image": 'https://thinkspot.in/assets/Thinkspot_logo_WTG.png',

      "handler": (response) => {
        ref.handlePayment(response);
      },
      "prefill": {
        "name": user.name || "Thinkspot user",
        "contact": user.mobile || "7200015551",
        "email": user.mail || "thinkspotdb@gmail.com"
      },

      "theme": {
        "color": "#30d2ad"
      },

      "modal": {
        "ondismiss": function () {
          ref.changeEvent.next(ref.payment.PaymentStaus.CANCELLED);
          // ref.razor_close_handler.emit();
        }
      }
    };
  }

  handlePayment(response) {
    this.verify_sign(response);
  }

  verify_sign(data) {
    const payload = { ...data, mobile: this.currentUserMobile };
    this._api.postApi('wallet/verify.php', payload).subscribe({
      next: (res: any) => {
        this.changeEvent.next(this.payment.PaymentStaus.AUTHORIZED);
      },
      error: (err: Error) => {
        this.changeEvent.next(this.payment.PaymentStaus.FAILED);
      }
    });
  }
}

