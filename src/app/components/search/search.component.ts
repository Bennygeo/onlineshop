import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { ApiService } from 'src/app/services/api.service';
import { CartService } from 'src/app/services/cart.service';
import { LoginService } from 'src/app/services/login.service';
import { ProductService } from 'src/app/services/product.service';
import { DateE } from 'src/app/utils/custom-classes';
import { Product, ProductOptions, SubProductType, SubsOptions, menuOptions } from 'src/app/utils/types';
import { Utils } from 'src/app/utils/utils';

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss']
})
export class SearchComponent implements OnInit {

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

  loadingFlg: boolean = true;
  notFoundFlg: boolean = false;
  productCategoryWise: SubProductType = {
  };
  categoryPriorityIndex: Array<string> = [];

  priorityIndexedCategories: Array<string> = [];

  menus: menuOptions = {
    list: this.cartService.categoryPriorityIndex,
    defaultMenu: "Vegetables",
    subCategoryList: [],
    subCategoryListID: []
  }

  calendarSwitchMsg: string = "";
  calendarSwitchFlg: boolean = false;
  calenderSwitchBtnName: string = "";
  firstTimeCalViewFlg: boolean = true;
  selectedCalendarType: "undefined" | "range" | "multi_day";

  constructor(
    private apiService: ApiService,
    private cartService: CartService,
    private _utils: Utils,
    public productService: ProductService,
    private cart: CartService,
    private loginService: LoginService,
    private router: Router
  ) {
    this.cartService.headerChangeEvent.next("type6");

    this.categoryPriorityIndex = this.cartService.categoryPriorityIndex;

    this.cartService.searchChangeEvent.pipe(
      debounceTime(500),
      distinctUntilChanged(),

      switchMap(searchTerm => {
        if (searchTerm.length > 2) {
          return this.apiService.postApi("/products/search_product.php", { query: searchTerm });
        } else {
          return of([]);
        }
      })
    ).subscribe((searchResult: Array<Product>) => {
      this.loadingFlg = false;
      this.notFoundFlg = false;
      this.productCategoryWise = {};

      searchResult.forEach((element: any) => {
        if (!this.productCategoryWise[element.cat]) this.productCategoryWise[element.cat] = { products: [], index: this.categoryPriorityIndex.indexOf(element.cat) };

        if (this.cartService.cartProducts[element.id]) {
          element = { ...element, ...this.cartService.cartProducts[element.id] }
        }

        this.productCategoryWise[element.cat].products.push(element);
      });

      if (Object.keys(this.productCategoryWise).length == 0) this.notFoundFlg = true;

      let indexPos = [];
      for (let key in this.productCategoryWise) {
        indexPos.push({ index: this.productCategoryWise[key].index, cat: key });
      }
      indexPos.sort((a: any, b: any) => {
        return a.index - b.index;
      });

      this.priorityIndexedCategories = [];
      indexPos.forEach(el => {
        this.priorityIndexedCategories.push(el.cat);
      });
    });

    this.menus.menuClickHandler = (menu: string): void => {
      this.menus.activeMenu = menu;

      //re-position the menu
      this.menu_position();
      const catSection = document.getElementById('cat_section_' + menu);
      if (catSection) {
        catSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        const zone = this.loginService.user?.zone || 'zone1';
        this.cartService.read_products(zone, menu);
        this.router.navigate(['/products/category/' + menu]);
      }
    };

    this.cartService.isCart$.subscribe((res: boolean) => {
      console.log("search page :: " + res);

      // this.isCart = res;
      let productContHeight = (res) ? (window.innerHeight - 120) + "px" : (window.innerHeight - 70) + "px";
      // console.log("height :: " + productContHeight);
      //update product page height (page height - menu height - footer height)
      let timeout = setTimeout(() => {
        this._utils.css(".products-cont", { top: "60px", height: productContHeight, width: "calc(100vw - 67px)", "overflow-y": "scroll" });
        clearTimeout(timeout);
      });
    });

  }

  menu_position(): void {
    if (this.menus.activeMenu) {
      try {
        let _pos_top = this._utils.getElement("#" + this.menus.activeMenu).offsetTop + this._utils.getElement('.sub_menu')['scrollTop'];
        let _diff_to_minus = 0;
        if (_pos_top > 200) {
          _diff_to_minus = _pos_top - ((window.innerHeight - 50) / 2 - this._utils.getElement("#" + this.menus.activeMenu).offsetHeight / 2);
        }
        _diff_to_minus = _diff_to_minus - this._utils.getElement(".sub_menu").scrollTop;

        this._utils.getElement(".sub_menu").scrollTo({
          top: Math.max(0, _diff_to_minus),
          behavior: 'smooth'
        });

      } catch (e) { }
    }
  }

  popup_close_click_action() {
    this.firstTimeCalViewFlg = true;
    this.productsOptions.product['subscribe'] = false;
    this.productService.productsOptions = this.productsOptions;
    //to update Product component subscribe button status
    // this.updateChildComponent();
    // this.product.subs_options = undefined;
  }



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
      this.subsOptions.rangeCnt = DateE.dateDiff(this.cart.deliveryDate, this.subsOptions.endDate);
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

  ngOnInit(): void {
  }

}
