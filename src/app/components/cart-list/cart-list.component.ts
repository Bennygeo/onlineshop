import { animate, style, transition, trigger } from '@angular/animations';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Subscription, map } from 'rxjs';
import { Common } from 'src/app/modal/Common';
import { CartService } from 'src/app/services/cart.service';
import { CouponService, UserCoupon } from 'src/app/services/coupon.service';
import { LoginService } from 'src/app/services/login.service';
import { StorageService } from 'src/app/services/storage.service';
import { AddressAction, CartDateWise, CartType, OrderInfo, Wallet } from 'src/app/utils/types';

@Component({
  selector: 'app-cart-list',
  templateUrl: './cart-list.component.html',
  styleUrls: ['./cart-list.component.scss'],
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [   // :enter is alias to 'void => *'
        style({ opacity: 0 }),
        animate(100, style({ opacity: 1 }))
      ]),
      transition(':leave', [   // :leave is alias to '* => void'
        animate(150, style({ opacity: 0 }))
      ])
    ])
  ]
})
export class CartListComponent implements OnInit, OnDestroy {

  cartProducts: CartType = {};

  cartProductsDateWise: CartDateWise = {};

  //Delivery charge instruction flag
  deliveryInfoFlg: boolean = false;
  //fetch user data from sql
  fetchUserBagFlg: boolean = false;
  cartEventSubscription: Subscription;
  cartupdateEventSubscription: Subscription;
  public couponForm: FormGroup;
  payFlg: boolean = false;
  orderInformation: OrderInfo;

  addressFlg: boolean = false;

  deliveryInstructions: Array<{ url: string, activeUrl: string, txt: string }> = [
    { url: "assets/general/door.png", activeUrl: "assets/general/door_active.png", txt: Common.DeliveryMode.DOOR.val },
    { url: "assets/general/ring.png", activeUrl: "assets/general/ring_active.png", txt: Common.DeliveryMode.RING.val },
    { url: "assets/general/hand.png", activeUrl: "assets/general/hand_active.png", txt: Common.DeliveryMode.HAND.val }
  ];
  selectedInstructionIndex = 0;

  userCoupons: Array<UserCoupon> = [];

  constructor(
    public cartService: CartService,
    public couponS: CouponService,
    public loginS: LoginService,
    private storageS: StorageService,
  ) {
    this.selectedInstructionIndex = (this.storageS.getItem("tnkspt_delivery_mode")) ? this.storageS.getItem("tnkspt_delivery_mode").index : 0;
    this.storageS.setItem("tnkspt_delivery_mode", { index: this.selectedInstructionIndex });

    this.couponForm = new FormGroup({
      coupon: new FormControl("", [Validators.required, Validators.minLength(3)])
    });
    //rest couupon values
    this.couponForm.valueChanges.subscribe(res => {
      this.couponS.coupons.addedFlg = false;
      this.couponS.coupons.couponExistFlg = false;
      this.couponS.coupons.invalidFlg = false;
    });

    this.cartService.headerChangeEvent.next("type2");

    this.cartupdateEventSubscription = this.cartService.cartUpdateEvent.subscribe(() => {
      this.orderInformation = this.cartService.orderInformation;
      this.cartService.remainingToPay = this.orderInformation.remainingToPay;
      this.cartProductsDateWise = this.orderInformation.cartProductDateWise;
      this.fetchUserBagFlg = true;
    });

    /*
    * If the user has referral coupon then it willnot have `code` property
    * count will be available in 'rec_used_cnt' and 'ref_used_cnt'
    * and it will be written into the 'used_count' property to cop-up with the existing logic
    */
    this.couponS.getUserCoupons({ mobile: this.loginS.user.mobile }).pipe(
      map((res) => {
        res.forEach(element => {
          if (element.reciever) {
            if (element.reciever == this.loginS.user.mobile) {
              element['used_count'] = element.rec_used_cnt;
            } else if (element.referrer == this.loginS.user.mobile) {
              element['used_count'] = element.ref_used_cnt;
            } else {
              throw new Error("Unknown or Invalid number found in coupons!");
            }
          }
        });
        return res;
      })
    ).subscribe((res: any) => {
      if (res === "NOT_EXIST") {
        this.couponS.coupons.msg = "Not exist or expired!";
      } else {
        this.couponS.coupons.users = res;
      }
    });
  }

