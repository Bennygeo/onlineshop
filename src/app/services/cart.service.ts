import { Injectable } from '@angular/core';
import { BehaviorSubject, debounceTime, distinctUntilChanged, fromEvent, map, Observable, Observer, ReplaySubject, Subject, throwError, of } from 'rxjs';
import { DateE } from '../utils/custom-classes';
import { AddressAction, CartAndTarget, CartDateWise, CartDetails, CartProductTable, CartType, OrderInfo, OrderMainTable, Product, StoreSettings, SubProductType, Wallet, WindowSize } from '../utils/types';
import { ApiService } from './api.service';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { LoginService } from './login.service';
import { Common } from '../modal/Common';
import { StorageService } from './storage.service';
import { LoaderService } from './loader.service';
import { CouponService, UserCoupon } from './coupon.service';

export const STD_DELIVERY_CHARGES: number = 38;
export const STD_DELIVERY_CHARGES_ZONE1: number = 50;
export const STD_DELIVERY_CHARGES_ZONE2: number = 50;

export const STD_GST_PERCENT: number = 5;
export const STD_TAX_FEE: number = 0;

@Injectable({
  providedIn: 'root'
})
export class CartService {
  /*
   * mobile number
   * Will be updated from app component
   */
  public userID: string = undefined;

  get currentUserID(): string {
    const adminMode = this.loginS?.getAdminMode();
    const adminCustomerMobile = (adminMode && adminMode.active) ? adminMode.customerMobile : '';
    return this.loginS?.user?.mobile || adminCustomerMobile || this.userID || this.storageS?.getItem("tnkspt_user")?.mobile || '';
  }

  categoryPriorityIndex: Array<string> = ["Vegetables", "Naturalhydrants", "Fruits", "Greenssprouts", "Flowers", "Honeyspices", "Woodpressed", "Dairyeggs", "Naturalsugars", "Lentilspulses", "Breakfast", "Quickmeals", "Traditionalsnacks", "Skinhair"];

  loadCategories(): Observable<any[]> {
    return this.apiS.getApi('products/get_categories.php');
  }

  //Header might be differs when page changes
  headerChangeEvent: ReplaySubject<string> = new ReplaySubject<string>();

  //search input changes
  searchChangeEvent: BehaviorSubject<string> = new BehaviorSubject<string>("");

  /*
  * Emitted by Product compoent
  * Recieved by cart service and App component
  */
  cartUpdateEvent: BehaviorSubject<CartAndTarget> = new BehaviorSubject<CartAndTarget>({
    cart: {},
  });

  //Notify whenver any changes happening in the cart object 
  //without any databse write or read
  notifyCartEvent: BehaviorSubject<void> = new BehaviorSubject<void>(null);

  //Products download complete listener
  productsDownloadedEvent: Subject<Product[]> = new Subject<Product[]>();

  //Products will be merged with cart items complete listener
  productsCartMergeEvent: Subject<Product[]> = new Subject<Product[]>();

  //Zone change event
  zoneChangeEvent: BehaviorSubject<string> = new BehaviorSubject<string>(undefined);

  //If products already downloaded
  productsExistEvent: Subject<string> = new Subject<string>();

  //RouterEvent subject
  pageRouterEvents: Subject<string> = new Subject<string>();

  private isCartVisible = new BehaviorSubject<boolean>(false);
  isCart$ = this.isCartVisible.asObservable();

  //contains all products list
  productsList: Array<Product> = [];

  //contains all cart products
  cartProducts: CartType = {};

  //contains the live version of the products which is in the cart
  cartLiveProducts: CartType = {};

  cartDetails: CartDetails = {
    total: 0,
    totalItems: 0
  };

  //to keep server time
  serverTime: Date = new DateE();
  //to keep the todays date
  todaysDate: Date = new DateE();
  //to keep the delivery date
  deliveryDate: DateE = new DateE();

  //store operational settings (weekly off day, etc.)
  storeSettings: StoreSettings = { weekly_off_day: 'None' };
  storeSettingsUpdateEvent: BehaviorSubject<StoreSettings> = new BehaviorSubject<StoreSettings>({ weekly_off_day: 'None' });

  /*
  * order checkout time limits
  */
  timeLimit: number = 22;

  orderID: string = undefined;

  //Restricted page names for hide the visibility of cart bottom bar
  cartBarRestrictedPages: Array<string> = ["cart", "checkout", "address", "profile", "wallet", "support", "referral", "orders", "policy", "admin"];

  //home
  recommendedProducts: Array<Product> = [];

  productsLoadingFlg: boolean = false;

  loginStatus: string = undefined;

  routeURL: string;

  remainingToPay: number = 0;

  cartProductsDateWise: CartDateWise = {};

  //if the user wish to checkout immediatly after paying the remaining amount
  payAndCheckoutFlg: boolean = false;
  //set as true from wallet after placing the order from php
  orderPlacedFlag: boolean = false;
  lastPlacedOrderId: string = '';

  //delivery instructions
  deliveryInst: string = "";

  // Selected delivery option (NEXT_DAY_7AM, IMMEDIATE_10, IMMEDIATE_30, IMMEDIATE_60)
  selectedDeliveryOption: string = 'NEXT_DAY_7AM';

  // Operating hours for 10, 30, and 60 mins instant deliveries: Morning 8:00 AM to Evening 8:00 PM IST (20:00)
  isImmediateDeliveryOperatingHour(): boolean {
    const now = new Date();
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istTime = new Date(utcTime + (3600000 * 5.5));
    const istHours = istTime.getHours();
    return (istHours >= 8 && istHours < 20);
  }

  getCartDeliveryEligibility(): {
    canNextDay: boolean;
    canImmediate10: boolean;
    canImmediate30: boolean;
    canImmediate60: boolean;
    ineligibleItems10: string[];
    ineligibleItems30: string[];
    ineligibleItems60: string[];
  } {
    const products = Object.values(this.cartProducts || {}) as Product[];
    const isOperatingHours = this.isImmediateDeliveryOperatingHour();
    const cutoffMsg = 'Instant delivery operates 8:00 AM to 8:00 PM IST (Placed as regular order outside these hours)';

    if (!products || products.length === 0) {
      return {
        canNextDay: true,
        canImmediate10: isOperatingHours,
        canImmediate30: isOperatingHours,
        canImmediate60: isOperatingHours,
        ineligibleItems10: !isOperatingHours ? [cutoffMsg] : [],
        ineligibleItems30: !isOperatingHours ? [cutoffMsg] : [],
        ineligibleItems60: !isOperatingHours ? [cutoffMsg] : []
      };
    }

    const ineligible10: string[] = [];
    const ineligible30: string[] = [];
    const ineligible60: string[] = [];

    products.forEach(p => {
      const name = p.name || 'Product';
      if (p.allow_immediate_10 !== 1 && (p as any).allow_immediate_10 !== '1') {
        ineligible10.push(name);
      }
      if (p.allow_immediate_30 !== 1 && (p as any).allow_immediate_30 !== '1') {
        ineligible30.push(name);
      }
      if (p.allow_immediate_60 !== 1 && (p as any).allow_immediate_60 !== '1') {
        ineligible60.push(name);
      }
    });

    const canNextDay = products.every(p => p.allow_next_day !== 0 && (p as any).allow_next_day !== '0');

    return {
      canNextDay: canNextDay,
      canImmediate10: isOperatingHours && ineligible10.length === 0,
      canImmediate30: isOperatingHours && ineligible30.length === 0,
      canImmediate60: isOperatingHours && ineligible60.length === 0,
      ineligibleItems10: !isOperatingHours ? [cutoffMsg] : ineligible10,
      ineligibleItems30: !isOperatingHours ? [cutoffMsg] : ineligible30,
      ineligibleItems60: !isOperatingHours ? [cutoffMsg] : ineligible60
    };
  }

