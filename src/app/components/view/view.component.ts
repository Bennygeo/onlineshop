import { Component, OnDestroy, OnInit } from '@angular/core';
import { Common } from 'src/app/modal/Common';
import { User } from 'src/app/modals/user';
import { CartService } from 'src/app/services/cart.service';
import { LoginService } from 'src/app/services/login.service';
import { OrderService } from 'src/app/services/order.service';
import { Banner, Product } from 'src/app/utils/types';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-view',
  templateUrl: './view.component.html',
  styleUrls: ['./view.component.scss']
})
export class ViewComponent implements OnInit, OnDestroy {
  user: User;

  userName: string = "there";
  greetingData: { greeting: string, icon: string } = { greeting: 'Hello', icon: 'wb_sunny' };

  banners: Array<Banner> = [];
  base_url: string = "/assets/home/banners/";
  recommended_products: Array<Product> = [];
  recent_products: Array<Product> = [];
  batter_products: Array<Product> = [];

  timestamp: number = Date.now();
  bannerDownloadFlg: boolean = true;
  cartBarVisibilityFlg: boolean = true;

  categories: Array<any> = [];

  // Active delivery tracker
  activeUpcomingOrder: any = null;
  walletBalance: number = 0;

  private subs: Subscription = new Subscription();

  // 4 Featured Slides: Vegetables, Fruits, Milk, Tender Coconut
  heroSlides = [
    {
      id: 'veg',
      title: 'Farm Fresh Vegetables',
      desc: '100% Organic & handpicked daily from local farms',
      badge: 'Farm Fresh',
      category: 'Vegetables',
      routerLink: '/products/category/Vegetables',
      bgGradient: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
      imgUrl: 'assets/categories/Thinkspot_veggiesIcon.png',
      btnText: 'Shop Vegetables'
    },
    {
      id: 'fruits',
      title: 'Juicy & Fresh Fruits',
      desc: 'Naturally ripened, nutrient-rich seasonal fruits',
      badge: 'Fresh Harvest',
      category: 'Fruits',
      routerLink: '/products/category/Fruits',
      bgGradient: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
      imgUrl: 'assets/categories/Thinkspot_fruitIcon.png',
      btnText: 'Shop Fruits'
    },
    {
      id: 'milk',
      title: 'Pure Farm Fresh Milk',
      desc: 'Unadulterated, wholesome & fresh daily delivery',
      badge: 'Pure & Fresh',
      category: 'Dairyeggs',
      routerLink: '/products/category/Dairyeggs',
      bgGradient: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
      imgUrl: 'assets/categories/Thinkspot_greensIcon.png',
      btnText: 'Shop Milk & Dairy'
    },
    {
      id: 'coconut',
      title: 'Natural Tender Coconut',
      desc: 'Cool, refreshing 100% natural electrolyte hydration',
      badge: 'Natural Hydration',
      category: 'Naturalhydrants',
      routerLink: '/products/category/Naturalhydrants',
      bgGradient: 'linear-gradient(135deg, #15803d 0%, #166534 100%)',
      imgUrl: 'assets/categories/Thinkspot_greensIcon.png',
      btnText: 'Shop Tender Coconut'
    }
  ];

  // Quick Perks
  groceryPerks = [
    { icon: 'bolt', title: '7 AM Delivery', desc: 'Fresh at doorstep' },
    { icon: 'eco', title: '100% Farm Pure', desc: 'No chemicals' },
    { icon: 'payments', title: 'COD', desc: 'Pay at door' },
    { icon: 'event_repeat', title: 'Easy Subscriptions', desc: 'Pause anytime' }
  ];

  activeSlideIndex: number = 0;
  private autoSlideInterval: any;

