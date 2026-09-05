import { Injectable } from '@angular/core';
import { BehaviorSubject, debounceTime, distinctUntilChanged, fromEvent, map, Observable, Observer, ReplaySubject, Subject, throwError, of } from 'rxjs';
import { DateE } from '../utils/custom-classes';
import { AddressAction, CartAndTarget, CartDateWise, CartDetails, CartProductTable, CartType, OrderInfo, OrderMainTable, Product, SubProductType, Wallet, WindowSize } from '../utils/types';
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

export const STD_TAX_FEE: number = 0;

@Injectable({
  providedIn: 'root'
})
export class CartService {
  /*
  mobile number
  Will be updated from app component
  */
  private userID: string = undefined;

  categoryPriorityIndex: Array<string> = ["Vegetables", "Naturalhydrants", "Fruits", "Greenssprouts", "Flowers", "Honeyspices", "Woodpressed", "Dairyeggs", "Naturalsugars", "Lentilspulses", "Breakfast", "Quickmeals", "Traditionalsnacks", "Skinhair"];

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

  /*
  * order checkout time limits
  */
  timeLimit: number = 22;

  orderID: string = undefined;

  //Restricted page names for hide the visibility of cart bottom bar
  cartBarRestrictedPages: Array<string> = ["cart", "checkout", "address", "profile", "wallet", "support", "referral", "orders", "policy"];

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

