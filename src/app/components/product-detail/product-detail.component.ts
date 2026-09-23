import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { DatePipe, Location } from '@angular/common';
import { Subject, Subscription } from 'rxjs';

import { CartService } from 'src/app/services/cart.service';
import { ProductService } from 'src/app/services/product.service';
import { LoginService } from 'src/app/services/login.service';
import { OrderService } from 'src/app/services/order.service';
import { DateE } from 'src/app/utils/custom-classes';
import { Product, SubsOptions, ProductOptions } from 'src/app/utils/types';

@Component({
  selector: 'app-product-detail',
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.scss']
})
export class ProductDetailComponent implements OnInit, OnDestroy {
  productId: string = '';
  product: Product | null = null;
  loading: boolean = true;
  errorMessage: string = '';
  
  // Active Tab: 'overview' | 'nutrition' | 'storage' | 'recipes'
  activeTab: string = 'overview';

  // Share Toast notification
  showShareToast: boolean = false;
  toastMessage: string = '';
  private toastTimeout: any;

  // Subscription calendar state
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

  productsOptions: ProductOptions = {
    products: [],
    productsCategoryWise: {},
    product: undefined,
    loadingFlg: false
  };

  private subs: Subscription = new Subscription();

  get isProductInStock(): boolean {
    if (!this.product || this.product.disabled) return false;
    if (this.product.is_unlimited === true || Number(this.product.is_unlimited) === 1) return true;
    if (this.product.in_stock === false || Number(this.product.in_stock) === 0) return false;
    return (this.product.stock_qty === undefined || this.product.stock_qty === null || Number(this.product.stock_qty) > 0);
  }

