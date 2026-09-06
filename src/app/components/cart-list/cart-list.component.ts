import { animate, style, transition, trigger } from '@angular/animations';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Subscription, map } from 'rxjs';
import { Common } from 'src/app/modal/Common';
import { CartService } from 'src/app/services/cart.service';
import { CouponService, UserCoupon } from 'src/app/services/coupon.service';
import { LoginService } from 'src/app/services/login.service';
import { StorageService } from 'src/app/services/storage.service';
import { AddressAction, CartDateWise, CartType, OrderInfo, Product, Wallet } from 'src/app/utils/types';

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
        if (Array.isArray(res)) {
          const uniqueCoupons: UserCoupon[] = [];
          const seenCodes = new Set<string>();
          res.forEach(element => {
            if (element.reciever) {
              if (element.reciever == this.loginS.user.mobile) {
                element['used_count'] = element.rec_used_cnt;
              } else if (element.referrer == this.loginS.user.mobile) {
                element['used_count'] = element.ref_used_cnt;
              }
            }
            const cCode = String(element.code || element.coupon_code || '').toUpperCase();
            if (cCode && !seenCodes.has(cCode)) {
              seenCodes.add(cCode);
              uniqueCoupons.push(element);
            }
          });
          return uniqueCoupons;
        }
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
      const codeVal = String(this.couponForm.value.coupon).trim().toUpperCase();
      this.couponS.coupons.addedFlg = false;
      this.couponS.coupons.couponExistFlg = false;
      this.couponS.coupons.invalidFlg = false;
      this.couponS.coupons.errorMsg = "";

      const masterCheck = this.couponS.coupons.master.filter(val =>
        codeVal === String(val.code).toUpperCase()
      );

      const userCheck = this.couponS.coupons.users.filter(val =>
        codeVal === String(val.code).toUpperCase()
      );

      const targetCoupon: any = (masterCheck.length > 0) ? masterCheck[0] : (userCheck.length > 0 ? userCheck[0] : null);

      if (!targetCoupon) {
        this.couponS.coupons.invalidFlg = true;
        this.couponS.coupons.errorMsg = "Invalid promo code!";
        return;
      }

      // Check usage limit (e.g. 5 times limit)
      const existingUserCoupon = userCheck.length > 0 ? userCheck[0] : null;
      const maxCount = targetCoupon.count || 5;
      if (existingUserCoupon && existingUserCoupon.used_count >= maxCount) {
        this.couponS.coupons.invalidFlg = true;
        this.couponS.coupons.errorMsg = `You have reached the maximum ${maxCount} uses limit for promo code ${codeVal}!`;
        return;
      }

      // 1. Min cart subtotal validation (> 300 for VEG5 or per coupon settings)
      const minAmt = Number(targetCoupon.min_order_amount || (codeVal === 'VEG5' ? 300 : 0));
      const currentSubTotal = Number(this.orderInformation?.subTotal || 0);

      if (minAmt > 0 && currentSubTotal <= minAmt) {
        this.couponS.coupons.invalidFlg = true;
        this.couponS.coupons.errorMsg = `Minimum cart subtotal must be greater than ₹${minAmt} to use promo code ${codeVal}! (Current cart: ₹${currentSubTotal})`;
        return;
      }

      // 2. Category validation (Vegetables category for VEG5)
      if (codeVal === 'VEG5' || (targetCoupon.categories && targetCoupon.categories.toLowerCase() !== 'all')) {
        const reqCategories = (targetCoupon.categories || 'Vegetables,Veg').toLowerCase().split(',').map(c => c.trim());
        const cartItems = Object.values(this.orderInformation?.cart || {});

        const hasTargetCat = cartItems.some((prod: any) => {
          const pCat = String(prod.cat || prod.main_category || '').toLowerCase();
          return reqCategories.includes(pCat);
        });

        if (!hasTargetCat) {
          this.couponS.coupons.invalidFlg = true;
          this.couponS.coupons.errorMsg = `Promo code ${codeVal} is valid only for products in the Vegetables category!`;
          return;
        }
      }

      if (existingUserCoupon) {
        this.couponS.coupons.addedFlg = true;
        this.couponS.selectedCoupon = existingUserCoupon;
        this.orderInformation = this.cartService.orderInformation;
        this.cartService.remainingToPay = this.orderInformation.remainingToPay;
      } else {
        const userCoupon: UserCoupon = {
          mobile: this.loginS.user.mobile,
          code: targetCoupon.code,
          count: targetCoupon.count || 5,
          used_count: 0,
          history: '',
          expiry_date: targetCoupon.expiry_date || new Date(),
          last_used: new Date(),
          description: targetCoupon.description || '5% OFF on Vegetables (Min cart > ₹300, 5 uses max)',
          created_at: new Date(),
          offer: targetCoupon.offer || '5% OFF on Veg',
          min_order_amount: targetCoupon.min_order_amount || 300,
          discount_percent: targetCoupon.discount_percent || 5,
          categories: targetCoupon.categories || 'Vegetables,Veg'
        };

        this.couponS.writeUserCoupon(userCoupon).subscribe(() => {
          this.couponS.coupons.addedFlg = true;
          if (!this.couponS.coupons.users.some(u => String(u.code).toUpperCase() === String(userCoupon.code).toUpperCase())) {
            this.couponS.coupons.users.push(userCoupon);
          }
          this.couponS.selectedCoupon = userCoupon;
          this.orderInformation = this.cartService.orderInformation;
          this.cartService.remainingToPay = this.orderInformation.remainingToPay;
        });
      }
    }
  }

  onCouponChange(evt: any) {
    this.couponS.selectedCoupon = evt.value;
    this.orderInformation = this.cartService.orderInformation;
    this.cartService.remainingToPay = this.orderInformation.remainingToPay;
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
    this.cartService.navigateBack();
  }

  proceed(): void {

  }

  setInstructionIndex(index) {
    this.selectedInstructionIndex = index;
    this.storageS.setItem("tnkspt_delivery_mode", { index: this.selectedInstructionIndex });
  }

  addMoneyToWalletAction() {
    this.cartService.payAndCheckoutFlg = true;
    this.cartService.router.navigate(["/home/wallet"], { queryParams: { pay: this.cartService.remainingToPay } });
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

  groupProductsByCategory(products: Product[]): Array<{ categoryName: string, subCategoryName: string, displayName: string, products: Product[] }> {
    if (!products || products.length === 0) return [];

    const groupsMap = new Map<string, { categoryName: string, subCategoryName: string, displayName: string, products: Product[] }>();

    for (const product of products) {
      const cat = product.cat || product.main_category || 'General';
      const subCat = product.sub_cat || product.sub_category || '';

      let displayName = cat;
      if (subCat && subCat.toLowerCase() !== 'general' && subCat.toLowerCase() !== cat.toLowerCase()) {
        displayName = `${cat} - ${subCat}`;
      }

      if (!groupsMap.has(displayName)) {
        groupsMap.set(displayName, {
          categoryName: cat,
          subCategoryName: subCat,
          displayName: displayName,
          products: []
        });
      }
      groupsMap.get(displayName).products.push(product);
    }

    return Array.from(groupsMap.values());
  }

  ngOnDestroy(): void {
    this.cartEventSubscription.unsubscribe();
    this.cartupdateEventSubscription.unsubscribe();
    this.cartService.orderPlacedFlag = false;
  }
}
