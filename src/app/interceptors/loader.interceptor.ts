import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor
} from '@angular/common/http';
import { Observable, finalize } from 'rxjs';
import { LoaderService } from '../services/loader.service';

@Injectable()
export class LoaderInterceptor implements HttpInterceptor {

  service_count: number = 0;
  private safetyTimer: any = null;

  private backgroundUrls: string[] = [
    'chat.php',
    'recommended_products.php',
    'recent_purchases.php',
    'orders.php',
    'product_orders.php',
    'orders_status.php',
    'active_subs.php',
    'update_subs.php',
    'pause_play.php',
    'master_coupons.php',
    'user_coupons.php',
    'write_user_coupon.php',
    'update_user_coupon.php',
    'save_expense.php',
    'get_logs.php',
    'read_last.php',
    'referral_validation.php',
    'read_wallet.php',
    'get_cart.php',
    'download_multiple_products.php',
    'download_products_sql.php',
    'get_categories.php',
    'get_product_detail.php',
    'search_product.php',
    'search_products.php'
  ];

  constructor(private loaderS: LoaderService) { }

  private isEssentialRequest(request: HttpRequest<unknown>): boolean {
    // 1. Explicit skip headers set by ApiService or components
    if (request.headers.has('X-Skip-Loader') || request.headers.has('X-Background-Request')) {
      return false;
    }

    const fullUrl = request.url.toLowerCase();
    const endpoint = (request.url.split('?')[0].split('/').pop() || '').toLowerCase();

    // 2. AI endpoints and background suggestion queries
    if (fullUrl.includes('/ai/') || fullUrl.includes('chat.php') ||
        fullUrl.includes('recommended_products') || fullUrl.includes('recent_purchases')) {
      return false;
    }

    // 3. Known background / polling / tracking / product / cart scripts
    if (this.backgroundUrls.indexOf(endpoint) !== -1) {
      return false;
    }

    // 4. Cart & Products pages suppression: pages with inline shimmer skeletons or cart views shouldn't show full-screen loader
    if (typeof window !== 'undefined' && window.location && window.location.href) {
      const currentHref = window.location.href.toLowerCase();
      if (currentHref.includes('cart') || currentHref.includes('products') || currentHref.includes('/product') || currentHref.includes('/p/')) {
        const orderPlacementEndpoints = ['place_order.php', 'razor_pay.php', 'verify.php', 'create_order.php'];
        if (orderPlacementEndpoints.indexOf(endpoint) === -1) {
          return false;
        }
      }
    }

    return true;
  }

  private startSafetyTimer(): void {
    if (this.safetyTimer) {
      clearTimeout(this.safetyTimer);
    }
    // Max 6s loader safeguard on shared hosting to guarantee the UI is never permanently blocked
    this.safetyTimer = setTimeout(() => {
      if (this.service_count > 0) {
        this.service_count = 0;
        this.loaderS.hide();
      }
    }, 6000);
  }

  private clearSafetyTimer(): void {
    if (this.service_count === 0 && this.safetyTimer) {
      clearTimeout(this.safetyTimer);
      this.safetyTimer = null;
    }
  }

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const isEssential = this.isEssentialRequest(request);

    if (isEssential) {
      this.service_count++;
      this.loaderS.show();
      this.startSafetyTimer();
    }

    // Strip client-only interceptor control headers so they do not trigger CORS preflights or backend header rejections
    let reqToSend = request;
    if (request.headers.has('X-Skip-Loader') || request.headers.has('X-Background-Request')) {
      let headers = request.headers.delete('X-Skip-Loader').delete('X-Background-Request');
      reqToSend = request.clone({ headers });
    }

    return next.handle(reqToSend).pipe(
      finalize(() => {
        if (isEssential) {
          this.service_count--;
          if (this.service_count <= 0) {
            this.service_count = 0;
            this.loaderS.hide();
            this.clearSafetyTimer();
          }
        }
      })
    );
  }
}