  constructor(
    public cartS: CartService,
    public loginS: LoginService,
    public orderService: OrderService
  ) {
    this.cartS.headerChangeEvent.next("type1");

    this.cartS.loadCategories().subscribe({
      next: (cats: any[]) => {
        if (cats && cats.length > 0) {
          this.categories = cats.map(c => ({
            name: c.name,
            imgUrl: c.imgUrl || "assets/categories/Thinkspot_veggiesIcon.png",
            routerLink: "/products/category/" + c.cat
          }));
        }
      }
    });

    this.updateGreeting();

    this.subs.add(
      this.loginS.loginChangeEvent.subscribe((res: string) => {
        if (res === Common.loginStatus.LOGIN) {
          this.user = this.loginS.user;
          this.userName = this.user.address?.name || "there";
          this.loginS.readWallet();
          this.orderService.getOrders();
          this.loadRecentPurchases();
        } else if (res === Common.loginStatus.LOGOUT) {
          this.user = this.loginS.user;
          this.userName = "there";
          this.activeUpcomingOrder = null;
          this.recent_products = [];
          this.walletBalance = 0;
        }
      })
    );

    this.subs.add(
      this.loginS.walletUpdateEvent.subscribe(() => {
        this.walletBalance = this.loginS.user?.wallet || 0;
      })
    );

    this.subs.add(
      this.orderService.ordersEvent.subscribe((orders: Array<any>) => {
        if (orders && Array.isArray(orders)) {
          const upcoming = orders.filter(
            (o) => o.status === 'PLACED' || o.status === 'PACKED' || o.status === 'OUT_FOR_DELIVERY'
          );
          if (upcoming.length > 0) {
            this.activeUpcomingOrder = upcoming[0];
            this.activeUpcomingOrder.delivery_date = this.safeDate(this.activeUpcomingOrder.delivery_date);
          } else {
            this.activeUpcomingOrder = null;
          }
          if (this.recent_products.length === 0 && this.loginS.user?.mobile) {
            this.loadRecentPurchases();
          }
        }
      })
    );

    // Read banners
    this.cartS.readBanners("products/download_table_sql.php", { 'table_name': 'banners' }).subscribe((banners: any) => {
      this.bannerDownloadFlg = false;
      this.banners = [];
      if (Array.isArray(banners)) {
        banners.forEach(element => {
          this.banners.push({
            index: element.index,
            routeUrl: element.route_url,
            bgClr: element.bg_clr,
            title: element.title,
            desc: element.description
          });
        });
        this.banners.sort((a: Banner, b: Banner) => (a.index - b.index));
      }
    });

    this.subs.add(
      this.cartS.zoneChangeEvent.subscribe({
        next: (zone: string) => {
          if (zone) {
            const tableName = this.cartS.zoneTablePicker(zone);
            this.cartS.readRecommendedProducts(tableName).subscribe((data: any) => {
              this.recommended_products = data || [];
              this.syncProductUnits(this.recommended_products);
            });
            this.loadBatterProducts(tableName);
          }
        }
      })
    );

    this.subs.add(
      this.cartS.notifyCartEvent.subscribe(() => {
        this.syncAllProductUnits();
      })
    );

    this.subs.add(
      this.loginS.addressChangeEvent.subscribe(() => {
        this.user = this.loginS.user;
        this.userName = this.user?.address?.name || "there";
      })
    );

    this.subs.add(
      this.cartS.cartUpdateEvent.subscribe(() => {
        this.cartBarVisibilityFlg = (this.cartS.cartDetails.totalItems > 0);
        this.syncAllProductUnits();
      })
    );
  }

  loadRecentPurchases() {
    const mobile = this.loginS.user?.mobile;
    if (!mobile) return;
    this.cartS.readRecentPurchases(mobile).subscribe({
      next: (data: any) => {
        if (Array.isArray(data) && data.length > 0) {
          this.recent_products = data;
          this.syncProductUnits(this.recent_products);
        } else {
          this.recent_products = [];
        }
      },
      error: () => {
        this.recent_products = [];
      }
    });
  }

  loadBatterProducts(tableName?: string) {
    this.cartS.readBatterProducts(tableName).subscribe({
      next: (data: any) => {
        if (Array.isArray(data) && data.length > 0) {
          this.batter_products = data;
          this.syncProductUnits(this.batter_products);
        } else {
          this.batter_products = [];
        }
      },
      error: () => {
        this.batter_products = [];
      }
    });
  }