  getISTDeliveryDetails(): {
    currentIstTimeStr: string;
    nextDayDeliveryDateStr: string;
    countdownHours: number;
    countdownMinutes: number;
    cutoffRemainingStr: string;
    immediate10EstimateStr: string;
    immediate30EstimateStr: string;
    immediate60EstimateStr: string;
  } {
    const now = new Date();
    // Calculate current IST timestamp accurately (UTC + 5.5 hours)
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istTime = new Date(utcTime + (3600000 * 5.5));

    const istHours = istTime.getHours();
    const istMinutes = istTime.getMinutes();

    // Time remaining until 12:00 Midnight IST (24:00)
    const totalMinsUntilMidnight = (24 * 60) - (istHours * 60 + istMinutes);
    const remainingHrs = Math.floor(totalMinsUntilMidnight / 60);
    const remainingMins = totalMinsUntilMidnight % 60;

    // Delivery date calculation: Next day 7:00 AM IST (adjusted for store weekly off day)
    const baseNextDay = new Date(istTime);
    baseNextDay.setDate(baseNextDay.getDate() + 1);
    const scheduledDate = DateE.getNextOperatingDeliveryDate(baseNextDay, this.storeSettings?.weekly_off_day);

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const nextDayDeliveryDateStr = `${dayNames[scheduledDate.getDay()]}, ${scheduledDate.getDate()} ${monthNames[scheduledDate.getMonth()]} at 7:00 AM IST`;

    const formatTime = (d: Date) => {
      let h = d.getHours();
      const m = String(d.getMinutes()).padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return `${h}:${m} ${ampm} IST`;
    };

    const currentIstTimeStr = formatTime(istTime);

    const est10 = new Date(istTime.getTime() + 10 * 60000);
    const est30 = new Date(istTime.getTime() + 30 * 60000);
    const est60 = new Date(istTime.getTime() + 60 * 60000);

    return {
      currentIstTimeStr,
      nextDayDeliveryDateStr,
      countdownHours: remainingHrs,
      countdownMinutes: remainingMins,
      cutoffRemainingStr: `${remainingHrs}h ${remainingMins}m left before midnight cutoff`,
      immediate10EstimateStr: formatTime(est10),
      immediate30EstimateStr: formatTime(est30),
      immediate60EstimateStr: formatTime(est60)
    };
  }

