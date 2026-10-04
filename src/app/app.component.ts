import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd } from '@angular/router';
import { CartService } from './services/cart.service';
import { CartDetails, PopupType } from './utils/types';
import { Common } from './modal/Common';
import { LoginService } from './services/login.service';
import { AnalyticsService } from './services/analytics.service';
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
    private utils: Utils,
    private analyticsS: AnalyticsService
  ) {
    this.analyticsS.init();

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

        if (!this.isAdminPage) {
          if (url === "/web") {
            this.cartS.router.navigate(["/home/view"], this.loginS.queryParams);
          }
          const isLarge = window.innerWidth >= 768 && !this.utils.isMobile();
          this.isMobile = !isLarge;
        }

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

      if (currentUrl === "/web") {
        this.cartS.router.navigate(['/home/view']);
      }
      this.isMobile = !isLargeScreen || this.utils.isMobile();
    });

    this.initPeriodicHardRefresh();
  }

  /**
   * Automatically performs a hard reload of the app/webview every 12 hours.
   * Preserves all user session data, login tokens, and localStorage intact.
   */
  private initPeriodicHardRefresh(): void {
    const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000; // 12 hours
    const STORAGE_KEY = 'tnk_last_hard_refresh_ts';

    const checkAndRefresh = () => {
      try {
        const now = Date.now();
        const lastRefreshStr = localStorage.getItem(STORAGE_KEY);

        if (!lastRefreshStr) {
          localStorage.setItem(STORAGE_KEY, now.toString());
          return;
        }

        const lastRefresh = parseInt(lastRefreshStr, 10);
        if (isNaN(lastRefresh) || (now - lastRefresh) >= TWELVE_HOURS_MS) {
          // Update timestamp first to prevent any reload loops
          localStorage.setItem(STORAGE_KEY, now.toString());

          // Safety check: do not interrupt active payment or checkout flow
          const href = window.location.href;
          if (href.includes('/cart/payment') || href.includes('razorpay') || href.includes('payment_status')) {
            return;
          }

          // Hard refresh webview while retaining all localStorage and sessionStorage data
          const url = new URL(window.location.href);
          url.searchParams.set('_r', now.toString());
          window.location.replace(url.toString());
        }
      } catch (e) {
        console.warn("Periodic webview refresh error:", e);
      }
    };

    // 1. Check immediately on app bootstrap
    checkAndRefresh();

    // 2. Check when app resumes/becomes visible (e.g. user opens app after hours in background)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkAndRefresh();
      }
    });

    window.addEventListener('focus', () => {
      checkAndRefresh();
    });

    // 3. Periodic interval check every 5 minutes while running
    setInterval(() => {
      checkAndRefresh();
    }, 5 * 60 * 1000);
  }
}
