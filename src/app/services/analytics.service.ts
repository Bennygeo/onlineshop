import { Injectable } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

declare let gtag: Function;

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private measurementId: string = environment.measurementId || 'G-LR2F63S1D3';
  private initialized: boolean = false;

  constructor(private router: Router) {}

  /**
   * Initializes automatic page view tracking across all Angular SPA route changes.
   */
  public init(): void {
    if (this.initialized) return;
    this.initialized = true;

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.trackPageView(event.urlAfterRedirects || event.url);
      });
  }

  /**
   * Tracks a page view in Google Analytics 4.
   * @param pagePath The URL path of the page (e.g. '/products/category/Vegetables')
   * @param pageTitle Optional custom title for the page
   */
  public trackPageView(pagePath: string, pageTitle?: string): void {
    try {
      if (typeof gtag === 'function') {
        gtag('config', this.measurementId, {
          page_path: pagePath,
          page_title: pageTitle || document.title,
          page_location: window.location.href
        });
      }
    } catch (e) {
      console.warn('[Analytics] Failed to send page view:', e);
    }
  }

  /**
   * Dispatches a custom GA4 event.
   * @param eventName Name of the event (e.g. 'add_to_cart', 'search', 'login')
   * @param params Optional event parameters
   */
  public trackEvent(eventName: string, params: Record<string, any> = {}): void {
    try {
      if (typeof gtag === 'function') {
        gtag('event', eventName, params);
      }
    } catch (e) {
      console.warn('[Analytics] Failed to send event:', e);
    }
  }

  /**
   * E-commerce Helper: Track search queries
   */
  public trackSearch(searchTerm: string): void {
    this.trackEvent('search', {
      search_term: searchTerm
    });
  }

  /**
   * E-commerce Helper: Track adding item to bag
   */
  public trackAddToCart(product: any, quantity: number = 1): void {
    this.trackEvent('add_to_cart', {
      currency: 'INR',
      value: (product.discount_price || product.price || 0) * quantity,
      items: [
        {
          item_id: product._id || product.id,
          item_name: product.name,
          item_category: product.category,
          price: product.discount_price || product.price,
          quantity: quantity
        }
      ]
    });
  }

  /**
   * E-commerce Helper: Track initiating checkout
   */
  public trackBeginCheckout(totalValue: number, itemsCount: number): void {
    this.trackEvent('begin_checkout', {
      currency: 'INR',
      value: totalValue,
      items_count: itemsCount
    });
  }

  /**
   * E-commerce Helper: Track completed purchase
   */
  public trackPurchase(orderId: string, totalValue: number, items: any[] = []): void {
    this.trackEvent('purchase', {
      transaction_id: orderId,
      currency: 'INR',
      value: totalValue,
      items: items.map(item => ({
        item_id: item.product_id || item._id,
        item_name: item.product_name || item.name,
        price: item.price,
        quantity: item.qty || item.quantity || 1
      }))
    });
  }
}
