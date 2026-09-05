import { Component, OnDestroy, OnInit } from '@angular/core';
import { CartService } from 'src/app/services/cart.service';
import { SubsOptions, Product, SubProductType, DescriptionOptions, ProductOptions, menuOptions, renderOptions, SubsEntry } from 'src/app/utils/types';

import { Utils } from 'src/app/utils/utils';
import { ProductService } from 'src/app/services/product.service';
import { animate, style, transition, trigger } from '@angular/animations';
import { CustomAdaptor } from 'src/app/utils/custom-adaptor';
import { DateAdapter } from '@angular/material/core';
import { Location } from '@angular/common';
import { DateE } from 'src/app/utils/custom-classes';
import { LoginService } from 'src/app/services/login.service';

@Component({
  selector: 'app-product-list',
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.scss'],
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [   // :enter is alias to 'void => *'
        style({ opacity: 0 }),
        animate(100, style({ opacity: 1 }))
      ]),
      transition(':leave', [   // :leave is alias to '* => void'
        animate(200, style({ opacity: 0 }))
      ])
    ])
  ],
  providers: [{ provide: DateAdapter, useClass: CustomAdaptor }]
})

export class ProductListComponent implements OnInit, OnDestroy {
  //init
  productsOptions: ProductOptions = {
    products: [],
    productsCategoryWise: {},
    loadingFlg: true
  };

  subsOptions: SubsOptions = {
    units: 1,
    startDate: null,
    endDate: null,
    minDate: new DateE(),
    maxDate: new DateE(),
    type: "range",
    rangeCnt: 0,
    multiCnt: 0,
    totalPrice: 0,
    rangeSelected: [],
    multiDaySelected: []
  };

  menus: menuOptions;

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

  productDescFlg: boolean = false;
  afterViewInitFlg: boolean = false;

  calendarSwitchMsg: string = "";
  calendarSwitchFlg: boolean = false;
  calenderSwitchBtnName: string = "";
  firstTimeCalViewFlg: boolean = true;
  selectedCalendarType: "undefined" | "range" | "multi_day";
  // selectedCalendarType: "undefined" | "range" | "multi_day";
  cartSubscriber: any;
  isCart: boolean = false;

  constructor(
    public cartS: CartService,
    private _utils: Utils,
    public productService: ProductService,
    private location: Location,
    private loginS: LoginService
  ) {

    this.menus = this.productService.menus;
    this.productsOptions = this.productService.productsOptions;

    this.cartS.headerChangeEvent.next("type6");
    /*
    * Categories menu click handler
    */
    this.menus.menuClickHandler = (menu: string): void => {
      this.productsOptions.loadingFlg = true;
      this.menus.activeMenu = menu;

      //re-position the menu
      this.productService.menu_position();
      this.cartS.read_products(this.loginS.user.zone, menu);
    }

    this.productService.descUpdateEvent.subscribe((desc: DescriptionOptions) => {
      this.descriptionOptions = desc;
      this.productDescFlg = true;

      let validateTxt = (txt: string, splitChar: string): string => {
        if (txt.charAt(0) == splitChar) txt = txt.slice(1, 10000);
        if (!txt) txt = "";

        return txt;
      }

      this.descriptionOptions.shortdesc = validateTxt(this.descriptionOptions.shortdesc, "$");
      this.descriptionOptions.longdesc1 = validateTxt(this.descriptionOptions.longdesc1, "#");
      this.descriptionOptions.longdesc2 = validateTxt(this.descriptionOptions.longdesc2, "#");
      this.descriptionOptions.longdesc3 = validateTxt(this.descriptionOptions.longdesc3, "#");
    });

    //from cart service
    //Triggered when products downloaded from the server
    this.cartS.productsDownloadedEvent.subscribe((products: Array<Product>) => {

      this.productsOptions.products = products;

      this.menus.activeMenu = this.menus.activeMenu || this.menus.defaultMenu;
      //setup default active menu
      // this._utils.getElement("#" + this.menus.activeMenu).click();

      let renderResult = this.renderProducts();
      this.productsOptions.productsCategoryWise = renderResult.productsCategoryWise;

      //update cart value with live products list
      this.productsOptions.productsCategoryWise = this.cartS.updateCartValuesWithProduct(renderResult.productsCategoryWise);
      this.menus.subCategoryList = renderResult.subCategories;

      this.productsOptions.loadingFlg = false;

      this.productService.menu_position();
      this.location.replaceState(`/products/category/${this.menus.activeMenu}?tnk=${Date.now()}`);
    });

    this.cartS.productsExistEvent.subscribe((res: string) => {

      let renderResult = this.renderProducts();
      this.productsOptions.productsCategoryWise = renderResult.productsCategoryWise;

      //update cart value with live products list
      this.productsOptions.productsCategoryWise = this.cartS.updateCartValuesWithProduct(renderResult.productsCategoryWise);
      this.menus.subCategoryList = renderResult.subCategories;

      this.productsOptions.loadingFlg = false;
    });

    let productContHeight: string = "";
    this.cartSubscriber = this.cartS.isCart$.subscribe((res: boolean) => {
      this.isCart = res;
      productContHeight = (res) ? (window.innerHeight - 116) + "px" : (window.innerHeight - 50) + "px";
      // console.log("height :: " + productContHeight);
      //update product page height (page height - menu height - footer height)
      let timeout = setTimeout(() => {
        this._utils.css(".productsCont", { top: "9px", height: productContHeight, width: "calc(100vw - 67px)", "overflow-y": "scroll" });
        clearTimeout(timeout);
      });
    });
  }