  ngOnInit(): void {

    let loadingEl = document.getElementById("loading");
    if (loadingEl)
      loadingEl.remove();
    //set as true from wallet component
    this.cartService.payAndCheckoutFlg = false;

    this.cartEventSubscription = this.cartService.notifyCartEvent.subscribe(() => {
      //reset it
      this.orderInformation = this.cartService.orderInformation;
      this.cartService.remainingToPay = this.orderInformation.remainingToPay;
      this.cartProductsDateWise = this.orderInformation.cartProductDateWise;
      this.fetchUserBagFlg = true;
    });
  }

  couponApplyBtn() {
    if (this.couponForm.valid) {
      const codeVal = this.couponForm.value.coupon;

      const userlevel = this.couponS.coupons.users.filter(val =>
        String(codeVal).toUpperCase() == String(val.code).toUpperCase()
      );

      if (userlevel.length > 0) {
        this.couponS.coupons.couponExistFlg = true;
        return;
      }

      const masterCheck = this.couponS.coupons.master.filter(val =>
        String(codeVal).toUpperCase() == String(val.code).toUpperCase()
      );

      if (masterCheck.length > 0) {

        //write the master coupon to user coupon tables
        const userCoupon: UserCoupon = {
          mobile: this.loginS.user.mobile,
          code: masterCheck[0].code,
          count: masterCheck[0].count,
          used_count: 0,
          history: '',
          expiry_date: masterCheck[0].expiry_date,
          last_used: new Date(),
          description: masterCheck[0].description,
          created_at: masterCheck[0].created_at,
          offer: masterCheck[0].offer
        }

        this.couponS.writeUserCoupon(userCoupon).subscribe(res => {
          if (res == "SUCCESS") {
            this.couponS.coupons.addedFlg = true;
            this.couponS.coupons.users.push(userCoupon);
          } else {
            this.couponS.coupons.addedFlg = false;
          }
        });
      } else if (masterCheck.length == 0) {
        this.couponS.coupons.invalidFlg = true;
      }
    }
  }

  onCouponChange(evt: any) {
    this.orderInformation.selectedCoupon = evt.value;
    this.couponS.selectedCoupon = evt.value;
  }

  //If the cart is empty select the action to do
  shopNowAction(): void {
    this.cartService.router.navigate(["products/category/Vegetables"]);
  }

  deliveryInfoAction(evt: MouseEvent): void {
    this.deliveryInfoFlg = true;
  }

  infoCloseAction(): void {
    this.deliveryInfoFlg = false;
  }

  backToShopping(): void {

  }

  proceed(): void {

  }

  setInstructionIndex(index) {
    this.selectedInstructionIndex = index;
    this.storageS.setItem("tnkspt_delivery_mode", { index: this.selectedInstructionIndex });
  }

  addMoneyToWalletAction() {
    this.cartService.router.navigate(["/home/wallet"]);
  }

  payAction() {
    this.addressFlg = (this.loginS.user.addresses.length === 0) ? false : true;
    if (this.addressFlg) {
      if (this.cartService.remainingToPay > 0) {
        this.payFlg = true;
      } else {
        this.cartService.placeOrder((res: Wallet) => {
          this.loginS.user.walletHistory.unshift(res);
          this.loginS.user.wallet = res.total;
          this.loginS.walletUpdateEvent.next([res]);
        });
      }
    } else {
      //force user to add address
      this.loginS.addressChangeEvent.next(AddressAction.READ);
    }
  }

  payWalletAction() {
    this.cartService.payAndCheckoutFlg = true;
    this.cartService.router.navigate(["/home/wallet"], { queryParams: { pay: this.cartService.remainingToPay } });
  }

  onTextChange(evt: any) {
    this.cartService.deliveryInst = evt.target.value;
    this.storageS.setItem("tnkspt_inst", { val: evt.target.value });
  }

  @HostListener("click", ["$event.target"])
  outsideClickAction(evt: any) {
    if (evt.classList[0] == "popup_parent") {
      this.payFlg = false;
    }
  }

  ngOnDestroy(): void {
    this.cartEventSubscription.unsubscribe();
    this.cartupdateEventSubscription.unsubscribe();
    this.cartService.orderPlacedFlag = false;
  }
}
