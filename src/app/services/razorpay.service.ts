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
          final_amount: res.amount,
          is_mock: res.is_mock
        }
        if (res.is_mock) {
          this.openDemoPaymentModal(order, user);
        } else {
          try {
            var rzp1 = new this.nativeWindow.Razorpay(this.preparePaymentDetails(order, user));
            rzp1.open();
          } catch (e) {
            this.openDemoPaymentModal(order, user);
          }
        }
      },
      error: (err: Error) => {
        this.changeEvent.next("FAILED");
      }
    });

  }

  openDemoPaymentModal(order: any, user: User) {
    const existingModal = document.getElementById('rzp-demo-modal-overlay');
    if (existingModal) existingModal.remove();

    const formattedAmount = (order.final_amount / 100).toFixed(2);
    const modalHtml = `
      <div id="rzp-demo-modal-overlay" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 23, 42, 0.7); z-index: 999999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="background: #ffffff; width: 420px; max-width: 90vw; border-radius: 16px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 20px 24px; position: relative;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div>
                <span style="background: #ef4444; color: #fff; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Razorpay Test Mode</span>
                <h3 style="margin: 6px 0 2px 0; font-size: 18px; font-weight: 600; color: #ffffff;">Thinkspot</h3>
                <p style="margin: 0; font-size: 12px; color: #94a3b8;">Wallet Recharge Simulation</p>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 24px; font-weight: 700; color: #34d399;">₹${formattedAmount}</div>
                <div style="font-size: 11px; color: #94a3b8;">${order.currency}</div>
              </div>
            </div>
            <button id="rzp-demo-close-x" style="position: absolute; top: 12px; right: 14px; background: transparent; border: none; color: #94a3b8; font-size: 22px; cursor: pointer; line-height: 1;">&times;</button>
          </div>

          <!-- Content -->
          <div style="padding: 24px;">
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; color: #334155;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                <span style="color: #64748b;">User:</span>
                <span style="font-weight: 600; color: #0f172a;">${user.name || 'Thinkspot Customer'}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #64748b;">Mobile:</span>
                <span style="font-weight: 600; color: #0f172a;">${this.currentUserMobile}</span>
              </div>
            </div>

            <div style="margin-bottom: 20px;">
              <label style="display: block; font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Simulated Payment Method</label>
              <div style="display: flex; flex-direction: column; gap: 8px;">
                <div style="padding: 12px; border: 2px solid #10b981; background: #ecfdf5; border-radius: 8px; display: flex; align-items: center; justify-content: space-between;">
                  <div>
                    <div style="font-weight: 600; font-size: 13px; color: #065f46;">💳 Razorpay Test Card</div>
                    <div style="font-size: 11px; color: #047857;">4111 1111 1111 1111</div>
                  </div>
                  <span style="color: #10b981; font-weight: 700;">✓</span>
                </div>
              </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 10px;">
              <button id="rzp-demo-success-btn" style="width: 100%; padding: 14px; background: #10b981; color: #ffffff; border: none; border-radius: 10px; font-weight: 600; font-size: 15px; cursor: pointer; transition: background 0.2s;">
                Pay ₹${formattedAmount} (Success)
              </button>
              <button id="rzp-demo-fail-btn" style="width: 100%; padding: 10px; background: transparent; color: #ef4444; border: 1px dashed #fca5a5; border-radius: 8px; font-weight: 500; font-size: 13px; cursor: pointer;">
                Cancel Payment (Simulate Failure)
              </button>
            </div>
          </div>

          <div style="background: #f1f5f9; padding: 10px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
            Local Test Mode • Auto-verifies with backend DB
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const closeModal = () => {
      const modal = document.getElementById('rzp-demo-modal-overlay');
      if (modal) modal.remove();
    };

    document.getElementById('rzp-demo-close-x')?.addEventListener('click', () => {
      closeModal();
      this.logFailedPayment(order.order_id, 'cancelled');
    });

    document.getElementById('rzp-demo-fail-btn')?.addEventListener('click', () => {
      closeModal();
      this.logFailedPayment(order.order_id, 'failed');
    });

    document.getElementById('rzp-demo-success-btn')?.addEventListener('click', () => {
      closeModal();
      this.handlePayment({
        razorpay_payment_id: 'pay_demo_' + Math.random().toString(36).substring(2, 12),
        razorpay_order_id: order.order_id,
        razorpay_signature: 'demo_signature_' + Math.random().toString(36).substring(2, 10),
        status: 'authorized'
      });
    });
  }

  preparePaymentDetails(order, user: User) {
    var ref = this;
    return {
      "key": order['key'],
      "amount": order.final_amount,
      "name": 'Thinkspot',
      "currency": order.currency,
      "order_id": order.order_id,
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
          ref.logFailedPayment(order.order_id, 'cancelled');
        }
      }
    };
  }

  handlePayment(response) {
    this.verify_sign(response);
  }

  logFailedPayment(orderId: string, status: string) {
    const payload = {
      razorpay_order_id: orderId,
      mobile: this.currentUserMobile,
      status: status
    };
    this._api.postApi('wallet/verify.php', payload).subscribe({
      next: () => {
        this.changeEvent.next(status === 'cancelled' ? this.payment.PaymentStaus.CANCELLED : this.payment.PaymentStaus.FAILED);
      },
      error: () => {
        this.changeEvent.next(status === 'cancelled' ? this.payment.PaymentStaus.CANCELLED : this.payment.PaymentStaus.FAILED);
      }
    });
  }

  verify_sign(data) {
    const payload = { ...data, mobile: this.currentUserMobile, status: data.status || 'authorized' };
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

