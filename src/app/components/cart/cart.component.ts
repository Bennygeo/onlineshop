import { Component, Input } from '@angular/core';
import { CartService } from 'src/app/services/cart.service';
import { Product } from 'src/app/utils/types';

@Component({
  selector: 'cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.scss'],
})
export class CartComponent {

  @Input() product: Product;

  //to get the loop count to create a dynamic css id
  @Input() index: string;

  viewDatesFlg: boolean = false;

  get isOutOfStock(): boolean {
    if (!this.product) return false;
    if (this.product.zoneAvailability) return true;
    if (this.product.is_unlimited === true || Number(this.product.is_unlimited) === 1) return false;
    return this.product.in_stock === false || Number(this.product.in_stock) === 0;
  }

  get maxStock(): number {
    if (!this.product) return 999;
    if (this.product.is_unlimited === true || Number(this.product.is_unlimited) === 1) return 999;
    if (this.product.stock_qty && this.product.stock_qty > 0) {
      return this.product.stock_qty;
    }
    return 999;
  }

  isDeleting: boolean = false;

  constructor(
    private cartS: CartService,
  ) { }

  deleteItem(evt?: MouseEvent) {
    if (evt) {
      evt.preventDefault();
      evt.stopPropagation();
    }
    if (this.isDeleting) return;

    const el = document.getElementById(`cart_${this.index}`);
    if (el) {
      // Pin to actual current height first so transition starts collapsing instantly
      const elHeight = el.offsetHeight;
      el.style.maxHeight = `${elHeight}px`;
      el.style.overflow = 'hidden';

      // Force layout repaint to register maxHeight
      void el.offsetHeight;

      this.isDeleting = true;

      // Animate collapse seamlessly via CSS transition
      requestAnimationFrame(() => {
        el.classList.add('item-removing');
        el.style.maxHeight = '0px';
        el.style.opacity = '0';
        el.style.transform = 'scale(0.92) translateX(28px)';
        el.style.paddingTop = '0px';
        el.style.paddingBottom = '0px';
        el.style.marginTop = '0px';
        el.style.marginBottom = '0px';
        el.style.borderWidth = '0px';
      });

      window.setTimeout(() => {
        this.plusMinusAction(0);
      }, 340);
    } else {
      this.isDeleting = true;
      this.plusMinusAction(0);
    }
  }

  plusMinusAction(val) {
    if (this.product.subscribe) {
      this.product.subs_options = {
        units: 0,
        multiDaySelected: [],
        rangeSelected: [],
        price: "0",
        rangeCnt: 0,
        multiCnt: 0
      }
      this.product.subscribe = false;
    }
    this.cartS.cartUpdateEvent.next({ cart: this.cartS.cartProducts, product: this.product, unit: val });
  }

  plusMinusSubsAction(val) {

  }

  getScheduledDeliveryInfo(): { label: string; icon: string; isPreferredDay: boolean } | null {
    if (!this.product) return null;
    const prefDays = this.product.preferred_days ? (Array.isArray(this.product.preferred_days) ? this.product.preferred_days : []) : [];
    
    if (prefDays.length > 0 && prefDays.length < 7) {
      let dObj: Date;
      if (this.product.scheduled_delivery_date) {
        dObj = new Date(this.product.scheduled_delivery_date);
      } else {
        dObj = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const target = new Date(dObj.getFullYear(), dObj.getMonth(), dObj.getDate());
      const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 1) {
        const formatted = dObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        return {
          label: `${formatted} • 7:00 AM Delivery`,
          icon: 'event_available',
          isPreferredDay: true
        };
      }
    }

    if (Number(this.product.allow_immediate_10) === 1) {
      return { label: '10 Mins Express Delivery', icon: 'bolt', isPreferredDay: false };
    }
    if (Number(this.product.allow_immediate_30) === 1) {
      return { label: '30 Mins Express Delivery', icon: 'speed', isPreferredDay: false };
    }
    if (Number(this.product.allow_immediate_60) === 1) {
      return { label: '60 Mins Delivery', icon: 'schedule', isPreferredDay: false };
    }

    return { label: 'Delivery Tomorrow 7:00 AM IST', icon: 'wb_sunny', isPreferredDay: false };
  }

  viewDates(evt): void {
    this.viewDatesFlg = true;
  }

  viewDatesCloseAction(evt): void {
    this.viewDatesFlg = false;
  }
}