  //delivery instructions
  deliveryInst: string = "";

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
    this.loginS.loginChangeEvent.subscribe((result: string) => {
      if (result === Common.loginStatus.LOGIN) {
        this.userID = this.loginS.user.mobile;
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
      // NavigationEnd
      // NavigationCancel
      // NavigationError
      // RoutesRecognized
    });

    this.cartUpdateEvent.subscribe((cartAndTarget: CartAndTarget) => {

      if (this.orderID && cartAndTarget.product) {
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
            mobile: this.userID,
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

  init() {
    //Recieve time from the serve
    this.apiS.getApi('com/get_time.php').subscribe((time: Date) => {
      this.serverTime = time;

      this.todaysDate = new DateE(time);
      this.deliveryDate = new DateE(time);

      let _hrs = this.todaysDate.getHours();
      if (_hrs > this.timeLimit) {
        this.deliveryDate['addDays'](2);
      } else {
        this.deliveryDate['addDays'](1);
      }

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
      this.apiS.postApi('orders/orders_status.php', { userID: this.userID }).subscribe(res => {
        if (typeof res == "string") {
          this.orderID = res;
        } else {
          this.orderID = res[0].order_id;
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


  //Update the product attributes based on input values(0-10)
  //Triggers when plus minus buttons clicked
  //Product component and cart component
  updateProduct(product: Product, val: number): void {

    if (val > 0) {

      let _quantity = val || 1;
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

      product["price"] = Math.round(((product['stock_price'] * (1 + product['profit_percent'] / 100)) * _quantity));
      let show_off_percent_total = Math.round((product['stock_price'] * (1 + product['show_off_percent'] / 100)) * _quantity);
      product['original_price'] = show_off_percent_total;
      product['offer_percentage'] = -Math.round(((Number(product['price']) / Number(show_off_percent_total)) * 100) - 100);
      product['delivery_date'] = this.getNextDeliveryDate(product);

      //write in the cart object
      this.cartProducts[product.id] = Object.assign({}, product);//JSON.parse(JSON.stringify(product));

      if (!product.subscribe) {
        product.subs_options = {
          units: 0,
          multiDaySelected: [],
          rangeSelected: []
        }
      } else {
        if (product.subs_options) {
          if (product.subs_options.type == "range") {
            product.subs_options.rangeCnt = product.subs_options.rangeSelected.length;
            product.subs_options.price = (Number(product["price"]) * product.subs_options.rangeSelected.length).toFixed(2);
          }

          if (product.subs_options.type == "multi_day") {
            product.subs_options.multiCnt = product.subs_options.multiDaySelected.length;
            product.subs_options.price = (Number(product["price"]) * product.subs_options.multiDaySelected.length).toFixed(2);
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
    if (this.productsLoadingFlg) return;

    zone = this.zoneTablePicker(zone);

    //check weather the category is already exist or not
    let existFlg = false;
    for (var pro of this.productsList) {
      if (pro['cat'] == cat) {
        existFlg = true;
        break;
      }
    }

    if (!existFlg) {
      //Fetch products data from mySQL
      this.productsLoadingFlg = true;
      this.apiS.postApi('products/download_products_sql.php', { table_name: zone, cat: cat }).subscribe((data: any) => {
        this.productsLoadingFlg = false;
        //clear     
        for (let i = 0; i < data.length; i++) {
          //update with cart details
          if (this.cartProducts[data[i].id]) data[i] = this.cartProducts[data[i].id];
          this.productsList.push(data[i]);
        }
        this.productsDownloadedEvent.next(this.productsList);
      });
    } else {
      this.productsLoadingFlg = false;
      this.productsExistEvent.next("EXIST");
    }
  }

  read_cart_products(observer: Observer<string>) {
    //get the items in the cart based on customer_id
    this.apiS.postApi('products/get_cart.php', { customerID: this.userID, status: "CART" }).subscribe((products: Array<CartProductTable>) => {
      if (this.loginS.user.zone == "zone2") {
        products = [];
        this.cartLiveProducts = {};
        this.cartProducts = {};
        this.cartLiveProducts = {};
        this.calculateCart(this.cartProducts);
        this.isCartVisible.next(false);
      }
      //If cart products not empty
      if (typeof products != "string") {

        const products_list = products.map((product) => { return product.productID });
        this.apiS.postApi("products/download_multiple_products.php", {
          "data": JSON.stringify(products_list),
          "orderId": this.orderID
        }).subscribe({
          next: (cartProducts: any) => {
            if (cartProducts.live.length > 0) {
              let result: Array<string> = this.cartBarRestrictedPages.filter((val) => val == this.currentPage);
              if (result.length == 0) this.isCartVisible.next(true);
            }

            cartProducts.live.forEach((_product) => {
              this.cartLiveProducts[_product.id] = _product;
            });

            cartProducts?.cart.forEach((_product: any) => {

              _product.subscribe = false;
              //extending with cart and live products
              this.cartProducts[_product.productID] = { ..._product, ...this.cartLiveProducts[_product.productID] };
              _product = this.cartProducts[_product.productID];

              if ((_product.rangeDates && _product.rangeDates != 'undefined') || (_product.subscribedDates && _product.subscribedDates != 'undefined')) {
                _product.subscribe = true;
                if (_product.subscriptionType == "range") {

                  _product.rangeDates = JSON.parse(_product.rangeDates);
                  /*
                  * NOTE: 'subs_options' should be available in Product type by default, if it's not available
                  * recreate it
                  */

                  let startDate = new Date(_product.rangeDates[0]);
                  let diff = DateE.dateDiff(this.deliveryDate, startDate);
                  //if the starting date of subscribed date is older than today's date, upgrade the dates from next possible delivery date.
                  //made the changes in the db also
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
                  _product.subscribedDates = JSON.parse(_product.subscribedDates);
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

            observer.complete();
          },
          error: (err: Error) => {
            alert(err);
          }
        });
      } else {
        this.notifyCartEvent.next();
      }
    });
    return { unsubscribe() { } };
  }

  get orderInformation(): OrderInfo {
    this.cartProductsDateWise = {};
    for (let id in this.cartProducts) {
      let delivery_date = new DateE(this.cartProducts[id].delivery_date).toDateString().replace(/ /g, "_");
      if (!this.cartProductsDateWise[delivery_date]) this.cartProductsDateWise[delivery_date] = [];

      if (this.cartProducts[id]?.subs_options?.type) {
        if (!this.cartProductsDateWise["Subscriptions"]) this.cartProductsDateWise["Subscriptions"] = [];
        this.cartProductsDateWise["Subscriptions"].push(this.cartProducts[id]);
      } else {
        this.cartProductsDateWise[delivery_date].push(this.cartProducts[id]);
      }
    }


    let deliveryChargeTotal = STD_DELIVERY_CHARGES;
    if (this.cartDetails.total >= 200) {
      deliveryChargeTotal = 0;
    }
    //Check the number of days delivery available
    deliveryChargeTotal = Object.keys(this.cartProductsDateWise).length * deliveryChargeTotal;

    const total = this.cartDetails.total + deliveryChargeTotal + STD_TAX_FEE;

    this.remainingToPay = this.loginS.user.wallet - total;
    this.remainingToPay = (Math.sign(this.remainingToPay) === -1) ? Math.abs(this.remainingToPay) : 0;

    return {
      total: total,
      subTotal: this.cartDetails.total,
      cart: this.cartProducts,
      totalItemsCount: Object.keys(this.cartProducts).length,
      totalDeliveryCharges: deliveryChargeTotal,
      taxAndFees: STD_TAX_FEE,
      remainingToPay: this.remainingToPay,
      cartProductDateWise: this.cartProductsDateWise,
      subscribedItems: [],
      selectedCoupon: this.couponS.selectedCoupon
    }
  }

  placeOrder(callback) {
    this.apiS.postApi("orders/place_order.php", {
      "ordersDetails": JSON.stringify({
        "mobile": this.userID,
        "order_id": this.orderID,
        "type": "Debit",
        "trxn_type": "Account",
        "modified_at": new DateE(this.serverTime).getTime(),
        "delivery_charges": this.orderInformation.totalDeliveryCharges,
        "delivery_mode": (this.storageS.getItem("tnkspt_delivery_mode")) ? this.storageS.getItem("tnkspt_delivery_mode").index : 1,
        "delivery_inst": this.deliveryInst,
        "other_charges": STD_TAX_FEE,
        "amount": this.orderInformation.total,
        "wallet_total": this.loginS.user.wallet - this.orderInformation.total,
        "description": "Purchase",
        "status": "placed",
        "address": JSON.stringify(this.loginS.user.address),
        "items_count": this.cartDetails.totalItems,
        "delivery_date": this.deliveryDate.toDateString(),
        "coupon": this.orderInformation.selectedCoupon?.code || "",
        "coupon_offer": this.orderInformation.selectedCoupon?.offer || "",
      })
    }).subscribe({
      next: (res) => {
        this.orderPlacedFlag = true;
        if (this.orderInformation.selectedCoupon)
          this.updateUserCoupon(this.orderInformation.selectedCoupon);
        this.clearCart();
        callback(res);
      },
      error: (err: Error) => {
        alert("Error in placing the order.");
      }
    });
  }

  updateUserCoupon(data: UserCoupon) {
    this.couponS.updateUserCoupon({
      code: data.code,
      count: data.count
    }).subscribe(res => {
      if (res == "SUCCESS") {

      } else {

      }
    });
  }

  //Emtrying the cart after place the order
  clearCart() {
    // this.cartProducts = {};
    for (let product in this.cartProducts) {
      this.cartUpdateEvent.next({ cart: this.cartProducts, product: this.cartProducts[product], unit: 0, info: "clear" });
    }
    this.cartLiveProducts = {};
    this.calculateCart(this.cartProducts);
    this.deliveryInst = "";
    this.storageS.removeItem("tnkspt_inst");
    this.storageS.removeItem("tnkspt_delivery_mode");
  }

  /*
  * Calculate cart products
  * Total
  */
  calculateCart(products: CartType) {
    this.cartDetails.total = 0;
    this.cartDetails.totalItems = Object.keys(products).length;

    for (var key in products) {
      if (products[key].subscribe) this.cartDetails.total += Number(products[key].subs_options['price']);
      else this.cartDetails.total += Number(products[key]['price']);
    }

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

}