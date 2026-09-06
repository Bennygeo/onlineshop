import { Component, OnDestroy, OnInit } from '@angular/core';
import { Common } from 'src/app/modal/Common';
import { User } from 'src/app/modals/user';
import { CartService } from 'src/app/services/cart.service';
import { LoginService } from 'src/app/services/login.service';
import { DateE } from 'src/app/utils/custom-classes';
import { Banner, Product } from 'src/app/utils/types';

@Component({
  selector: 'app-view',
  templateUrl: './view.component.html',
  styleUrls: ['./view.component.scss']
})
export class ViewComponent implements OnInit, OnDestroy {
  user: User;

  userName: string = "there";
  greeting: string = "Hello";

  banners: Array<Banner> = [];
  base_url: string = "/assets/home/banners/"
  recommended_products: Array<Product> = [];
  timestamp: number = Date.now();
  bannerDownloadFlg: boolean = true;
  cartBarVisibilityFlg: boolean = true;

  categories: Array<any> = [];

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

  activeSlideIndex: number = 0;
  private autoSlideInterval: any;

  constructor(
    public cartS: CartService,
    private loginS: LoginService) {
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

    this.loginS.loginChangeEvent.subscribe((res: string) => {
      if (res === Common.loginStatus.LOGIN) {
        this.user = this.loginS.user;
        if (this.user.addresses.length > 0)
          this.userName = this.user.address?.name || "there!";
        else this.userName = "there!";
      } else if (res === Common.loginStatus.LOGOUT) {
        this.user = this.loginS.user;
        this.userName = "there!";
      }
    });

    this.greeting = DateE.getGreeting(new Date()) + "!";

    //get recommended products
    this.cartS.readBanners("products/download_table_sql.php", { 'table_name': 'banners' }).subscribe((banners: any) => {
      this.bannerDownloadFlg = false;
      this.banners = [];
      banners.forEach(element => {
        this.banners.push(
          { index: element.index, routeUrl: element.route_url, bgClr: element.bg_clr, title: element.title, desc: element.description });
      });
      this.banners.sort((a: Banner, b: Banner) => { return (a.index - b.index) });
    });

    this.cartS.zoneChangeEvent.subscribe({
      next: (zone: string) => {
        if (zone) {
          this.cartS.readRecommendedProducts(this.cartS.zoneTablePicker(zone)).subscribe((data: any) => {
            this.recommended_products = data;
            this.updateRecommendedProducts();
          });
        }
      }
    })

    this.cartS.notifyCartEvent.subscribe(() => {
      this.updateRecommendedProducts();
    });

    this.loginS.addressChangeEvent.subscribe((res: any) => {
      this.user = this.loginS.user;
      if (this.user.addresses.length > 0)
        this.userName = this.user.address.name;
      else this.userName = "there!";
    });

    this.cartS.cartUpdateEvent.subscribe(() => {
      this.cartBarVisibilityFlg = (this.cartS.cartDetails.totalItems > 0) ? true : false;
    });
  }

  updateRecommendedProducts() {
    for (var pro in this.recommended_products) {
      this.recommended_products[pro].disabled = String(this.recommended_products[pro].disabled) == 'true' ? true : false;
      for (var cpro in this.cartS.cartProducts)
        if (cpro == this.recommended_products[pro]['id']) {
          this.recommended_products[pro]['units'] = this.cartS.cartProducts[cpro]["units"];
        }
    }
  }

  sellAllAction() {
  }

  ngOnInit(): void {
    this.userName = this.loginS.user?.address?.name;
    this.recommended_products = this.cartS.recommendedProducts;
    this.startAutoSlide();
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

  plusMinusValue(val, product: Product) {
    this.cartS.cartUpdateEvent.next({ cart: this.cartS.cartProducts, product: product, unit: val });
  }

  ngOnDestroy(): void {
    this.stopAutoSlide();
  }
}
