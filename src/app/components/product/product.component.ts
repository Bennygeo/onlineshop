import { DatePipe } from '@angular/common';
import { Component, OnInit, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';

import { Subject } from 'rxjs';
import { ApiService } from 'src/app/services/api.service';
import { CartService } from 'src/app/services/cart.service';
import { LoginService } from 'src/app/services/login.service';
import { OrderService } from 'src/app/services/order.service';
import { ProductService } from 'src/app/services/product.service';
import { DateE } from 'src/app/utils/custom-classes';
import { DescriptionOptions, Product } from 'src/app/utils/types';

@Component({
  selector: 'product',
  templateUrl: './product.component.html',
  styleUrls: ['./product.component.scss']
})
export class ProductComponent implements OnInit, OnChanges {

  @Input() product: Product;

  //triggers on every product changes
  @Output() valueChanges = new EventEmitter<Product>();

  descriptionOptions: DescriptionOptions = {
    defaultMsg: "Description not found!",
    shortdesc: "",
    shortdesctitle: "",
    longdesc1: "",
    longdesc1title: "",
    longdesc2: "",
    longdesc2title: "",
    longdesc3: "",
    longdesc3title: "",
    imgurl: "",
    loadingstatus: false
  };

  dateUtils: DateE = new DateE();

  constructor(
    private cartS: CartService,
    private _api: ApiService,
    private _productService: ProductService,
    private datePipe: DatePipe,
    private loginS: LoginService,
    private orderService: OrderService
  ) {
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.init();
  }

  ngOnInit() {
    this.cartS.storeSettingsUpdateEvent.subscribe(() => {
      this.init();
    });

    this.product.changeInProduct.subscribe({
      next: (product: Product) => {
        if (product.subscribe) {

          if (product.subs_options.multiDaySelected.length === 0 && product.subs_options.rangeSelected.length === 0) {
            product.subs_options.units = 0;
          }

          this.cartS.cartUpdateEvent.next({ cart: this.cartS.cartProducts, product: product, unit: product.subs_options.units });
        } else {
          this.cartS.cartUpdateEvent.next({ cart: this.cartS.cartProducts, product: product, unit: product.units });
        }
      },
      error: (err: Error) => {
        alert("Subscription write error.")
      }
    });
  }

  init() {
    this.product.changeInProduct = new Subject();
    if (!this.product.units) this.product.units = 0;

    this.product.disabled = (String(this.product['disabled']) == 'true') ? true : false;

    const isUnlimited = (this.product.is_unlimited === 1 || this.product.is_unlimited === true || String(this.product['is_unlimited']) === '1');
    this.product.is_unlimited = isUnlimited;

    if (this.product['stock_qty'] !== undefined && this.product['stock_qty'] !== null) {
      this.product.stock_qty = parseFloat(String(this.product['stock_qty']));
    }
    const hasStock = isUnlimited || (this.product.stock_qty === undefined || this.product.stock_qty === null || this.product.stock_qty > 0);
    const inStockFlag = isUnlimited || (this.product['in_stock'] !== false && String(this.product['in_stock']) !== '0' && this.product['in_stock'] !== 0);
    this.product.in_stock = inStockFlag && hasStock;

    const _quantity = (this.product.units * 1) || 1;

    if (!this.product['updated_weight']) this.product['updated_weight'] = this.product["weight"];

    let basePrice = Number(this.product['unit_price'] || this.product['price'] || 0);
    if (!this.product['unit_price'] || isNaN(Number(this.product['unit_price'])) || Number(this.product['unit_price']) <= 0) {
      this.product['unit_price'] = basePrice;
    }
    let origPrice = Number(this.product['unit_original_price'] || this.product['original_price'] || basePrice);
    if (!this.product['unit_original_price'] || isNaN(Number(this.product['unit_original_price']))) {
      this.product['unit_original_price'] = origPrice;
    }

    this.product['price'] = Math.round(basePrice * _quantity);
    this.product['original_price'] = Math.round(origPrice * _quantity);
    if (isNaN(Number(this.product['original_price']))) {
      this.product['original_price'] = this.product['price'];
    }

    if (!this.product['subs_options']) this.product.subs_options = {
      units: this.product.units,
      multiDaySelected: [],
      rangeSelected: [],
      type: undefined,
      startDate: undefined,
      endDate: undefined
    }
    if (!this.product.subs_options.multiDaySelected) this.product.subs_options.multiDaySelected = [];
    if (!this.product.subs_options.rangeSelected) this.product.subs_options.rangeSelected = [];

    this.product.delivery_date = this.cartS.deliveryDate;

    // Handle Preferred Delivery Days Forward Scheduling
    const prefDays = DateE.normalizePreferredDays(this.product.preferred_days);
    if (prefDays && prefDays.length > 0 && prefDays.length < 7) {
      const scheduledDate = DateE.getPreferredDaysNextDeliveryDate(prefDays, this.cartS.deliveryDate, this.cartS.storeSettings?.weekly_off_day);
      this.product.delivery_date = new DateE(scheduledDate);
      this.product.scheduled_delivery_label = DateE.formatPreferredDaysSummary(prefDays);
      this.product.scheduled_delivery_date = `${scheduledDate.getFullYear()}-${String(scheduledDate.getMonth() + 1).padStart(2, '0')}-${String(scheduledDate.getDate()).padStart(2, '0')}`;
    } else if (this.product.delivery_day != -1) {
      this.product.delivery_date = this.cartS.getNextDeliveryDate(this.product);
    }

    const subFlgVal = this.product.subscribe_flg !== undefined ? this.product.subscribe_flg : this.product['subscribeFlg'];
    if (subFlgVal !== undefined && subFlgVal !== null) {
      this.product.subscribeFlg = (Number(subFlgVal) === 1);
    } else {
      const cat = String(this.product.cat || '').toLowerCase();
      const name = String(this.product.name || '').toLowerCase();
      const isMilk = cat === 'milk' || name.includes('milk 1');
      const isTenderCoconut = cat === 'tender' || name.includes('tender coconut');
      this.product.subscribeFlg = isMilk || isTenderCoconut;
    }

    const isImmOperating = this.cartS.isImmediateDeliveryOperatingHour();
    const hasImm30 = isImmOperating && Number(this.product.allow_immediate_30) === 1;
    const hasImm10 = isImmOperating && Number(this.product.allow_immediate_10) === 1;
    const hasImm60 = isImmOperating && Number(this.product.allow_immediate_60) === 1;

    const isActuallyTomorrow = (DateE.dateDiff(this.cartS.todaysDate, this.product.delivery_date) === 1);

    if (prefDays && prefDays.length > 0 && prefDays.length < 7) {
      try {
        this.product.delivery_date_enhanced = isActuallyTomorrow ? "Tomorrow" : (this.datePipe.transform(this.product["delivery_date"], 'EEE, MMM d') || 'Scheduled');
      } catch (e) {
        this.product.delivery_date_enhanced = this.product.scheduled_delivery_label || "Scheduled";
      }
    } else if (hasImm10) {
      this.product.delivery_date_enhanced = "10 mins";
    } else if (hasImm30) {
      this.product.delivery_date_enhanced = "30 mins";
    } else if (hasImm60) {
      this.product.delivery_date_enhanced = "60 mins";
    } else {
      try {
        this.product.delivery_date_enhanced = isActuallyTomorrow ? "Tomorrow" : this.datePipe.transform(this.product["delivery_date"], 'EEE, MMM d');
      } catch (e) {
        this.product.delivery_date_enhanced = isActuallyTomorrow ? "Tomorrow" : "Scheduled";
      }
    }
  }

  plusMinusValue(val) {
    //Recieved by cart service
    this.cartS.cartUpdateEvent.next({ cart: this.cartS.cartProducts, product: this.product, unit: val });
  }

  detailed_view(evt: MouseEvent) {
    if (evt) {
      evt.stopPropagation();
    }
    if (this.product && this.product.id) {
      this.cartS.router.navigate(['/products/details/' + this.product.id]);
    }
  }

  onImageLoad(evt) {
    // this.img_loading = false;
  }

  goToCart() {
    this.cartS.router.navigate(['/products/cart-items']);
  }

  viewSubscription(evt: MouseEvent): void {
    if (this.loginS.loginstatus()) {
      this.orderService.getActiveSubscriptions().subscribe({
        next: (subs: any) => {
          const activeForThisProduct = Array.isArray(subs) && subs.some((s: any) => String(s.productID) === String(this.product.id) && s.subsStatus !== 'cancelled');
          if (activeForThisProduct) {
            alert("A subscription is already active for " + (this.product.name || "this product") + "! You cannot add a new subscription while one is active.");
            return;
          }
          this.product["subscribe"] = true;
          this.valueChanges.emit(this.product);
        },
        error: () => {
          this.product["subscribe"] = true;
          this.valueChanges.emit(this.product);
        }
      });
    } else {
      this.loginS.loginPromptEvent.next(true);
    }
  }

  get isMultiDayDelivery(): boolean {
    if (!this.product) return false;
    const subs = this.product.subs_options;
    if (subs) {
      if (subs.multiDaySelected && subs.multiDaySelected.length > 0) return true;
      if (subs.rangeSelected && subs.rangeSelected.length > 0) return true;
    }
    const prefDays = DateE.normalizePreferredDays(this.product.preferred_days);
    if (prefDays && prefDays.length > 1 && prefDays.length < 7) {
      return true;
    }
    return false;
  }
}
