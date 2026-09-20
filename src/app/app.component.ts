import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd } from '@angular/router';
import { CartService } from './services/cart.service';
import { CartDetails, PopupType } from './utils/types';
import { Common } from './modal/Common';
import { LoginService } from './services/login.service';
import { Utils } from './utils/utils';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  loadingFlg: boolean = false;
  test: string = "trt";

  cart_details: CartDetails = {
    total: 0,
    totalItems: 0
  };
  //Decide the cart vivibility flag variable
  cartBarVisibilityFlg: boolean = true;

  bottombarClass: string = "";
  popupItem: PopupType;
  isMobile: boolean = false;
  isAdminPage: boolean = false;


  constructor(
    public loginS: LoginService,
    public cartS: CartService,
    private activatedRoute: ActivatedRoute,
    private utils: Utils
  ) {

    this.loginS.popupEvent.subscribe((res: PopupType) => {
      this.popupItem = res;
    });

    this.cartS.notifyCartEvent.subscribe(() => {
      this.cart_details = this.cartS.cartDetails;
    });

    this.loginS.loginChangeEvent.subscribe((res: any) => {
      if (res === Common.loginStatus.LOGIN) {
      }
    });

    this.activatedRoute.queryParams.subscribe(res => {
      this.loginS.queryParams = res;
    });

    this.cartS.router.events.subscribe((res) => {
      if (res instanceof NavigationEnd) {
        const url = this.cartS.router.url.split("?")[0];
        const hash = window.location.hash || "";
        this.isAdminPage = url.startsWith("/admin") || hash.includes("admin") || window.location.pathname.includes("admin");

        if (url === "/home/view" || url === "/products/search" || url.includes("/products/details") || url.includes("/products/detail") || url.includes("/product/")) {
          this.bottombarClass = "type1";
        } else if (url.search("/products/category/") != 1) {
          this.bottombarClass = "type2";
        }

        if (url == "/home")
          this.cartS.router.navigate(["home/view"], this.loginS.queryParams);
      }
    });

    window.addEventListener("load", function () {
      setTimeout(function () {
        // This hides the address bar:
        window.scrollTo(0, 1);
      }, 1000);
    });
  }

  alertClose() {
    this.loginS.popupEvent.next({ flag: false, msg: "" });
  }

  exitAdminMode(): void {
    this.loginS.exitAdminMode();
    this.cartS.router.navigate(['/admin/users']);
  }

  ngOnInit(): void {
    this.cartS.windowSize$.subscribe(res => {
      const isLargeScreen = res.width >= 768;
      const currentUrl = this.cartS.router.url.split("?")[0];
      const hash = window.location.hash || "";
      const path = window.location.pathname || "";
      const isAdmin = currentUrl.startsWith('/admin') || hash.includes('/admin') || path.includes('/admin');
      const isAdminMode = !!this.loginS.getAdminMode()?.active;

      if (isAdmin) {
        this.isAdminPage = true;
        this.isMobile = false;
        return; // Preserve route on admin pages when refreshing
      }

      this.isAdminPage = false;

      // In admin impersonation mode, treat as active store view so admin can place orders directly
      if (isAdminMode) {
        this.isMobile = true;
        return;
      }

      if (isLargeScreen && !this.utils.isMobile()) {
        // Only redirect root or mobile home to /web on large screen
        if (currentUrl === '/' || currentUrl === '' || currentUrl === '/home/view') {
          this.cartS.router.navigate(['/web']);
        }
        this.isMobile = false;
      } else {
        if (currentUrl === "/web") {
          this.cartS.router.navigate(['/home/view']);
        }
        this.isMobile = true;
      }
    });
  }
}
