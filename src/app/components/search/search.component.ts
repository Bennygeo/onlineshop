import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { of, Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { ApiService } from 'src/app/services/api.service';
import { CartService } from 'src/app/services/cart.service';
import { LoginService } from 'src/app/services/login.service';
import { ProductService } from 'src/app/services/product.service';
import { AiService, AiMessageResponse, AiSuggestedProduct } from 'src/app/services/ai.service';
import { DateE } from 'src/app/utils/custom-classes';
import { Product, ProductOptions, SubsOptions, menuOptions } from 'src/app/utils/types';
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

  // AI Assistant State
  aiLoading: boolean = false;
  aiResponse: AiMessageResponse | null = null;
  aiActivePrompt: string = '';
  showAiCard: boolean = false;
  aiSuggestedProducts: Array<Product> = [];

  // AI Recipe / Meal Kits
  aiRecipeKits = [
    { label: '🥘 Sambar Kit', query: 'Ingredients for making traditional South Indian Sambar' },
    { label: '🥗 Fresh Salad Bowl', query: 'Fresh vegetables for a healthy crunchy salad' },
    { label: '🍲 Veg Kurma Pack', query: 'Vegetables needed for South Indian style Veg Kurma' },
    { label: '🥞 Dosa & Chutney Kit', query: 'Fresh batter, coconut, and items for Crispy Dosa with Chutney' },
    { label: '🍵 Immunity Greens Kit', query: 'Fresh ginger, lemon, greens and herbs for health' }
  ];

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
    { name: 'Greens', cat: 'Greens', icon: 'grass' },
    { name: 'Flowers', cat: 'Flowers', icon: 'local_florist' },
    { name: 'Oils', cat: 'Oils', icon: 'opacity' }
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
    public aiService: AiService,
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

            // Instant in-memory search across cached product catalog
            if (this.cartService.allProductsLoaded && this.cartService.productsList && this.cartService.productsList.length > 0) {
              const q = trimmed.toLowerCase();
              const matched = this.cartService.productsList.filter(p =>
                (p.name && p.name.toLowerCase().includes(q)) ||
                (p.tamil_name && p.tamil_name.toLowerCase().includes(q)) ||
                (p.cat && p.cat.toLowerCase().includes(q)) ||
                (p.sub_cat && p.sub_cat.toLowerCase().includes(q))
              );
              return of(matched);
            }

            return this.apiService.postApi("/products/search_product.php", { query: trimmed }, true).pipe(
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
        this.syncProductUnits(this.aiSuggestedProducts);
      })
    );

    this.subs.add(
      this.cartService.notifyCartEvent.subscribe(() => {
        this.syncProductUnits(this.allResults);
        this.syncProductUnits(this.filteredResults);
        this.syncProductUnits(this.trendingProducts);
        this.syncProductUnits(this.aiSuggestedProducts);
      })
    );
  }

  ngOnInit(): void {
    this.cartService.loaderS?.hide?.();
    this.loadTrendingProducts();
  }

  loadTrendingProducts() {
    this.apiService.postApi("/products/search_product.php", { query: '' }, true).subscribe({
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
    this.availableCategories = [];
    this.activeCategoryFilter = 'ALL';
    this.showAiCard = false;
    this.aiResponse = null;
    this.aiSuggestedProducts = [];
  }

  askAi(query?: string) {
    const prompt = (query || this.searchTerm || '').trim();
    if (!prompt) return;

    this.aiActivePrompt = prompt;
    this.showAiCard = true;
    this.aiLoading = true;
    this.aiResponse = null;
    this.aiSuggestedProducts = [];

    const userMobile = this.loginService.user?.mobile || '';
    this.aiService.askAssistant(prompt, userMobile).subscribe({
      next: (res) => {
        this.aiLoading = false;
        this.aiResponse = res;
        if (res && res.suggested_products && Array.isArray(res.suggested_products)) {
          this.aiSuggestedProducts = res.suggested_products.map((p: any) => ({
            id: p.id,
            name: p.name,
            tamil_name: p.tamil_name || p.name,
            main_category: p.cat || 'Vegetables',
            sub_category: p.sub_cat || 'General',
            cat: p.cat || 'Vegetables',
            sub_cat: p.sub_cat || 'General',
            whole_sale_price: Number(p.price || 0),
            profit_percent: 0,
            show_off_percent: 0,
            price: Number(p.price || 0),
            total_price: Number(p.price || 0),
            original_price: Number(p.original_price || p.price || 0),
            original_weight: Number(p.weight || 500),
            weight: Number(p.weight || 500),
            updated_weight: Number(p.weight || 500),
            img_url: p.img_url || 'assets/categories/Thinkspot_veggiesIcon.png',
            base_unit: 1,
            units: 0,
            original_unit_name: p.unit_name || p.unit || 'grams',
            unit_name: p.unit_name || p.unit || 'grams',
            index: 0,
            offer: 0,
            disabled: false,
            in_stock: true,
            packing_charges: 0,
            delivery_charges: 0,
            subscribe: false
          } as Product));
          this.syncProductUnits(this.aiSuggestedProducts);
        } else {
          this.aiSuggestedProducts = [];
        }
      },
      error: () => {
        this.aiLoading = false;
        this.aiResponse = {
          status: 'fallback',
          reply: 'Unable to reach AI assistant right now. Please try again or browse our categories!',
          source: 'offline',
          suggested_products: []
        };
        this.aiSuggestedProducts = [];
      }
    });
  }

  closeAiCard() {
    this.showAiCard = false;
    this.aiResponse = null;
    this.aiSuggestedProducts = [];
  }

  getAiProductCartQty(id: string): number {
    return this.cartService.cartProducts[id]?.units || 0;
  }

  addAiProductToCart(item: any) {
    const product: any = {
      id: item.id,
      name: item.name,
      tamil_name: item.tamil_name || item.name,
      price: String(item.price),
      original_price: Number(item.original_price || item.price),
      weight: Number(item.weight || 500),
      unit_name: item.unit_name || item.unit || 'grams',
      updated_weight: Number(item.weight || 500),
      units: 1,
      disabled: false,
      img_url: item.img_url || 'assets/categories/Thinkspot_veggiesIcon.png',
      cat: item.cat || 'Vegetables',
      sub_cat: item.sub_cat || 'General',
      subscribe: false,
      in_stock: true
    };

    const currentQty = this.cartService.cartProducts[item.id]?.units || 0;
    this.cartService.cartUpdateEvent.next({
      cart: this.cartService.cartProducts,
      product: product,
      unit: currentQty + 1
    });
  }

  processSearchResults(products: Array<Product>) {
    this.allResults = products.map(p => ({
      ...p,
      price: Number(p.price || 0),
      original_price: Number(p.original_price || p.price || 0),
      units: 0
    }));

    this.syncProductUnits(this.allResults);

    // Group available categories
    const catCounts: { [cat: string]: number } = {};
    for (let p of this.allResults) {
      const cat = p.cat || 'Other';
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    }

    this.availableCategories = Object.keys(catCounts).map(cat => ({
      name: cat,
      count: catCounts[cat]
    }));

    this.activeCategoryFilter = 'ALL';
    this.filteredResults = [...this.allResults];
    this.notFoundFlg = this.filteredResults.length === 0;

    // If no direct keyword match found, automatically ask AI in the background
    if (this.notFoundFlg && this.searchTerm.trim().length >= 3) {
      this.askAi(this.searchTerm);
    }
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

  viewProductDetail(product: Product): void {
    if (product && product.id) {
      this.router.navigate(['/products/details/' + product.id]);
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

  isProductInStock(product: Product): boolean {
    if (!product || product.disabled) return false;
    if (product.is_unlimited === true || Number(product.is_unlimited) === 1) return true;
    if (product.in_stock === false || Number(product.in_stock) === 0) return false;
    return (product.stock_qty === undefined || product.stock_qty === null || Number(product.stock_qty) > 0);
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }
}