  ngOnInit(): void {
    this.afterViewInitFlg = true;
    let loadingEl = document.getElementById("loading");
    if (loadingEl)
      loadingEl.remove();

    let targetCat = this.cartS.router.url.split("?")[0].split("/")[3];
    if (targetCat) {
      targetCat = decodeURIComponent(targetCat);
    }

    this.cartS.loadCategories().subscribe({
      next: (cats: any[]) => {
        if (cats && cats.length > 0) {
          const catList = cats.map(c => c.cat || c.name);
          this.productService.updateCategories(catList);
          this.menus.list = catList;

          if (!targetCat || !catList.includes(targetCat)) {
            targetCat = catList[0];
          }
          this.menus.activeMenu = targetCat;
          this.menus.menuClickHandler(this.menus.activeMenu);
        } else {
          this.menus.activeMenu = targetCat || this.menus.defaultMenu || "Vegetables";
          this.menus.menuClickHandler(this.menus.activeMenu);
        }
      },
      error: () => {
        this.menus.activeMenu = targetCat || this.menus.defaultMenu || "Vegetables";
        this.menus.menuClickHandler(this.menus.activeMenu);
      }
    });

    //get the downloaded products from the cart
    this.productsOptions.products = this.cartS.productsList;

    if (this.productsOptions.products.length > 0)
      this.productsOptions.loadingFlg = false;
  }

  renderProducts(): renderOptions {
    let _sub_categories: Array<string> = [];
    let _sub_category_products: SubProductType = {}
    let cat = "";

    for (var i = 0; i < this.productsOptions.products.length; i++) {

      cat = this.productsOptions.products[i]['cat'];
      let sub_cat = this.productsOptions.products[i]['sub_cat'];

      if (cat.toLocaleLowerCase() == this.menus.activeMenu.toLocaleLowerCase()) {
        sub_cat = sub_cat.trim();
        if (sub_cat != '') {
          _sub_categories.push(sub_cat);
          if (!_sub_category_products[sub_cat]) _sub_category_products[sub_cat] = { products: [] };
          _sub_category_products[sub_cat].products.push(this.productsOptions.products[i]);
        } else {
          if (!_sub_category_products[cat]) _sub_category_products[cat] = { products: [] };
          _sub_category_products[cat].products.push(this.productsOptions.products[i]);
        }
      }
    }
    //to remove duplicates
    _sub_categories = [...new Set(_sub_categories)];
    if (_sub_categories.length === 0) _sub_categories.push(this.menus.activeMenu);

    let timeout = setTimeout(() => {
      let productContHeight = (this.isCart) ? (window.innerHeight - 116) + "px" : (window.innerHeight - 50) + "px";
      this._utils.css(".productsCont", { top: "9px", height: productContHeight, width: "calc(100vw - 67px)", "overflow-y": "scroll" });
      clearTimeout(timeout);
    });

    this.menus.activeSubMenu = _sub_categories[0];
    return {
      productsCategoryWise: _sub_category_products,
      subCategories: _sub_categories
    };
  }


  popup_close_click_action() {
    this.firstTimeCalViewFlg = true;
    this.productsOptions.product['subscribe'] = false;
    this.productService.productsOptions = this.productsOptions;
    //to update Product component subscribe button status
    // this.updateChildComponent();
    // this.product.subs_options = undefined;
  }

  /*
  * Will be triggered from the product component whenever a change made in the product component.
  */
  onProductChanges(product: Product) {
    this.productsOptions.product = product;
    //reset the local object
    this.subsOptions = {
      units: product.units,
      startDate: null,
      endDate: null,
      minDate: new DateE(),
      maxDate: new DateE(),
      type: "range",
      rangeCnt: 0,
      multiCnt: 0,
      multiDaySelected: [],
      rangeSelected: []
    };

    this.subsOptions = (this.productsOptions.product.subs_options) ? this.productsOptions.product.subs_options : this.subsOptions;
    if (this.subsOptions.startDate && this.subsOptions.startDate) {
      this.subsOptions.rangeCnt = DateE.dateDiff(this.cartS.deliveryDate, this.subsOptions.endDate);
    }
    //get the count of selected days
    this.subsOptions.multiCnt = this.subsOptions.multiDaySelected.length || 0;
    this.subsOptions.rangeCnt = this.subsOptions.rangeSelected.length || 0;

    this.productsOptions.product['max_days'] = Number(this.productsOptions.product['max_days']);
    //update calendar
    this.subsOptions.minDate = new DateE();
    this.subsOptions.maxDate = new DateE();
    this.subsOptions.minDate.addDays(1);
    this.subsOptions.maxDate.addDays(this.productsOptions.product['max_days'] || 30);
    //render buttons, and it should triggered after the popup has been updated, since element creation happening inside the popup
    window.setTimeout(() => {
      // this.subscribeCalendarSelection(this.subsOptions.type || "range");
      this.subsOptions.type = this.subsOptions.type || "range";
    });
  }

  subscribeToCart(evt: MouseEvent): void {
  }

  descCloseAction(e: MouseEvent) {
    this.productDescFlg = false;
  }

  removeSubscription(evt: MouseEvent) {
    //Update child happens from the above functionality
  }

  notifyMe(cat: string) {
  }

  ngOnDestroy(): void {
    this.cartSubscriber.unsubscribe();
    // this.cartS.products_downloaded_event.unsubscribe();
  }
}