  syncAllProductUnits() {
    this.syncProductUnits(this.recommended_products);
    this.syncProductUnits(this.recent_products);
    this.syncProductUnits(this.batter_products);
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

      const cartItem = this.cartS.cartProducts[pro.id];
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

  updateGreeting() {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 12) {
      this.greetingData = { greeting: 'Good morning', icon: 'wb_sunny' };
    } else if (hour >= 12 && hour < 17) {
      this.greetingData = { greeting: 'Good afternoon', icon: 'light_mode' };
    } else if (hour >= 17 && hour < 22) {
      this.greetingData = { greeting: 'Good evening', icon: 'wb_twilight' };
    } else {
      this.greetingData = { greeting: 'Good night', icon: 'bedtime' };
    }
  }

  safeDate(rawDate: any): Date {
    if (!rawDate || rawDate === "undefined" || rawDate === "null" || rawDate === "0000-00-00 00:00:00" || rawDate === "0000-00-00") {
      let d = new Date();
      d.setDate(d.getDate() + 1);
      return d;
    }
    if (rawDate instanceof Date) return isNaN(rawDate.getTime()) ? new Date() : rawDate;
    const d = new Date(rawDate);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  formatShortId(orderId: string): string {
    if (!orderId) return '';
    const parts = String(orderId).split('_');
    if (parts.length >= 3) return '#' + parts[parts.length - 1];
    if (orderId.length > 8) return '#' + orderId.slice(-5);
    return '#' + orderId;
  }

  isTomorrow(d: Date): boolean {
    if (!d) return true;
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return d.getDate() === tomorrow.getDate() && d.getMonth() === tomorrow.getMonth() && d.getFullYear() === tomorrow.getFullYear();
  }

  getAddressShortText(): string {
    if (this.loginS.user?.address) {
      const a = this.loginS.user.address;
      return a.address || a.title || a.pincode || 'Select Location';
    }
    return 'Select Location';
  }

  openAddressSelector() {
    this.loginS.headerAddressSelectionEvent.next(true);
  }

  goToWallet() {
    this.cartS.router.navigate(['/home/wallet']);
  }

  goToOrders() {
    this.cartS.router.navigate(['/home/orders']);
  }

  goToSearch() {
    this.cartS.router.navigate(['/products/search']);
  }

  goToCategory(catName: string) {
    this.cartS.router.navigate(['/products/category/' + catName]);
  }

  sellAllAction() {
    this.cartS.router.navigate(['/products/category/Vegetables']);
  }

  ngOnInit(): void {
    this.userName = this.loginS.user?.address?.name || "there";
    this.walletBalance = this.loginS.user?.wallet || 0;
    this.recommended_products = this.cartS.recommendedProducts || [];
    this.syncAllProductUnits();
    this.startAutoSlide();

    if (this.loginS.user?.mobile) {
      this.loadRecentPurchases();
    }
    this.loadBatterProducts(this.cartS.zoneTablePicker(this.loginS.user?.zone || 'zone1'));
  }

  startAutoSlide() {
    this.stopAutoSlide();
    this.autoSlideInterval = setInterval(() => {
      this.activeSlideIndex = (this.activeSlideIndex + 1) % this.heroSlides.length;
    }, 4000);
  }

  stopAutoSlide() {
    if (this.autoSlideInterval) {
      clearInterval(this.autoSlideInterval);
    }
  }

  goToSlide(index: number) {
    this.activeSlideIndex = index;
    this.startAutoSlide();
  }

  nextSlide(event?: Event) {
    if (event) event.stopPropagation();
    this.activeSlideIndex = (this.activeSlideIndex + 1) % this.heroSlides.length;
    this.startAutoSlide();
  }

  prevSlide(event?: Event) {
    if (event) event.stopPropagation();
    this.activeSlideIndex = (this.activeSlideIndex - 1 + this.heroSlides.length) % this.heroSlides.length;
    this.startAutoSlide();
  }

  onBannerClick(slide: any) {
    this.cartS.router.navigate([slide.routerLink]);
  }

  plusMinusValue(val: number, product: Product) {
    this.cartS.cartUpdateEvent.next({ cart: this.cartS.cartProducts, product: product, unit: val });
  }

  ngOnDestroy(): void {
    this.stopAutoSlide();
    this.subs.unsubscribe();
  }
}
