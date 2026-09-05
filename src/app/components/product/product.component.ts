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
    })

  }

  init() {
    this.product.changeInProduct = new Subject();
    if (!this.product.units) this.product.units = 0;

    this.product.disabled = (String(this.product['disabled']) == 'true') ? true : false;

    let _quantity = (this.product.units * 1) || 1;

    if (!this.product['updated_weight']) this.product['updated_weight'] = this.product["weight"];

    if (!this.product['unit_price']) this.product['unit_price'] = Number(this.product['price'] || 0);

    if (this.product['stock_price'] !== undefined && this.product['profit_percent'] !== undefined) {
      this.product['price'] = Math.round(((this.product['stock_price'] * (1 + this.product['profit_percent'] / 100)) * _quantity));
    } else {
      this.product['price'] = Number(this.product['unit_price'] || 0) * _quantity;
    }

    if (!this.product['original_price']) {
      if (this.product['stock_price'] !== undefined && this.product['show_off_percent'] !== undefined) {
        this.product['original_price'] = Math.round((this.product['stock_price'] * (1 + this.product['show_off_percent'] / 100)) * 1);
      } else {
        this.product['original_price'] = this.product['price'];
      }
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

    if (this.product.delivery_day != -1) this.product.delivery_date = this.cartS.getNextDeliveryDate(this.product);

    if (this.product.subscribe_flg !== undefined && this.product.subscribe_flg !== null) {
      this.product.subscribeFlg = (Number(this.product.subscribe_flg) === 1);
    } else if (this.product.cat === 'Milk' || this.product.cat === 'Tender' || this.product.delivery_day == -1) {
      this.product.subscribeFlg = true;
    } else {
      this.product.subscribeFlg = false;
    }

    try {
      this.product.delivery_date_enhanced = (DateE.dateDiff(this.cartS.deliveryDate, this.product.delivery_date) == 0) ? "Tomorrow." : this.datePipe.transform(this.product["delivery_date"], 'EEE,MMM d');
    } catch (e) {
    }
  }

  plusMinusValue(val) {
    //Recieved by cart service
    this.cartS.cartUpdateEvent.next({ cart: this.cartS.cartProducts, product: this.product, unit: val });
  }

  detailed_view(evt: MouseEvent) {
    //to update the loading clicked status to show loading status
    this.descriptionOptions.productname = this.product.name;
    this.descriptionOptions.imgurl = this.product.img_url;
    this.descriptionOptions.loadingstatus = true;
    this._productService.descUpdateEvent.next(this.descriptionOptions);

    this._api.postApi('products/read_prod_desc.php', { 'p_id': this.product.id }).subscribe((desc: any) => {
      this.descriptionOptions.loadingstatus = false;

      try {
        if (desc[0]) {
          this.descriptionOptions = desc[0];

          this.descriptionOptions.productname = this.product.name;
          this.descriptionOptions.imgurl = this.product.img_url;

          this._productService.descUpdateEvent.next(this.descriptionOptions);
        } else this._productService.descUpdateEvent.next(this.descriptionOptions);
      } catch (e) {
        this._productService.descUpdateEvent.next(this.descriptionOptions);
      }
    });
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
}