  calculateOrderStandardDelivery(): {
    option: 'NEXT_DAY_7AM' | 'IMMEDIATE_60' | 'IMMEDIATE_30' | 'IMMEDIATE_10';
    label: string;
    subLabel: string;
    icon: string;
    badge: string;
    isImmediate: boolean;
    expectedTimeStr: string;
    hasMixedDeliveries: boolean;
  } {
    const products = Object.values(this.cartProducts || {}) as Product[];
    const istDetails = this.getISTDeliveryDetails();

    if (!products || products.length === 0) {
      this.selectedDeliveryOption = 'NEXT_DAY_7AM';
      return {
        option: 'NEXT_DAY_7AM',
        label: 'Next-Day Delivery at 7:00 AM IST',
        subLabel: `Scheduled for ${istDetails.nextDayDeliveryDateStr}`,
        icon: 'wb_twilight',
        badge: 'Standard Delivery',
        isImmediate: false,
        expectedTimeStr: istDetails.nextDayDeliveryDateStr,
        hasMixedDeliveries: false
      };
    }

    // Determine delivery type for each product in cart
    // Hierarchy: 10m (0) < 30m (1) < 60m (2) < Tomorrow (3)
    const isImmediateOperating = this.isImmediateDeliveryOperatingHour();
    let maxLevel = 0;
    let count10 = 0;
    let count30 = 0;
    let count60 = 0;
    let countNextDay = 0;

    products.forEach(p => {
      const isSub = p.subscribe || p.subs_options?.type;
      const is10 = isImmediateOperating && Number(p.allow_immediate_10) === 1;
      const is30 = isImmediateOperating && Number(p.allow_immediate_30) === 1;
      const is60 = isImmediateOperating && Number(p.allow_immediate_60) === 1;

      if (isSub) {
        countNextDay++;
        maxLevel = Math.max(maxLevel, 3);
      } else if (is10) {
        count10++;
        maxLevel = Math.max(maxLevel, 0);
      } else if (is30) {
        count30++;
        maxLevel = Math.max(maxLevel, 1);
      } else if (is60) {
        count60++;
        maxLevel = Math.max(maxLevel, 2);
      } else {
        countNextDay++;
        maxLevel = Math.max(maxLevel, 3);
      }
    });

    const activeCategoriesCount = [count10, count30, count60, countNextDay].filter(c => c > 0).length;
    const hasMixedDeliveries = activeCategoriesCount > 1;

    if (maxLevel === 3) {
      const prefProducts = products.filter(p => {
        const prefDays = DateE.normalizePreferredDays(p.preferred_days);
        return prefDays && prefDays.length > 0 && prefDays.length < 7;
      });

      let hasScheduledFutureDate = false;
      let scheduledFormattedDate = '';

      if (prefProducts.length > 0 && prefProducts.length === products.length) {
        let minDate: Date | null = null;
        prefProducts.forEach(p => {
          const prefDays = DateE.normalizePreferredDays(p.preferred_days);
          const nextD = DateE.getPreferredDaysNextDeliveryDate(prefDays, this.deliveryDate);
          if (!minDate || nextD < minDate) {
            minDate = nextD;
          }
        });
        if (minDate) {
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const target = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
          const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays > 1) {
            hasScheduledFutureDate = true;
            scheduledFormattedDate = minDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          }
        }
      }

      const isActuallyTomorrow = DateE.dateDiff(this.todaysDate, this.deliveryDate) === 1;
      const stdFormattedDate = this.deliveryDate ? this.deliveryDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Scheduled';

      this.selectedDeliveryOption = 'NEXT_DAY_7AM';
      return {
        option: 'NEXT_DAY_7AM',
        label: hasScheduledFutureDate
          ? `${scheduledFormattedDate} • 7:00 AM Delivery`
          : (isActuallyTomorrow ? 'Tomorrow Delivery (7:00 AM IST)' : `${stdFormattedDate} • 7:00 AM Delivery`),
        subLabel: hasScheduledFutureDate
          ? `Scheduled for ${scheduledFormattedDate} at 7:00 AM IST`
          : (hasMixedDeliveries
            ? `Contains morning delivery items. Scheduled for ${istDetails.nextDayDeliveryDateStr}`
            : `Scheduled for ${istDetails.nextDayDeliveryDateStr}`),
        icon: (hasScheduledFutureDate || !isActuallyTomorrow) ? 'event_available' : 'wb_twilight',
        badge: hasScheduledFutureDate ? `Scheduled: ${scheduledFormattedDate}` : (isActuallyTomorrow ? 'Tomorrow Delivery' : `Scheduled: ${stdFormattedDate}`),
        isImmediate: false,
        expectedTimeStr: hasScheduledFutureDate ? scheduledFormattedDate : istDetails.nextDayDeliveryDateStr,
        hasMixedDeliveries
      };
    } else if (maxLevel === 2) {
      this.selectedDeliveryOption = 'IMMEDIATE_60';
      return {
        option: 'IMMEDIATE_60',
        label: '60 Mins Delivery',
        subLabel: `Estimated arrival: ~${istDetails.immediate60EstimateStr}`,
        icon: 'schedule',
        badge: '60 Mins Delivery',
        isImmediate: true,
        expectedTimeStr: istDetails.immediate60EstimateStr,
        hasMixedDeliveries
      };
    } else if (maxLevel === 1) {
      this.selectedDeliveryOption = 'IMMEDIATE_30';
      return {
        option: 'IMMEDIATE_30',
        label: '30 Mins Delivery',
        subLabel: `Estimated arrival: ~${istDetails.immediate30EstimateStr}`,
        icon: 'timer',
        badge: '30 Mins Delivery',
        isImmediate: true,
        expectedTimeStr: istDetails.immediate30EstimateStr,
        hasMixedDeliveries
      };
    } else {
      this.selectedDeliveryOption = 'IMMEDIATE_10';
      return {
        option: 'IMMEDIATE_10',
        label: '10 Mins Delivery',
        subLabel: `Estimated arrival: ~${istDetails.immediate10EstimateStr}`,
        icon: 'bolt',
        badge: '10 Mins Delivery',
        isImmediate: true,
        expectedTimeStr: istDetails.immediate10EstimateStr,
        hasMixedDeliveries
      };
    }
  }

  currentPage: string = "";

  private windowSizeSubject = new BehaviorSubject<WindowSize>({
    width: window.innerWidth,
    height: window.innerHeight
  });
  windowSize$: Observable<WindowSize> = this.windowSizeSubject.asObservable();

  //if the user edit the subscription and the system swithced the user to wallet page to make the payment
  editSubsPaymentTrack: any = undefined;

  constructor(
    private apiS: ApiService,
    public router: Router,
    public loginS: LoginService,
    private storageS: StorageService,
    private loaderS: LoaderService,
    private couponS: CouponService
  ) {

    //Generate unique referral_id for all users
    //Caution :: It will overriden the existing referral code
    // this.apiS.postApi('referral/generate_coupon_id.php').subscribe(res=>{
    //   debugger;
    // });

    fromEvent(window, 'resize')
      .pipe(
        debounceTime(100), // Debounce to avoid excessive calls during resize
        distinctUntilChanged(),
        map(this.getWindowSize)
      )
      .subscribe(this.windowSizeSubject);

    this.deliveryInst = this.storageS.getItem("tnkspt_inst")?.val || "";

    const cachedSettings = this.storageS.getItem("tnkspt_store_settings");
    if (cachedSettings && cachedSettings.weekly_off_day) {
      this.storeSettings = cachedSettings;
    }

    // Initialize store settings, cart, and delivery dates immediately on service creation
    this.init();

    this.loginS.loginChangeEvent.subscribe((result: string) => {
      if (result === Common.loginStatus.LOGIN) {
        this.userID = this.loginS.user.mobile;
        this.orderID = undefined;
        this.init();
      }
    });

    this.loginS.addressChangeEvent.subscribe((res: AddressAction) => {
      if (res === AddressAction.SWITCH) {
        this.productsList = [];
        this.cartDetails = {
          total: 0,
          totalItems: 0
        };
        this.init();
      }
    });

    this.router.events.forEach((event) => {
      if (event instanceof NavigationStart) {

        this.pageRouterEvents.next("START");
        this.loaderS.show();
      }

      if (event instanceof NavigationEnd) {
        this.routeURL = event.url;
        this.pageRouterEvents.next("END");
        this.loaderS.hide();

        let route: Array<string> = event.url.split("/");
        this.currentPage = route[route.length - 1].split("?")[0];
        this.updateCartVisibility();
      }
    });

    this.cartUpdateEvent.subscribe((cartAndTarget: CartAndTarget) => {

      if (cartAndTarget.product) {
        this.ensureOrderID();
        if (cartAndTarget.info != "clear") {
          this.orderPlacedFlag = false;
        }
        this.updateProduct(cartAndTarget.product, cartAndTarget.unit);
        this.calculateCart(cartAndTarget.cart);

        this.updateCartVisibility();

        if (cartAndTarget.info != "clear") {
          let order_info: OrderMainTable = {
            orderID: this.orderID,
            address: "undefined",
            assignedTo: "undefined",
            createdAt: new DateE(this.serverTime).getTime(),
            modifiedAt: new DateE(this.serverTime).getTime(),
            deliveredBy: "undefined",
            packedBy: "undefined",
            status: "CART",
            deliveredAt: Date.now(),
            mobile: this.currentUserID,
            orderTotal: this.cartDetails.total,
            procuredTotal: 0,
            paymentID: "undefined",
            paymentStatus: "pending"
          }

          //write in sql table
          this.apiS.postApi('orders/orders.php', { ordersDetails: JSON.stringify(order_info) }).subscribe((status: any) => {
            let _target = cartAndTarget.product;
            let selectedDays = undefined;
            let rangeDays = undefined;
            if (_target.subs_options) {
              if (_target.subs_options.type == "range") {
                _target.units = _target.subs_options.units;
                rangeDays = (_target.subs_options.rangeSelected.length > 0) ? JSON.stringify(_target.subs_options.rangeSelected) : undefined;
              }

              if (_target.subs_options.type == "multi_day") {
                _target.units = _target.subs_options.units;
                selectedDays = (_target.subs_options.multiDaySelected.length > 0) ? JSON.stringify(_target.subs_options.multiDaySelected) : undefined;
              }
            }

            let targetData: CartProductTable = {
              orderID: this.orderID,
              deliveredBy: "undefined",
              modifiedAt: Date.now(),
              modifiedBy: "undefined",
              oferPrice: _target.offer,
              originalPrice: Number(_target.original_price),
              packedBy: "undefined",
              price: Number(_target.price),
              productID: _target.id,
              quantity: _target.units,
              refundDesc: "undefined",
              resheduleDesc: "undefined",
              status: "CART",
              weight: _target.weight,
              unitName: _target.original_unit_name,
              subscribedQuantity: _target?.subs_options?.units || 0,
              subscribedDates: (selectedDays) ? selectedDays : "undefined",
              rangeDates: (rangeDays) ? rangeDays : "undefined",
              deliveryDate: _target.delivery_date,
              startDate: (_target.subs_options) ? _target.subs_options.startDate : "undefined",
              endDate: (_target.subs_options) ? _target.subs_options.endDate : "undefined",
              subscriptionType: (_target.subs_options) ? _target.subs_options.type : "undefined",
              subsStatus: "active",
              pausedDates: JSON.stringify([])
            }

            this.apiS.postApi('orders/product_orders.php', { targetProduct: JSON.stringify(targetData) }).subscribe((status: any) => {
            });
          });
        }
      }
    });
  }

  recalculateDeliveryDate() {
    const base = new DateE(this.serverTime || new Date());
    this.todaysDate = new DateE(base);
    this.deliveryDate = new DateE(base);

    let _hrs = this.todaysDate.getHours();
    if (_hrs > this.timeLimit) {
      this.deliveryDate['addDays'](2);
    } else {
      this.deliveryDate['addDays'](1);
    }
    const nextOp = DateE.getNextOperatingDeliveryDate(this.deliveryDate, this.storeSettings?.weekly_off_day);
    this.deliveryDate = new DateE(nextOp);
    this.notifyCartEvent.next();
  }

  init() {
    this.recalculateDeliveryDate();

    const savedCart = this.storageS.getItem("tnkspt_cart_products");
    if (savedCart && Object.keys(savedCart).length > 0) {
      this.cartProducts = { ...savedCart, ...this.cartProducts };
      this.calculateCart(this.cartProducts);
      this.updateCartVisibility();
    }

    const onSettingsLoaded = (res: any) => {
      const s = res?.settings || res;
      const offDay = s?.weekly_off_day;
      if (offDay) {
        this.storeSettings = { weekly_off_day: offDay };
        this.storageS.setItem("tnkspt_store_settings", this.storeSettings);
        this.storeSettingsUpdateEvent.next(this.storeSettings);
        this.recalculateDeliveryDate();
      }
    };

    this.apiS.getApi('admin/store_settings.php').subscribe({
      next: onSettingsLoaded,
      error: () => {
        this.apiS.getApi('com/get_store_settings.php').subscribe({
          next: onSettingsLoaded
        });
      }
    });

    //Recieve time from the server
    this.apiS.getApi('com/get_time.php').subscribe((time: Date) => {
      this.serverTime = new DateE(time);
      this.recalculateDeliveryDate();

      /**
       * if customer id exist 
       * check wether any existing OrderID with CART status
       * if fetch the cart data
       * OR create a new OrderID
       * 
       * then download the products based on category
       * 
       * then update the downloaded products with cart.
       */

      let ngScope = this;
      const _getOrderID = new Observable(this.fetchOrderID.bind(this));
      _getOrderID.subscribe({
        next(res) {
        },
        complete() {
          ngScope.getZone(ngScope.loginS.user.pincode).subscribe((res: any) => {
            if (res.length > 0) {
              ngScope.loginS.user.zone = res[0].zone.toLocaleLowerCase();
            } else {
              ngScope.loginS.user.zone = "zone2";
            }
            ngScope.zoneChangeEvent.next(ngScope.loginS.user.zone);
            getCart();
          });
        }
      });
    });

    let getCart = () => {
      const get_cart = new Observable(this.read_cart_products.bind(this));
      let ngScope = this;
      get_cart.subscribe({
        next(res) {
        },
        complete() {
          ngScope.read_products(ngScope.loginS.user.zone, "Vegetables");
          ngScope.notifyCartEvent.next();
        }
      });
    }
  }
  ensureOrderID(): string {
    if (!this.orderID) {
      this.orderID = 'ORD_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      if (this.loginS && this.loginS.user) {
        this.loginS.user.orderID = this.orderID;
      }
    }
    return this.orderID;
  }

  /**
   * Check wether the user logged in or not
   * if not logged in ask them to login
   * else get the login id and check weather any cart products exist
   * if exist read the orderID
   */
  fetchOrderID(obs: Observer<string>) {
    // let isLogged:boolean =false;
    if (!this.orderID) {
      //if user exist and orderID not created then it will create a one and return it
      this.apiS.postApi('orders/orders_status.php', { userID: this.currentUserID }).subscribe(res => {
        if (typeof res == "string") {
          this.orderID = res;
        } else if (res && res.length > 0 && res[0]?.order_id) {
          this.orderID = res[0].order_id;
        } else {
          this.orderID = 'ORD_' + Date.now();
        }
        this.loginS.user.orderID = this.orderID;
        obs.next(this.orderID);
        obs.complete();
      });
    } else {
      obs.next(this.orderID);
      obs.complete();
    }
    return { unsubscribe() { } };
  }

  readBanners(filename, tableName): Observable<any> {
    if (filename === 'products/download_table_sql.php') {
      return of([
        { index: 1, route_url: '/products/category/Vegetables', bg_clr: '#e8f5e9', title: 'Fresh Veggies', description: 'Get farm fresh vegetables.' },
        { index: 2, route_url: '/products/category/Fruits', bg_clr: '#fff3e0', title: 'Seasonal Fruits', description: 'Enjoy sweet and fresh fruits.' },
        { index: 3, route_url: '/products/category/Naturalhydrants', bg_clr: '#e0f7fa', title: 'Tender Coconut', description: 'Stay hydrated naturally.' },
        { index: 4, route_url: '/products/category/Greenssprouts', bg_clr: '#f1f8e9', title: 'Greens', description: 'Healthy greens.' },
        { index: 5, route_url: '/products/category/Woodpressed', bg_clr: '#fff8e1', title: 'Oils', description: 'Woodpressed oils.' }
      ]);
    }
    return this.apiS.postApi(filename, tableName).pipe();
  }

  readRecommendedProducts(tableName): Observable<any> {
    return this.apiS.postApi('home/recommended_products.php', { table_name: tableName });
  }

  readRecentPurchases(mobile: string): Observable<any> {
    return this.apiS.postApi('home/recent_purchases.php', { mobile: mobile });
  }

  readBatterProducts(tableName?: string): Observable<any> {
    return this.apiS.postApi('products/download_products_sql.php', { table_name: tableName || 'products', cat: 'Batter' });
  }


  //Update the product attributes based on input values(0-10)
  //Triggers when plus minus buttons clicked
  //Product component and cart component
  updateProduct(product: Product, val: number): void {

    if (val > 0) {
      const isUnlimited = (product.is_unlimited === 1 || product.is_unlimited === true || String(product.is_unlimited) === '1');
      const maxStock = (!isUnlimited && product.stock_qty !== undefined && product.stock_qty !== null) ? product.stock_qty : 999;
      let _quantity = Math.min(val || 1, maxStock);
      if (_quantity <= 0) {
        _quantity = 0;
        delete this.cartProducts[product.id];
        return;
      }
      product["units"] = _quantity;
      let weight = product["weight"] * _quantity;
      //if product weight greater than or equal to 1000, then convert into kg.
      if (product["unit_name"] != "ml") {
        if (weight >= 1000) {
          weight = weight / 1000;
          product["original_unit_name"] = "grams";
          product["unit_name"] = "kg";
        } else if (weight < 1000 && weight > 200) {
          product["unit_name"] = "grams";
          product["original_unit_name"] = "grams";
        }
      }
      product['updated_weight'] = weight;

      if (!product['unit_price'] || isNaN(Number(product['unit_price'])) || Number(product['unit_price']) <= 0) {
        product['unit_price'] = Number(product['price'] || 0);
      }
      if (!product['unit_original_price']) {
        product['unit_original_price'] = Number(product['original_price'] || product['unit_price'] || 0);
      }

      product["price"] = Math.round(Number(product['unit_price'] || 0) * _quantity);
      product['original_price'] = Math.round(Number(product['unit_original_price'] || product['unit_price'] || 0) * _quantity);
      if (product['original_price'] > product['price']) {
        product['offer_percentage'] = -Math.round(((Number(product['price']) / Number(product['original_price'])) * 100) - 100);
      } else {
        product['offer_percentage'] = 0;
      }
      product['delivery_date'] = this.getNextDeliveryDate(product);

      //write in the cart object
      this.cartProducts[product.id] = Object.assign({}, product);
      delete this.cartProducts[product.id].changeInProduct;

      if (!product.subscribe) {
        product.subs_options = {
          units: 0,
          multiDaySelected: [],
          rangeSelected: []
        }
      } else {
        if (product.subs_options) {
          const unitP = Number(product['unit_price'] || product['price'] || 0);
          const subUnits = Number(product.subs_options.units || 1);
          if (product.subs_options.type == "range") {
            product.subs_options.rangeCnt = product.subs_options.rangeSelected.length;
            product.subs_options.price = (unitP * subUnits * product.subs_options.rangeSelected.length).toFixed(2);
          }

          if (product.subs_options.type == "multi_day") {
            product.subs_options.multiCnt = product.subs_options.multiDaySelected.length;
            product.subs_options.price = (unitP * subUnits * product.subs_options.multiDaySelected.length).toFixed(2);
          }
        }
      }

      for (var i = 0; i < this.productsList.length; i++) {
        if (this.productsList[i].id === product.id) {
          this.productsList[i] = { ...this.productsList[i], ...product };
          break;
        }
      }
    } else {
      //Remove from the cart object
      for (var i = 0; i < this.productsList.length; i++) {
        if (product.id)
          if (product.id == this.productsList[i].id) {
            if (this.cartLiveProducts[product.id]) {
              this.productsList[i] = this.cartLiveProducts[product.id];
            } else {
              this.productsList[i].units = val;
            }
            break;
          }
      }
      product.units = val;
      delete this.cartProducts[product.id];
    }
  }

  updateRecommendedProducts() {
    this.recommendedProducts.map(((r_product: Product, index: number) => {
      if (this.cartProducts[r_product.id]) {
        this.recommendedProducts[index] = this.cartProducts[r_product.id];
      }
    }));
  }

  /*
  * To update the live products values with cart values
  */
  updateCartValuesWithProduct(productsTreeBySubcategory: SubProductType): SubProductType {
    if (Object.keys(this.cartProducts).length > 0) {
      for (let product_id in this.cartProducts) {
        try {
          productsTreeBySubcategory[this.cartProducts[product_id]['sub_cat']].products.map((product, index) => {
            if (product_id == product.id) {
              productsTreeBySubcategory[this.cartProducts[product_id]['sub_cat']][index] = this.cartProducts[product_id];
            }
          });
        } catch (e) { }
      }
    }
    return productsTreeBySubcategory;
  }

  zoneTablePicker(zone: string): string {
    zone = zone.toLocaleLowerCase();
    if (zone == "zone1") {
      zone = "zone1_products_new_1";
    } else if (zone == "zone2") {
      zone = "zone2_products_new_1";
    } else {
      zone = "out_of_range_new";
    }
    return zone;
  }

  read_products(zone: string, cat: string) {
    zone = this.zoneTablePicker(zone);

    // Fetch freshest products data from backend
    this.productsLoadingFlg = true;
    this.apiS.postApi('products/download_products_sql.php', { table_name: zone, cat: cat }).subscribe({
      next: (data: any) => {
        this.productsLoadingFlg = false;
        if (Array.isArray(data)) {
          for (let i = 0; i < data.length; i++) {
            const incoming = data[i];
            const existingIdx = this.productsList.findIndex(p => p.id === incoming.id || (p.name && incoming.name && p.name.toLowerCase() === incoming.name.toLowerCase()));
            if (existingIdx !== -1) {
              const curUnits = this.cartProducts[incoming.id]?.units || this.productsList[existingIdx].units || 0;
              this.productsList[existingIdx] = { ...this.productsList[existingIdx], ...incoming, units: curUnits };
              if (this.cartProducts[incoming.id]) {
                this.cartProducts[incoming.id] = { ...this.cartProducts[incoming.id], ...incoming, units: curUnits };
                this.updateProduct(this.cartProducts[incoming.id], curUnits);
              }
            } else {
              if (this.cartProducts[incoming.id]) {
                incoming.units = this.cartProducts[incoming.id].units;
                this.cartProducts[incoming.id] = { ...this.cartProducts[incoming.id], ...incoming };
              }
              this.productsList.push(incoming);
            }
          }
        }
        this.productsDownloadedEvent.next(this.productsList);
      },
      error: () => {
        this.productsLoadingFlg = false;
        this.productsExistEvent.next("EXIST");
      }
    });
  }

  read_cart_products(observer?: Observer<string>) {
    //get the items in the cart based on customer_id
    this.apiS.postApi('products/get_cart.php', { customerID: this.userID, status: "CART" }).subscribe({
      next: (products: Array<CartProductTable>) => {
        const sqlProductIds = (typeof products != "string" && products && products.length > 0)
          ? products.map((item: any) => item.productID || item.product_id || item.id)
          : [];
        const localCartIds = Object.keys(this.cartProducts || {});
        const allProductIds = Array.from(new Set([...sqlProductIds, ...localCartIds]));

        if (allProductIds.length > 0) {
          const tableName = this.zoneTablePicker(this.loginS.user?.zone || 'zone1');
          this.apiS.postApi("products/download_multiple_products.php", {
            "data": JSON.stringify(allProductIds),
            "orderId": this.orderID,
            "table_name": tableName
          }).subscribe({
            next: (cartProducts: any) => {
              if (cartProducts?.live && cartProducts.live.length > 0) {
                let result: Array<string> = this.cartBarRestrictedPages.filter((val) => val == this.currentPage);
                if (result.length == 0) this.isCartVisible.next(true);
              }

              (cartProducts?.live || []).forEach((_product: any) => {
                this.cartLiveProducts[_product.id] = _product;
                const pIdx = this.productsList.findIndex(p => p.id === _product.id);
                if (pIdx !== -1) {
                  this.productsList[pIdx] = { ...this.productsList[pIdx], ..._product };
                }
                if (this.cartProducts[_product.id]) {
                  const curUnits = this.cartProducts[_product.id].units || (this.cartProducts[_product.id] as any).quantity || 1;
                  this.cartProducts[_product.id] = { ...this.cartProducts[_product.id], ..._product };
                  this.updateProduct(this.cartProducts[_product.id], curUnits);
                }
              });

              (cartProducts?.cart || []).forEach((_product: any) => {
                _product.subscribe = false;
                //extending with cart and live products
                this.cartProducts[_product.productID] = { ..._product, ...this.cartLiveProducts[_product.productID] };
                _product = this.cartProducts[_product.productID];

                if ((_product.rangeDates && _product.rangeDates != 'undefined') || (_product.subscribedDates && _product.subscribedDates != 'undefined')) {
                  _product.subscribe = true;
                  if (_product.subscriptionType == "range") {
                    _product.rangeDates = (typeof _product.rangeDates === 'string') ? JSON.parse(_product.rangeDates) : _product.rangeDates;
                    let startDate = new Date(_product.rangeDates[0]);
                    let diff = DateE.dateDiff(this.deliveryDate, startDate);
                    if (diff < 0) {
                      for (var i = 1; i < _product.rangeDates.length + 1; i++) {
                        let date = new Date();
                        _product.rangeDates[i - 1] = new Date(date.setDate(date.getDate() + (i))).toDateString();
                      }
                    }

                    _product.subs_options = {
                      startDate: new DateE(new Date(_product.rangeDates[0])),
                      endDate: new DateE(new Date(_product.rangeDates[_product.rangeDates.length - 1])),
                      type: _product.subscriptionType,
                      units: _product.quantity
                    };
                    _product.subs_options.rangeSelected = _product.rangeDates;
                  }

                  if (_product.subscriptionType == "multi_day") {
                    _product.subscribedDates = (typeof _product.subscribedDates === 'string') ? JSON.parse(_product.subscribedDates) : _product.subscribedDates;
                    _product.subs_options = {
                      type: _product.subscriptionType,
                      units: _product.quantity
                    };
                    _product.subs_options.multiDaySelected = _product.subscribedDates;
                    let startDate = new Date(_product.subs_options.multiDaySelected[0]);
                    let diff = DateE.dateDiff(this.deliveryDate, startDate);

                    if (diff < 0) {
                      for (var i = 1; i < _product.subscribedDates.length + 1; i++) {
                        let date = new Date();
                        let postponeCnt = DateE.dateDiff(this.deliveryDate, new Date(_product.subscribedDates[i - 1]));
                        let actualDiff = postponeCnt - (diff - 1);

                        _product.subscribedDates[i - 1] = new Date(date.setDate(date.getDate() + (actualDiff))).toDateString();
                      }
                    }
                  }
                }
                this.updateProduct(_product, _product.quantity);
              });
              this.updateRecommendedProducts();
              this.calculateCart(this.cartProducts);
              this.storageS.setItem("tnkspt_cart_products", this.cartProducts);
              this.notifyCartEvent.next();

              if (observer) {
                observer.complete();
              }
            },
            error: (err: Error) => {
              if (observer) {
                observer.complete();
              }
            }
          });
        } else {
          this.notifyCartEvent.next();
          if (observer) {
            observer.complete();
          }
        }
      },
      error: () => {
        this.notifyCartEvent.next();
        if (observer) {
          observer.complete();
        }
      }
    });
    return { unsubscribe() { } };
  }

  get orderInformation(): OrderInfo {
    this.cartProductsDateWise = {};
    for (let id in this.cartProducts) {
      const prod = this.cartProducts[id];
      let groupKey: string;

      const isImmediateOperating = this.isImmediateDeliveryOperatingHour();

      const prefDays = DateE.normalizePreferredDays(prod.preferred_days);
      if (prod?.subs_options?.type || prod?.subscribe) {
        groupKey = "Subscriptions";
      } else if (prefDays && prefDays.length > 0 && prefDays.length < 7) {
        const nextDate = DateE.getPreferredDaysNextDeliveryDate(prefDays, this.deliveryDate, this.storeSettings?.weekly_off_day);
        const dayName = DateE.formatPreferredDaysSummary(prefDays);
        const dateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;
        prod.scheduled_delivery_date = dateStr;
        prod.scheduled_delivery_label = dayName;
        const formattedDate = nextDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        groupKey = `Scheduled Delivery (${formattedDate})`;
      } else if (isImmediateOperating && Number(prod.allow_immediate_10) === 1) {
        groupKey = "10_Mins_Delivery";
      } else if (isImmediateOperating && Number(prod.allow_immediate_30) === 1) {
        groupKey = "30_Mins_Delivery";
      } else if (isImmediateOperating && Number(prod.allow_immediate_60) === 1) {
        groupKey = "60_Mins_Delivery";
      } else {
        groupKey = "Tomorrow_Delivery";
      }

      if (!this.cartProductsDateWise[groupKey]) this.cartProductsDateWise[groupKey] = [];
      this.cartProductsDateWise[groupKey].push(prod);
    }

    // Automatically compute the highest delivery time required as order's standard delivery
    this.calculateOrderStandardDelivery();


    let couponDiscount = 0;
    if (this.couponS.selectedCoupon) {
      const selected = this.couponS.selectedCoupon;
      const code = String(selected.code).toUpperCase();

      if (code === 'VEG5') {
        let vegTotal = 0;
        for (let id in this.cartProducts) {
          const prod = this.cartProducts[id];
          const catName = String(prod.cat || prod.main_category || (prod as any).category || '').toLowerCase();
          if (catName === 'vegetables' || catName === 'veg' || catName.includes('vegetable')) {
            let itemPrice = Number(prod.price || 0);
            if (prod.subscribe && prod.subs_options && prod.subs_options['price']) {
              itemPrice = Number(prod.subs_options['price']);
            }
            vegTotal += itemPrice;
          }
        }
        couponDiscount = vegTotal * 0.05;
      } else if (selected.discount_percent || selected.offer) {
        const pct = Number(selected.discount_percent || parseFloat(selected.offer) || 10);
        couponDiscount = (this.cartDetails.total * (pct / 100));
      } else {
        couponDiscount = 50;
      }
    }

    let deliveryChargeTotal = STD_DELIVERY_CHARGES;
    if (this.cartDetails.total >= 200) {
      deliveryChargeTotal = 0;
    }
    //Check the number of days delivery available
    deliveryChargeTotal = Object.keys(this.cartProductsDateWise).length * deliveryChargeTotal;

    const subTotalAfterDiscount = Math.max(0, this.cartDetails.total - couponDiscount);
    const gstPercent = STD_GST_PERCENT;
    const rawGstAmount = (subTotalAfterDiscount * gstPercent) / 100;
    const gstAmount = Math.round(rawGstAmount * 100) / 100;
    const cgst = Math.round((gstAmount / 2) * 100) / 100;
    const sgst = Math.round((gstAmount - cgst) * 100) / 100;
    const total = subTotalAfterDiscount + deliveryChargeTotal + gstAmount + STD_TAX_FEE;

    const userWallet = Number(this.loginS.user?.wallet || 0);
    const walletDeduction = Math.min(userWallet, total);
    const remainingToPay = Math.max(0, total - userWallet);

    this.remainingToPay = remainingToPay;

    return {
      total: Math.round(total),
      subTotal: Math.round(this.cartDetails.total),
      couponDiscount: Math.round(couponDiscount),
      cart: this.cartProducts,
      totalItemsCount: Object.keys(this.cartProducts).length,
      totalDeliveryCharges: Math.round(deliveryChargeTotal),
      taxAndFees: Math.round(STD_TAX_FEE),
      gst: gstAmount,
      cgst: cgst,
      sgst: sgst,
      gstPercent: gstPercent,
      walletDeduction: Math.round(walletDeduction),
      remainingToPay: Math.round(remainingToPay),
      cartProductDateWise: this.cartProductsDateWise,
      subscribedItems: [],
      selectedCoupon: this.couponS.selectedCoupon
    }
  }

  placeOrder(callback, paymentType: 'Wallet' | 'COD' | 'OFFLINE' = 'Wallet', errorCallback?: Function) {
    const adminMode = this.loginS.getAdminMode();
    const isOffline = (paymentType === 'OFFLINE' || (adminMode && adminMode.active));
    const orderSource = isOffline ? 'ADMIN_OFFLINE' : 'CLIENT_WEB';
    const createdBy = adminMode?.adminUsername || (isOffline ? 'Admin' : null);

    const userWallet = Number(this.loginS.user?.wallet || 0);
    const orderAmt = Number(this.orderInformation?.total || 0);
    const remainingToPay = Number(this.orderInformation?.remainingToPay ?? Math.max(0, orderAmt - userWallet));

    if (paymentType !== 'COD' && !isOffline) {
      if (remainingToPay > 0.01 && userWallet < (orderAmt - 0.01)) {
        alert("CRITICAL SECURITY GUARD: Insufficient wallet balance! Available: ₹" + userWallet + ", Order Total: ₹" + orderAmt + ". Order blocked.");
        this.payAndCheckoutFlg = false;
        if (errorCallback) errorCallback('Insufficient wallet balance');
        return;
      }
    }

    const activeUserMobile = this.currentUserID || adminMode?.customerMobile;
    if (!activeUserMobile) {
      this.loginS.loginPromptEvent.next(true);
      if (errorCallback) errorCallback('Missing user mobile');
      return;
    }

    // Client-side Stock Availability Pre-check (Bypassed for offline admin sales and unlimited items)
    if (!isOffline) {
      const clientStockErrors: string[] = [];
      for (let p of (Object.values(this.cartProducts || {}) as any[])) {
        const isUnlimited = (p.is_unlimited === 1 || p.is_unlimited === true || String(p.is_unlimited) === '1');
        if (isUnlimited) {
          continue;
        }
        const pName = p.name || 'Product';
        const requestedQty = Number(p.subs_options?.units || p.units || p.quantity || 1);
        const availableStock = (p.stock_qty !== undefined && p.stock_qty !== null) ? Number(p.stock_qty) : null;
        const isInStock = (p.in_stock !== false && p.in_stock !== 0);

        if (!isInStock || (availableStock !== null && availableStock <= 0)) {
          clientStockErrors.push(`"${pName}" is currently out of stock.`);
        } else if (availableStock !== null && requestedQty > availableStock) {
          clientStockErrors.push(`"${pName}" has only ${availableStock} ${p.unit_name || ''} in stock, but ${requestedQty} was requested.`);
        }
      }

      if (clientStockErrors.length > 0) {
        alert("Cannot place order due to stock unavailability:\n\n" + clientStockErrors.join("\n"));
        this.payAndCheckoutFlg = false;
        if (errorCallback) errorCallback(clientStockErrors);
        return;
      }
    }

    this.ensureOrderID();
    const itemsList = Object.values(this.cartProducts || {}).map((p: any) => {
      const unitP = Number(p.unit_price || p.price || 0);
      const subUnits = Number(p.subs_options?.units || p.units || p.quantity || 1);
      let totalPrice = Number(p.price || 0);

      if ((p.subscribe || p.subs_options) && p.subs_options) {
        let dayCount = 1;
        if (p.subs_options.type === 'range' && p.subs_options.rangeSelected && p.subs_options.rangeSelected.length > 0) {
          dayCount = p.subs_options.rangeSelected.length;
        } else if (p.subs_options.type === 'multi_day' && p.subs_options.multiDaySelected && p.subs_options.multiDaySelected.length > 0) {
          dayCount = p.subs_options.multiDaySelected.length;
        }
        if (p.subs_options.price) {
          totalPrice = Number(p.subs_options.price);
        } else {
          totalPrice = unitP * subUnits * dayCount;
        }
      }

      const prefDays = DateE.normalizePreferredDays(p.preferred_days);
      let itemDeliveryDate = '';
      if (prefDays && prefDays.length > 0 && prefDays.length < 7) {
        const schedD = DateE.getPreferredDaysNextDeliveryDate(prefDays, this.deliveryDate);
        itemDeliveryDate = `${schedD.getFullYear()}-${String(schedD.getMonth() + 1).padStart(2, '0')}-${String(schedD.getDate()).padStart(2, '0')}`;
      }

      return {
        id: p.id || p.product_id,
        name: p.name || p.product_name,
        quantity: subUnits,
        price: totalPrice,
        weight: p.weight || p.updated_weight || '',
        img_url: p.img_url || '',
        preferred_days: prefDays,
        scheduled_delivery_date: itemDeliveryDate || p.scheduled_delivery_date || '',
        delivery_date: itemDeliveryDate || p.scheduled_delivery_date || '',
        subscriptionType: p.subs_options?.type || p.subscriptionType || (p.subscribe ? 'range' : 'none'),
        rangeDates: p.subs_options?.rangeSelected ? JSON.stringify(p.subs_options.rangeSelected) : (p.rangeDates || '[]'),
        subscribedDates: p.subs_options?.multiDaySelected ? JSON.stringify(p.subs_options.multiDaySelected) : (p.subscribedDates || '[]'),
        subsStatus: 'active',
        startDate: p.subs_options?.startDate ? new Date(p.subs_options.startDate).toDateString() : '',
        endDate: p.subs_options?.endDate ? new Date(p.subs_options.endDate).toDateString() : ''
      };
    });

    const activeAddress = this.loginS.user?.address ||
      (this.loginS.user?.addresses && this.loginS.user.addresses[0]) ||
      (isOffline ? { name: this.loginS.user?.name || 'Walk-in Customer', address: 'Store Counter / In-Store Direct Sale', pincode: '600095' } : {});

    this.apiS.postApi("orders/place_order.php", {
      "ordersDetails": JSON.stringify({
        "mobile": activeUserMobile,
        "order_id": this.orderID,
        "payment_type": paymentType,
        "order_source": orderSource,
        "created_by": createdBy,
        "type": isOffline ? 'OFFLINE' : (paymentType === 'COD' ? 'COD' : 'Debit'),
        "trxn_type": isOffline ? 'Offline' : (paymentType === 'COD' ? 'COD' : 'Account'),
        "modified_at": new DateE(this.serverTime).getTime(),
        "delivery_charges": Math.round(this.orderInformation.totalDeliveryCharges),
        "delivery_mode": (this.storageS.getItem("tnkspt_delivery_mode")) ? this.storageS.getItem("tnkspt_delivery_mode").index : 1,
        "delivery_inst": this.deliveryInst,
        "gst_amount": this.orderInformation.gst || 0,
        "cgst": this.orderInformation.cgst || 0,
        "sgst": this.orderInformation.sgst || 0,
        "gst_percent": this.orderInformation.gstPercent || 5,
        "other_charges": Math.round(STD_TAX_FEE),
        "amount": Math.round(this.orderInformation.total),
        "wallet_total": (paymentType === 'COD' || isOffline) ? Math.round(this.loginS.user?.wallet || 0) : Math.round((this.loginS.user?.wallet || 0) - this.orderInformation.total),
        "description": isOffline ? 'Admin Offline Order' : (paymentType === 'COD' ? 'COD Purchase' : 'Purchase'),
        "status": "placed",
        "address": JSON.stringify(activeAddress),
        "items_count": this.cartDetails.totalItems,
        "delivery_date": this.deliveryDate ? `${this.deliveryDate.getFullYear()}-${String(this.deliveryDate.getMonth() + 1).padStart(2, '0')}-${String(this.deliveryDate.getDate()).padStart(2, '0')}` : '',
        "delivery_option": this.selectedDeliveryOption || "NEXT_DAY_7AM",
        "coupon": this.orderInformation.selectedCoupon?.code || "",
        "coupon_offer": this.orderInformation.selectedCoupon?.offer || "",
        "items": itemsList
      })
    }).subscribe({
      next: (res: any) => {
        this.orderPlacedFlag = true;
        const placedOrderId = res?.order_id || this.orderID || '';
        this.lastPlacedOrderId = placedOrderId;
        this.orderID = undefined;
        if (this.orderInformation.selectedCoupon)
          this.updateUserCoupon(this.orderInformation.selectedCoupon);

        // Update real-time product stock levels from order deduction
        if (res && res.updated_stocks) {
          for (let pId in res.updated_stocks) {
            const sInfo = res.updated_stocks[pId];
            for (let p of this.productsList) {
              if (p.id === pId) {
                p.stock_qty = sInfo.stock_qty;
                p.in_stock = sInfo.in_stock;
              }
            }
            if (this.cartLiveProducts[pId]) {
              this.cartLiveProducts[pId].stock_qty = sInfo.stock_qty;
              this.cartLiveProducts[pId].in_stock = sInfo.in_stock;
            }
          }
          this.productsDownloadedEvent.next(this.productsList);
        }

        this.clearCart();
        if (this.loginS?.user) {
          this.loginS.user.orderID = undefined;
          if (res && res.total !== undefined) {
            this.loginS.user.wallet = res.total;
          }
        }
        this.loginS.readWallet();
        if (callback) {
          callback({ ...res, order_id: placedOrderId });
        }
      },
      error: (err: any) => {
        const errorMsg = err?.error?.error || "Unable to place order. Please check your wallet balance and try again.";
        alert(errorMsg);
        this.payAndCheckoutFlg = false;
        if (errorCallback) {
          errorCallback(err);
        }
      }
    });
  }

  updateUserCoupon(data: UserCoupon) {
    if (!data || !this.loginS?.user?.mobile) return;
    const mobileNum = this.loginS.user.mobile;
    const couponCode = data.code;

    // Optimistically increment local used count
    data.used_count = (Number(data.used_count) || 0) + 1;

    this.couponS.updateUserCoupon({
      mobile: mobileNum,
      code: couponCode,
      count: data.count
    }).subscribe({
      next: (res) => {
        this.couponS.getUserCoupons({ mobile: mobileNum }).subscribe((userCoupons: any) => {
          if (Array.isArray(userCoupons)) {
            const uniqueCoupons: UserCoupon[] = [];
            const seenCodes = new Set<string>();
            userCoupons.forEach(element => {
              const cCode = String(element.code || element.coupon_code || '').toUpperCase();
              if (cCode && !seenCodes.has(cCode)) {
                seenCodes.add(cCode);
                uniqueCoupons.push(element);
              }
            });
            this.couponS.coupons.users = uniqueCoupons;
          }
        });
      },
      error: (err) => {
        console.error("Error updating user coupon count:", err);
      }
    });
  }

  //Emtrying the cart after place the order
  clearCart() {
    this.orderID = undefined;
    if (this.loginS?.user) {
      this.loginS.user.orderID = undefined;
    }
    const resetProd = (p: any) => {
      if (!p) return;
      p.units = 0;
      p.subscribe = false;
      if (p.subs_options) {
        p.subs_options.units = 0;
        p.subs_options.multiDaySelected = [];
        p.subs_options.rangeSelected = [];
        p.subs_options.startDate = undefined;
        p.subs_options.endDate = undefined;
      }
    };

    if (this.productsList && this.productsList.length > 0) {
      this.productsList.forEach(resetProd);
    }
    if (this.cartProducts) {
      Object.keys(this.cartProducts).forEach(id => resetProd(this.cartProducts[id]));
    }
    if (this.cartLiveProducts) {
      Object.keys(this.cartLiveProducts).forEach(id => resetProd(this.cartLiveProducts[id]));
    }

    this.productsList = [];
    this.cartProducts = {};
    this.cartLiveProducts = {};
    this.deliveryInst = "";
    this.selectedDeliveryOption = 'NEXT_DAY_7AM';
    this.couponS.selectedCoupon = undefined;
    if (this.couponS.coupons) {
      this.couponS.coupons.addedFlg = false;
      this.couponS.coupons.couponExistFlg = false;
      this.couponS.coupons.invalidFlg = false;
      this.couponS.coupons.errorMsg = "";
    }
    this.storageS.removeItem("tnkspt_inst");
    this.storageS.removeItem("tnkspt_delivery_mode");
    this.storageS.removeItem("tnkspt_cart_products");
    this.calculateCart(this.cartProducts);
    this.cartUpdateEvent.next({ cart: this.cartProducts, product: undefined, unit: 0 });
  }

  /*
  * Calculate cart products
  * Total
  */
  calculateCart(products: CartType) {
    this.cartDetails.total = 0;
    this.cartDetails.totalItems = Object.keys(products).length;

    for (var key in products) {
      if (products[key].subscribe && products[key].subs_options && products[key].subs_options['price']) {
        this.cartDetails.total += Number(products[key].subs_options['price']);
      } else {
        this.cartDetails.total += Number(products[key]['price']);
      }
    }

    if (this.cartDetails.totalItems > 0) {
      this.storageS.setItem("tnkspt_cart_products", products);
    } else {
      this.storageS.removeItem("tnkspt_cart_products");
    }

    this.updateCartVisibility();
    this.notifyCartEvent.next();
  }

  /*
  * get batter delivery date
  * note:next day delivery not available
  */
  getNextDeliveryDate(product) {

    if (!product.delivery_date) return this.deliveryDate;

    let get_delivery_day: any = this.deliveryDate;
    var _dateE = new DateE(this.serverTime);
    _dateE.addDays(product['postponed']);

    if (product['delivery_day'] === '' || product['delivery_day'] === undefined) product['delivery_day'] = -1;

    if (product['delivery_day'] == -1) {
      get_delivery_day = this.deliveryDate;
    }

    if (product['delivery_day'] != undefined && product['delivery_day'] != 8 && product['delivery_day'] != -1) {
      /*
      * If it has multiple delivery days
      */
      let delivery_days = product['delivery_day'].toString().split(",");
      delivery_days = delivery_days.map(function (v) { return parseInt(v, 10); });

      if (delivery_days.length > 1) {
        //
        _dateE = new DateE(this.deliveryDate);

        let delivery_day = _dateE.getDay();

        let tmp_delivery_days = [delivery_day, delivery_days[0]];
        let target_delivery_day = Math.max(...tmp_delivery_days);

        if (target_delivery_day <= delivery_day) {
          tmp_delivery_days = [];
          tmp_delivery_days = [delivery_day, delivery_days[1]];
          target_delivery_day = Math.max(...tmp_delivery_days);

          let _diif = target_delivery_day - delivery_day;
          if (_diif < product['postponed']) {
            target_delivery_day = Math.min(...delivery_days);
          }
        }
        get_delivery_day = _dateE.getDesiredDeliveryDate(target_delivery_day);
      } else {
        /*
        * If single day delivery in a week.
        */
        _dateE = new DateE(this.deliveryDate);

        get_delivery_day = _dateE.getDesiredDeliveryDate(Number(product['delivery_day']));
        let _diff = DateE.dateDiff(this.deliveryDate, get_delivery_day);

        if (_diff < product['postponed']) {
          get_delivery_day = new DateE(this.serverTime).addDays(7);
        }
      }
    }

    //8 means all day delivery except some days
    if (product['delivery_day'] === 8) {

      let _hrs = this.deliveryDate.getHours();
      _dateE = new DateE(this.deliveryDate);

      let exceed_flg = false;
      if (_hrs > product["time_limit"]) exceed_flg = true;

      if (_hrs > product["time_limit"]) {
        _dateE.addDays(1);
        get_delivery_day = _dateE;
      } else {
        get_delivery_day = this.deliveryDate;
      }

      //if product has time limit and exceeds todays time limit
      if (product["time_limit"] && exceed_flg) get_delivery_day = this.deliveryDate;

      //if time limit not found
      if (!product["time_limit"]) {
        _dateE.addDays(product['postponed'])
        get_delivery_day = _dateE
      }

      if (product['disable_deliveries'] != undefined) {
        let deliveries_except: Array<string> = product['disable_deliveries'].split(",");
        for (var days in deliveries_except) {
          if (get_delivery_day.toDateString().split(" ")[0] == deliveries_except[days]) {
            _dateE.addDays(1);
            get_delivery_day = _dateE;
          }
        }
      }
    }
    return get_delivery_day;
  }

  writeWallet(data: Wallet): Observable<any> {
    return this.apiS.postApi('wallet/write_wallet.php', { walletData: JSON.stringify(data) });
  }

  //Must removed from production
  // loadPincode() {
  //   const data = JSON.parse(myData);
  //   console.log(data);
  //   data.forEach(pincode => {
  //     console.log(pincode);
  //     this.writePincode(pincode).subscribe({
  //       next: () => {
  //         console.log("Pincode write success.");
  //       },
  //       error: (err) => {
  //         console.log("Pincode write error.");
  //       }
  //     });
  //   });
  // }

  //Must removed from production
  // writePincode(data: any): Observable<any> {
  //   return this.apiS.postApi("com/write_princode.php", { "data": JSON.stringify(data) });
  // }

  updateCartVisibility() {
    let result: Array<string> = this.cartBarRestrictedPages.filter((val) => val == this.currentPage);
    (result.length == 0 && (this.cartDetails.totalItems > 0)) ? this.isCartVisible.next(true) : this.isCartVisible.next(false);
  }

  private getWindowSize() {
    return {
      width: window.innerWidth,
      height: window.innerHeight
    };
  }

  getZone(pincode: string): Observable<any> {
    return this.apiS.postApi("com/read_zone.php", { pincode: pincode });
  }

  navigateBack(): void {
    const currentUrl = (this.router.url || '').split('?')[0];

    if (currentUrl.includes('/products/cart') || currentUrl.includes('/products/search')) {
      this.router.navigate(['/products/category/Vegetables']);
    } else if (currentUrl.includes('/products/category/')) {
      this.router.navigate(['/home/view']);
    } else if (
      currentUrl.includes('/home/orders') ||
      currentUrl.includes('/home/wallet') ||
      currentUrl.includes('/home/profile') ||
      currentUrl.includes('/home/address') ||
      currentUrl.includes('/home/support') ||
      currentUrl.includes('/home/referral') ||
      currentUrl.includes('/home/policy')
    ) {
      this.router.navigate(['/home/view']);
    } else if (currentUrl.includes('/home/view')) {
      this.router.navigate(['/products/category/Vegetables']);
    } else {
      this.router.navigate(['/home/view']);
    }
  }

}