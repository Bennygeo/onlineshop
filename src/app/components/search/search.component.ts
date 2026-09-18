import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { of, Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
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
export class SearchComponent implements OnInit, OnDestroy {

  searchTerm: string = '';
  searchSubject: Subject<string> = new Subject<string>();

  productsOptions: ProductOptions = {
    products: [],
    productsCategoryWise: {},
    loadingFlg: false
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

  loadingFlg: boolean = false;
  notFoundFlg: boolean = false;
  hasSearched: boolean = false;

  allResults: Array<Product> = [];
  filteredResults: Array<Product> = [];
  trendingProducts: Array<Product> = [];
  availableCategories: Array<{ name: string, count: number }> = [];
  activeCategoryFilter: string = 'ALL';

  // Popular Trending Keywords for 1-Click Search
  trendingKeywords: string[] = [
    'Idli Dosa Batter',
    'Tomato',
    'Farm Fresh Milk',
    'Ragi Batter',
    'Country Eggs',
    'Tender Coconut',
    'Onion',
    'Greens',
    'Cold-Pressed Oil',
    'Carrot'
  ];

  // Popular Categories for quick browsing
  quickCategories = [
    { name: 'Vegetables', cat: 'Vegetables', icon: 'eco' },
    { name: 'Fruits', cat: 'Fruits', icon: 'nutrition' },
    { name: 'Batters', cat: 'Batter', icon: 'breakfast_dining' },
    { name: 'Milk & Dairy', cat: 'Dairyeggs', icon: 'local_drink' },
    { name: 'Coconut & Hydration', cat: 'Naturalhydrants', icon: 'water_drop' },
    { name: 'Greens & Sprouts', cat: 'Greenssprouts', icon: 'grass' },
    { name: 'Woodpressed Oils', cat: 'Woodpressed', icon: 'opacity' }
  ];

  menus: menuOptions = {
    list: this.cartService.categoryPriorityIndex,
    defaultMenu: "Vegetables",
    subCategoryList: [],
    subCategoryListID: []
  };

  private subs: Subscription = new Subscription();

  constructor(
    private apiService: ApiService,
    public cartService: CartService,
    private _utils: Utils,
    public productService: ProductService,
    public loginService: LoginService,
    public router: Router
  ) {
    this.cartService.headerChangeEvent.next("type6");

    // Search subject debounce pipeline
    this.subs.add(
      this.searchSubject.pipe(
        debounceTime(350),
        distinctUntilChanged(),
        switchMap(query => {
          const trimmed = (query || '').trim();
          if (trimmed.length >= 2) {
            this.loadingFlg = true;
            this.hasSearched = true;
            return this.apiService.postApi("/products/search_product.php", { query: trimmed }).pipe(
              catchError((err) => {
                console.error("Search error:", err);
                return of([]);
              })
            );
          } else if (trimmed.length === 0) {
            this.hasSearched = false;
            this.loadingFlg = false;
            this.notFoundFlg = false;
            this.allResults = [];
            this.filteredResults = [];
            return of([]);
          } else {
            return of([]);
          }
        })
      ).subscribe({
        next: (results: Array<Product>) => {
          this.loadingFlg = false;
          if (this.hasSearched) {
            this.processSearchResults(results || []);
          }
        },
        error: (err) => {
          this.loadingFlg = false;
          console.error("Search subscription error:", err);
        }
      })
    );

    // Also sync header search input
    this.subs.add(
      this.cartService.searchChangeEvent.subscribe(term => {
        if (term !== this.searchTerm) {
          this.searchTerm = term;
          this.searchSubject.next(term);
        }
      })
    );

    // Sync cart updates with live quantities
    this.subs.add(
      this.cartService.cartUpdateEvent.subscribe(() => {
        this.syncProductUnits(this.allResults);
        this.syncProductUnits(this.filteredResults);
        this.syncProductUnits(this.trendingProducts);
      })
    );

    this.subs.add(
      this.cartService.notifyCartEvent.subscribe(() => {
        this.syncProductUnits(this.allResults);
        this.syncProductUnits(this.filteredResults);
        this.syncProductUnits(this.trendingProducts);
      })
    );
  }

  ngOnInit(): void {
    this.loadTrendingProducts();
  }

  loadTrendingProducts() {
    this.apiService.postApi("/products/search_product.php", { query: '' }).subscribe({
      next: (res: Array<Product>) => {
        if (Array.isArray(res) && res.length > 0) {
          this.trendingProducts = res.slice(0, 10);
          this.syncProductUnits(this.trendingProducts);
        }
      }
    });
  }

  onSearchInput(event: any) {
    const val = event.target ? event.target.value : event;
    this.searchTerm = val;
    this.searchSubject.next(val);
  }

  searchKeyword(keyword: string) {
    this.searchTerm = keyword;
    this.searchSubject.next(keyword);
  }

  searchCategory(cat: string) {
    this.searchTerm = cat;
    this.searchSubject.next(cat);
  }

  clearSearch() {
    this.searchTerm = '';
    this.hasSearched = false;
    this.notFoundFlg = false;
    this.allResults = [];
    this.filteredResults = [];
    this.searchSubject.next('');
  }

  processSearchResults(products: Array<Product>) {
    this.allResults = products;
    this.syncProductUnits(this.allResults);

    // Compute category counts
    const catMap: { [cat: string]: number } = {};
    products.forEach(p => {
      const c = p.cat || 'General';
      catMap[c] = (catMap[c] || 0) + 1;
    });

    this.availableCategories = Object.keys(catMap).map(c => ({
      name: c,
      count: catMap[c]
    }));

    this.activeCategoryFilter = 'ALL';
    this.filteredResults = [...this.allResults];
    this.notFoundFlg = this.filteredResults.length === 0;
  }

  filterByCategory(categoryName: string) {
    this.activeCategoryFilter = categoryName;
    if (categoryName === 'ALL') {
      this.filteredResults = [...this.allResults];
    } else {
      this.filteredResults = this.allResults.filter(p => p.cat === categoryName);
    }
  }

  syncProductUnits(productList: Array<Product>) {
    if (!productList || !Array.isArray(productList)) return;
    for (let pro of productList) {
      pro.disabled = String(pro.disabled) === 'true';
      if (!pro['unit_price'] || isNaN(Number(pro['unit_price'])) || Number(pro['unit_price']) <= 0) {
        pro['unit_price'] = Number(pro.price || 0);
      }
      if (!pro['unit_original_price']) {
        pro['unit_original_price'] = Number(pro.original_price || pro['unit_price'] || 0);
      }
      if (!pro['base_weight']) {
        pro['base_weight'] = pro.weight || 500;
      }
      if (!pro['base_unit_name']) {
        pro['base_unit_name'] = pro.unit_name || 'grams';
      }

      const cartItem = this.cartService.cartProducts[pro.id];
      if (cartItem && cartItem["units"] > 0) {
        pro.units = cartItem["units"];
        pro.price = (cartItem["price"] !== undefined && cartItem["price"] !== null) ? cartItem["price"] : Math.round(Number(pro['unit_price']) * pro.units);
        pro.original_price = (cartItem["original_price"] !== undefined && cartItem["original_price"] !== null) ? cartItem["original_price"] : Math.round(Number(pro['unit_original_price']) * pro.units);
        pro.updated_weight = (cartItem["updated_weight"] !== undefined && cartItem["updated_weight"] !== null) ? cartItem["updated_weight"] : (Number(pro['base_weight']) * pro.units);
        pro.unit_name = cartItem["unit_name"] || pro.unit_name;
      } else {
        pro.units = 0;
        pro.price = Number(pro['unit_price']);
        pro.original_price = Number(pro['unit_original_price']);
        pro.updated_weight = pro['base_weight'];
        pro.unit_name = pro['base_unit_name'];
      }
    }
  }

  plusMinusValue(val: number, product: Product) {
    this.cartService.cartUpdateEvent.next({ cart: this.cartService.cartProducts, product: product, unit: val });
  }

  popup_close_click_action() {
    if (this.productsOptions.product) {
      this.productsOptions.product['subscribe'] = false;
    }
  }

  onProductChanges(product: Product) {
    this.productsOptions.product = product;
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
  }

  goBack() {
    this.router.navigate(['/home/view']);
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }
}