  isItemInStock(item: Product): boolean {
    if (!item || item.disabled) return false;
    if (item.is_unlimited === true || Number(item.is_unlimited) === 1) return true;
    if (item.in_stock === false || Number(item.in_stock) === 0) return false;
    return (item.stock_qty === undefined || item.stock_qty === null || Number(item.stock_qty) > 0);
  }

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    public cartS: CartService,
    private productService: ProductService,
    private loginS: LoginService,
    private orderService: OrderService,
    private datePipe: DatePipe,
    private location: Location,
    private titleService: Title,
    private metaService: Meta
  ) {}

  ngOnInit(): void {
    this.cartS.loaderS?.hide?.();
    // Hide global header so ProductDetailComponent uses its dedicated sleek navigation bar
    this.cartS.headerChangeEvent.next('none');

    // Subscribe to route param changes
    this.subs.add(
      this.route.params.subscribe(params => {
        const id = params['id'];
        if (id) {
          this.productId = id;
          this.loadProductDetails(id);
        }
      })
    );

    // Subscribe to cart updates
    this.subs.add(
      this.cartS.notifyCartEvent.subscribe(() => {
        this.syncCartUnits();
      })
    );

    this.subs.add(
      this.cartS.storeSettingsUpdateEvent.subscribe(() => {
        if (this.product) {
          this.computeDeliveryAndPrices(this.product);
        }
      })
    );
  }

  loadProductDetails(id: string): void {
    this.loading = true;
    this.errorMessage = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const currentZone = this.loginS?.user?.zone || 'products';

    this.productService.getProductDetail(id, currentZone).subscribe({
      next: (data: any) => {
        this.loading = false;
        if (!data || data.error) {
          this.errorMessage = data?.error || 'Product details not found.';
          return;
        }

        this.product = data as Product;
        this.computeDeliveryAndPrices(this.product);
        this.syncCartUnits();
        this.updateSeoMeta(this.product);
      },
      error: (err: any) => {
        this.loading = false;
        // Fallback: check if product exists in CartService productsList
        const cached = this.cartS.productsList?.find(p => String(p.id) === String(id));
        if (cached) {
          this.product = { ...cached };
          this.computeDeliveryAndPrices(this.product);
          this.syncCartUnits();
          this.updateSeoMeta(this.product);
        } else {
          this.errorMessage = 'Unable to load product information. Please check your internet connection.';
        }
      }
    });
  }

  computeDeliveryAndPrices(p: Product): void {
    if (!p) return;
    p.changeInProduct = new Subject();

    p.disabled = (String(p['disabled']) === 'true');
    const isUnlimited = (p.is_unlimited === 1 || p.is_unlimited === true || String(p['is_unlimited']) === '1');
    p.is_unlimited = isUnlimited;

    if (p['stock_qty'] !== undefined && p['stock_qty'] !== null) {
      p.stock_qty = parseFloat(String(p['stock_qty']));
    }
    const hasStock = isUnlimited || (p.stock_qty === undefined || p.stock_qty === null || p.stock_qty > 0);
    const inStockFlag = isUnlimited || (p['in_stock'] !== false && String(p['in_stock']) !== '0' && p['in_stock'] !== 0);
    p.in_stock = inStockFlag && hasStock;

    if (!p['updated_weight']) p['updated_weight'] = p['weight'];

    let basePrice = Number(p['unit_price'] || p['price'] || 0);
    if (!p['unit_price'] || isNaN(Number(p['unit_price'])) || Number(p['unit_price']) <= 0) {
      p['unit_price'] = basePrice;
    }
    let origPrice = Number(p['unit_original_price'] || p['original_price'] || basePrice);
    if (!p['unit_original_price'] || isNaN(Number(p['unit_original_price']))) {
      p['unit_original_price'] = origPrice;
    }

    if (!p['subs_options']) {
      p.subs_options = {
        units: p.units || 0,
        multiDaySelected: [],
        rangeSelected: [],
        type: undefined,
        startDate: undefined,
        endDate: undefined
      };
    }

    p.delivery_date = this.cartS.deliveryDate;

    // Handle Preferred Delivery Days Forward Scheduling
    const prefDays = DateE.normalizePreferredDays(p.preferred_days);
    if (prefDays && prefDays.length > 0 && prefDays.length < 7) {
      const scheduledDate = DateE.getPreferredDaysNextDeliveryDate(prefDays, this.cartS.deliveryDate, this.cartS.storeSettings?.weekly_off_day);
      p.delivery_date = new DateE(scheduledDate);
      p.scheduled_delivery_label = DateE.formatPreferredDaysSummary(prefDays);
      p.scheduled_delivery_date = `${scheduledDate.getFullYear()}-${String(scheduledDate.getMonth() + 1).padStart(2, '0')}-${String(scheduledDate.getDate()).padStart(2, '0')}`;
    } else if (p.delivery_day != -1) {
      p.delivery_date = this.cartS.getNextDeliveryDate(p);
    }

    const subFlgVal = p.subscribe_flg !== undefined ? p.subscribe_flg : p['subscribeFlg'];
    if (subFlgVal !== undefined && subFlgVal !== null) {
      p.subscribeFlg = (Number(subFlgVal) === 1);
    } else {
      const cat = String(p.cat || '').toLowerCase();
      const name = String(p.name || '').toLowerCase();
      p.subscribeFlg = cat === 'milk' || name.includes('milk') || cat === 'tender' || name.includes('tender coconut');
    }

    const isImmOperating = this.cartS.isImmediateDeliveryOperatingHour();
    const hasImm30 = isImmOperating && Number(p.allow_immediate_30) === 1;
    const hasImm10 = isImmOperating && Number(p.allow_immediate_10) === 1;
    const hasImm60 = isImmOperating && Number(p.allow_immediate_60) === 1;

    const isActuallyTomorrow = (DateE.dateDiff(this.cartS.todaysDate, p.delivery_date) === 1);

    if (prefDays && prefDays.length > 0 && prefDays.length < 7) {
      try {
        p.delivery_date_enhanced = isActuallyTomorrow ? "Tomorrow" : (this.datePipe.transform(p["delivery_date"], 'EEE, MMM d') || 'Scheduled');
      } catch (e) {
        p.delivery_date_enhanced = p.scheduled_delivery_label || "Scheduled";
      }
    } else if (hasImm10) {
      p.delivery_date_enhanced = "10 mins";
    } else if (hasImm30) {
      p.delivery_date_enhanced = "30 mins";
    } else if (hasImm60) {
      p.delivery_date_enhanced = "60 mins";
    } else {
      try {
        p.delivery_date_enhanced = isActuallyTomorrow ? "Tomorrow" : this.datePipe.transform(p["delivery_date"], 'EEE, MMM d');
      } catch (e) {
        p.delivery_date_enhanced = isActuallyTomorrow ? "Tomorrow" : "Scheduled";
      }
    }

    // Savings Calculation
    if (p.original_price && Number(p.original_price) > Number(p.price)) {
      p.offer_percentage = Math.round(((Number(p.original_price) - Number(p.price)) / Number(p.original_price)) * 100);
    }
  }

  syncCartUnits(): void {
    if (!this.product) return;
    const inCart = this.cartS.cartProducts[this.product.id];
    if (inCart) {
      this.product.units = inCart.units;
    } else {
      this.product.units = 0;
    }

    // Also sync related products
    if (this.product.related_products && this.product.related_products.length > 0) {
      this.product.related_products.forEach(rel => {
        const rInCart = this.cartS.cartProducts[rel.id];
        rel.units = rInCart ? rInCart.units : 0;
      });
    }
  }

  updateSeoMeta(p: Product): void {
    const title = `${p.name} (${p.weight} ${p.unit_name || 'g'}) - TomorrowNeeds`;
    const desc = `Buy fresh ${p.name} online at best price ₹${p.price}. 100% farm fresh quality delivered directly to your doorstep.`;
    this.titleService.setTitle(title);
    this.metaService.updateTag({ name: 'description', content: desc });
    this.metaService.updateTag({ property: 'og:title', content: title });
    this.metaService.updateTag({ property: 'og:description', content: desc });
    if (p.img_url) {
      this.metaService.updateTag({ property: 'og:image', content: p.img_url });
    }
  }

  plusMinusValue(val: number, targetProd?: Product): void {
    const p = targetProd || this.product;
    if (!p) return;
    this.cartS.cartUpdateEvent.next({ cart: this.cartS.cartProducts, product: p, unit: val });
  }

  shareProduct(): void {
    if (!this.product) return;
    const shareUrl = window.location.href;
    const shareTitle = `${this.product.name} - TomorrowNeeds`;
    const shareText = `Order fresh ${this.product.name} at ₹${this.product.price} on TomorrowNeeds:`;

    if (navigator.share) {
      navigator.share({
        title: shareTitle,
        text: shareText,
        url: shareUrl
      }).catch((err) => {
        // Fallback to clipboard if user dismissed or share failed
        this.copyLinkToClipboard(shareUrl);
      });
    } else {
      this.copyLinkToClipboard(shareUrl);
    }
  }

  copyLinkToClipboard(url: string): void {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        this.triggerToast("Product link copied to clipboard!");
      }).catch(() => {
        this.fallbackCopy(url);
      });
    } else {
      this.fallbackCopy(url);
    }
  }

  private fallbackCopy(text: string): void {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.position = 'absolute';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      this.triggerToast("Product link copied to clipboard!");
    } catch (e) {
      this.triggerToast("Share URL: " + text);
    }
  }

  triggerToast(msg: string): void {
    this.toastMessage = msg;
    this.showShareToast = true;
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.showShareToast = false;
    }, 3000);
  }

  viewSubscription(evt: MouseEvent): void {
    if (!this.product) return;

    if (this.loginS.loginstatus()) {
      this.orderService.getActiveSubscriptions().subscribe({
        next: (subs: any) => {
          const activeForThisProduct = Array.isArray(subs) && subs.some((s: any) => String(s.productID) === String(this.product.id) && s.subsStatus !== 'cancelled');
          if (activeForThisProduct) {
            alert("A subscription is already active for " + (this.product.name || "this product") + "! You cannot add a new subscription while one is active.");
            return;
          }
          this.openSubscriptionModal();
        },
        error: () => {
          this.openSubscriptionModal();
        }
      });
    } else {
      this.loginS.loginPromptEvent.next(true);
    }
  }

  openSubscriptionModal(): void {
    if (!this.product) return;
    this.product.subscribe = true;
    this.productsOptions.product = this.product;
    this.subsOptions = {
      units: this.product.units || 1,
      startDate: null,
      endDate: null,
      minDate: new DateE(),
      maxDate: new DateE(),
      type: "range",
      rangeCnt: 0,
      multiCnt: 0,
      rangeSelected: [],
      multiDaySelected: []
    };
    this.subsOptions.minDate.addDays(1);
    this.subsOptions.maxDate.addDays(Number(this.product.max_days) || 30);
  }

  closeSubscriptionModal(): void {
    if (this.product) {
      this.product.subscribe = false;
    }
    this.productsOptions.product = undefined;
  }

  goToCart(): void {
    this.router.navigate(['/products/cart']);
  }

  goToSearch(): void {
    this.router.navigate(['/products/search']);
  }

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/home/view']);
    }
  }

  navigateToCategory(cat: string): void {
    if (!cat) return;
    this.router.navigate(['/products/category/' + encodeURIComponent(cat)]);
  }

  navigateToProduct(prodId: string): void {
    this.router.navigate(['/products/details/' + prodId]);
  }

  get priceDiff(): number {
    if (!this.product) return 0;
    const orig = Number(this.product.original_price || 0);
    const curr = Number(this.product.price || 0);
    return Math.max(0, orig - curr);
  }

  get numPrice(): number {
    return Number(this.product?.price || 0);
  }

  get numOriginalPrice(): number {
    return Number(this.product?.original_price || 0);
  }

  get totalCartItems(): number {
    return this.cartS.cartDetails?.totalItems || 0;
  }

  get totalCartAmount(): number {
    return this.cartS.cartDetails?.total || 0;
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
  }
}
