import { Component, OnDestroy, OnInit } from '@angular/core';
import { CartService } from 'src/app/services/cart.service';
import { LoginService } from 'src/app/services/login.service';
import { OrderService } from 'src/app/services/order.service';
import { Product } from 'src/app/utils/types';
import { Utils } from 'src/app/utils/utils';

@Component({
  selector: 'app-orders',
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss'
})
export class OrdersComponent implements OnInit, OnDestroy {

  activeTab: "Daily" | "Subscribed";
  upcomingOrders: Array<any> = [];
  pastOrders: Array<any> = [];
  products: Array<Product> = [];
  subscribedProducts: Array<Product> = [];

  activeSubscriptions: Array<Product> = [];

  orderViewFlag: boolean = false;
  orderCancelFlag: boolean = false;
  itemCancelFlag: boolean = false;
  isCancelling: boolean = false;

  targetOrder: any = null;
  targetItemToCancel: any = null;
  targetItemOrder: any = null;

  toastNotification: { show: boolean, message: string, type: string } = { show: false, message: '', type: 'success' };

  subscriptionOrders: any = {};
  subscriptionOrdersLength: number = 0;

  expanded: boolean = false;
  copiedOrderId: string = '';

  constructor(
    public cartService: CartService,
    public orderService: OrderService,
    public loginService: LoginService,
    private utils: Utils
  ) {
  }

  showToast(message: string, type: 'success' | 'info' | 'error' = 'success') {
    this.toastNotification = { show: true, message, type };
    setTimeout(() => {
      this.toastNotification.show = false;
    }, 4500);
  }

  formatShortId(orderId: string): string {
    if (!orderId) return '';
    const parts = String(orderId).split('_');
    if (parts.length >= 3) {
      return '#' + parts[parts.length - 1];
    }
    if (orderId.length > 8) {
      return '#' + orderId.slice(-5);
    }
    return '#' + orderId;
  }

  safeDate(rawDate: any): Date {
    if (!rawDate || rawDate === "undefined" || rawDate === "null" || rawDate === "Invalid Date" || rawDate === "0000-00-00 00:00:00" || rawDate === "0000-00-00") {
      return new Date();
    }
    if (rawDate instanceof Date) {
      return isNaN(rawDate.getTime()) ? new Date() : rawDate;
    }
    const d = new Date(rawDate);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  onImgError(event: any) {
    if (event && event.target) {
      event.target.src = 'assets/orders/orders_veg.png';
    }
  }

  copyOrderId(id: string, event: MouseEvent) {
    event.stopPropagation();
    if (!id) return;
    navigator.clipboard?.writeText(id).then(() => {
      this.copiedOrderId = id;
      setTimeout(() => {
        if (this.copiedOrderId === id) {
          this.copiedOrderId = '';
        }
      }, 2000);
    });
  }

  shopNow() {
    this.cartService.router.navigate(['/products/category/Vegetables']);
  }

  getDeliveryModeText(mode: any): string {
    if (mode === undefined || mode === null || mode === '') return 'Leave at door';
    const sMode = String(mode).trim().toLowerCase();
    if (sMode === '0' || sMode.includes('door')) return 'Leave at door';
    if (sMode === '1' || sMode.includes('ring')) return 'Ring the bell';
    if (sMode === '2' || sMode.includes('hand')) return 'Hand it over to me';
    return String(mode);
  }

  getDeliveryModeIcon(mode: any): string {
    if (mode === undefined || mode === null || mode === '') return 'door_front';
    const sMode = String(mode).trim().toLowerCase();
    if (sMode === '0' || sMode.includes('door')) return 'door_front';
    if (sMode === '1' || sMode.includes('ring')) return 'notifications_active';
    if (sMode === '2' || sMode.includes('hand')) return 'pan_tool';
    return 'local_shipping';
  }

  getStatusBadge(status: string): { label: string, icon: string, class: string } {
    const s = String(status || '').toUpperCase();
    switch (s) {
      case 'PLACED':
        return { label: 'Order Placed', icon: 'inventory_2', class: 'status-placed' };
      case 'PACKED':
        return { label: 'Packed & Ready', icon: 'takeout_dining', class: 'status-packed' };
      case 'OUT_FOR_DELIVERY':
        return { label: 'Out for Delivery', icon: 'local_shipping', class: 'status-out' };
      case 'DELIVERED':
        return { label: 'Delivered', icon: 'check_circle', class: 'status-delivered' };
      case 'UNDELIVERED':
        return { label: 'Undelivered', icon: 'error_outline', class: 'status-undelivered' };
      case 'CANCELLED':
        return { label: 'Cancelled', icon: 'cancel', class: 'status-cancelled' };
      default:
        return { label: s || 'Active', icon: 'info', class: 'status-placed' };
    }
  }

  getDeliveryOptionBadge(option: string): { label: string, icon: string, class: string } {
    const opt = String(option || 'NEXT_DAY_7AM').toUpperCase();
    switch (opt) {
      case 'IMMEDIATE_10':
        return { label: '10 Mins Delivery', icon: 'bolt', class: 'opt-10m' };
      case 'IMMEDIATE_30':
        return { label: '30 Mins Delivery', icon: 'timer', class: 'opt-30m' };
      case 'IMMEDIATE_60':
        return { label: '60 Mins Delivery', icon: 'schedule', class: 'opt-60m' };
      case 'NEXT_DAY_7AM':
      default:
        return { label: 'Tomorrow 7:00 AM IST', icon: 'wb_twilight', class: 'opt-next-day' };
    }
  }

  getDeliveryEtaText(item: any): string {
    const opt = String(item?.delivery_option || 'NEXT_DAY_7AM').toUpperCase();
    if (opt.startsWith('IMMEDIATE_')) {
      if (item?.delivery_expected_at) {
        const d = this.safeDate(item.delivery_expected_at);
        let h = d.getHours();
        const m = String(d.getMinutes()).padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `Expected ~${h}:${m} ${ampm} IST`;
      }
      return 'Express delivery in progress';
    }
    return 'Scheduled 7:00 AM IST';
  }

  getOrderThumbnails(order: any): Array<{ img: string, name: string }> {
    if (!order) return [];
    if (order.products && Array.isArray(order.products) && order.products.length > 0) {
      return order.products.slice(0, 4).map(p => ({
        img: p.img_url || 'assets/orders/orders_veg.png',
        name: p.name || p.product_name || 'Product'
      }));
    }
    if (order.itemsList && Array.isArray(order.itemsList) && order.itemsList.length > 0) {
      return order.itemsList.slice(0, 4).map(p => ({
        img: p.img_url || 'assets/orders/orders_veg.png',
        name: p.product_name || p.name || 'Product'
      }));
    }
    if (order.items) {
      try {
        const raw = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        if (Array.isArray(raw) && raw.length > 0) {
          return raw.slice(0, 4).map((p: any) => ({
            img: p.img_url || 'assets/orders/orders_veg.png',
            name: p.product_name || p.name || 'Product'
          }));
        }
      } catch (e) {}
    }
    return [];
  }

  getOrderItemsCount(order: any): number {
    if (!order) return 1;
    if (order.items_count !== undefined && Number(order.items_count) > 0) {
      return Number(order.items_count);
    }
    if (order.products && Array.isArray(order.products) && order.products.length > 0) {
      return order.products.length;
    }
    if (order.itemsList && Array.isArray(order.itemsList) && order.itemsList.length > 0) {
      return order.itemsList.length;
    }
    return 1;
  }

  isSubscriptionProduct(pro: any): boolean {
    if (!pro) return false;
    if (pro.is_subscription !== undefined) return !!pro.is_subscription;

    const type = String(pro.subscriptionType || pro.subscription_type || '').trim().toLowerCase();
    if (type === 'range' || type === 'multi_day' || type === 'daily' || type === 'subscribed') {
      return true;
    }

    const checkDates = (d: any): boolean => {
      if (!d || d === '[]' || d === 'undefined' || d === 'null' || d === '') return false;
      if (Array.isArray(d)) return d.length > 0;
      if (typeof d === 'string') {
        try {
          const parsed = JSON.parse(d);
          return Array.isArray(parsed) && parsed.length > 0;
        } catch {
          return false;
        }
      }
      return false;
    };
    console.log("isSubscriptionProduct", checkDates(pro.rangeDates) || checkDates(pro.subscribedDates));

    return checkDates(pro.rangeDates) || checkDates(pro.subscribedDates);
  }

  getItemDaysCount(pro: any): number {
    if (!pro) return 1;
    try {
      let dates = [];
      if (pro.rangeDates && pro.rangeDates !== '[]' && pro.rangeDates !== 'undefined' && pro.rangeDates !== 'null') {
        dates = typeof pro.rangeDates === 'string' ? JSON.parse(pro.rangeDates) : pro.rangeDates;
      } else if (pro.subscribedDates && pro.subscribedDates !== '[]' && pro.subscribedDates !== 'undefined' && pro.subscribedDates !== 'null') {
        dates = typeof pro.subscribedDates === 'string' ? JSON.parse(pro.subscribedDates) : pro.subscribedDates;
      }
      return (Array.isArray(dates) && dates.length > 0) ? dates.length : 1;
    } catch (e) {
      return 1;
    }
  }

  getItemTotalQty(pro: any): number {
    if (!pro) return 1;
    try {
      let dates = [];
      if (pro.rangeDates && pro.rangeDates !== '[]' && pro.rangeDates !== 'undefined' && pro.rangeDates !== 'null') {
        dates = typeof pro.rangeDates === 'string' ? JSON.parse(pro.rangeDates) : pro.rangeDates;
      } else if (pro.subscribedDates && pro.subscribedDates !== '[]' && pro.subscribedDates !== 'undefined' && pro.subscribedDates !== 'null') {
        dates = typeof pro.subscribedDates === 'string' ? JSON.parse(pro.subscribedDates) : pro.subscribedDates;
      }
      if (Array.isArray(dates) && dates.length > 0) {
        let total = 0;
        dates.forEach((d: any) => {
          total += (typeof d === 'object' && d.count) ? Number(d.count) : 1;
        });
        return total;
      }
      return Number(pro.quantity || pro.units || 1);
    } catch (e) {
      return Number(pro.quantity || pro.units || 1);
    }
  }

  getItemTotalPrice(pro: any): number {
    if (!pro) return 0;
    const rawPrice = Number(pro.price || 0);
    if (rawPrice > 0) {
      return rawPrice;
    }
    const qty = Number(pro.units || pro.quantity || 1);
    const unitPrice = Number(pro.unit_price || 0);
    const days = this.isSubscriptionProduct(pro) ? this.getItemDaysCount(pro) : 1;
    return unitPrice * qty * days;
  }

  getItemUnitPrice(pro: any): number {
    if (!pro) return 0;
    const qty = Number(pro.units || pro.quantity || 1);
    const days = this.isSubscriptionProduct(pro) ? this.getItemDaysCount(pro) : 1;
    const totalUnits = qty * days;
    const rawPrice = Number(pro.price || 0);
    if (rawPrice > 0 && totalUnits > 0) {
      return rawPrice / totalUnits;
    }
    return Number(pro.unit_price || pro.price || 0);
  }

  ngOnInit(): void {
    this.orderService.getOrders();
    this.cartService.headerChangeEvent.next("type5");
    this.openTab(null, "Daily");

    this.orderService.ordersEvent.subscribe((res: Array<any>) => {
      if (res && Array.isArray(res)) {
        res.forEach((item) => {
          if (!item.processed) {
            item.created_at = this.safeDate(item.created_at);
            let parsedDelivery = this.safeDate(item.delivery_date);
            const createdDay = new Date(item.created_at.getFullYear(), item.created_at.getMonth(), item.created_at.getDate()).getTime();
            const deliveryDay = new Date(parsedDelivery.getFullYear(), parsedDelivery.getMonth(), parsedDelivery.getDate()).getTime();

            if (!item.delivery_date || item.delivery_date === "0000-00-00" || item.delivery_date === "0000-00-00 00:00:00" || deliveryDay <= createdDay) {
              let delD = new Date(item.created_at);
              delD.setDate(delD.getDate() + 1);
              item.delivery_date = delD;
            } else {
              item.delivery_date = parsedDelivery;
            }
            item.delivered_at = this.safeDate(item.delivered_at || item.delivery_date);
            item.order_total = item.total_amount || item.order_total || 0;
            try {
              let addrStr = item.address_json || item.address;
              let addr = typeof addrStr === 'string' ? JSON.parse(addrStr) : addrStr;
              item.address = addr ? `${addr.name || ''}, ${addr.addr_line_1 || addr.address || ''}, ${addr.pincode || ''}` : '';
            } catch (e) {
              item.address = '';
            }
            item.processed = true;
          }
        });

        this.upcomingOrders = res.filter((item) => { return item.status == 'PLACED' || item.status == 'PACKED' || item.status == 'OUT_FOR_DELIVERY' });
        this.pastOrders = res.filter((item) => { return (item.status == 'DELIVERED' || item.status == 'UNDELIVERED' || item.status == 'CANCELLED') });
        console.log(this.upcomingOrders);
      }
    });

    //recieve individual orders
    this.orderService.orderIndividualEvent.subscribe((res: any) => {
      // this.orderViewFlag = true;
      // this.products = [];
      // this.subscribedProducts = [];
      // this.activeSubscriptions = [];

      // res.live.forEach(item => {
      //   item.units = res.products[item.id].quantity;
      //   item.price = res.products[item.id].price;
      //   if (res.products[item.id].rangeDates.length > 0 || res.products[item.id].subscribedDates.length > 0) {
      //     item = { ...item, ...res.products[item.id] };
      //     this.subscribedProducts.push(item);

      //     //this should be filtered based on the dates          
      //     // this.activeSubscriptions.push(item);
      //   } else {
      //     this.products.push(item);
      //   }
      // });

      // this.subscriptionOrders[res.orderId] = this.activeSubscriptions;
    });

    this.orderService.orderCancelEvent.subscribe((res: any) => {
      this.orderCancelFlag = false;
    });

    this.orderService.getActiveSubscriptions().subscribe({
      next: (data) => {
        if (data && data.constructor.name === "Array") {
          data.forEach(order => {
            if (!this.subscriptionOrders[order.orderID]) this.subscriptionOrders[order.orderID] = [];
            this.subscriptionOrders[order.orderID].push(order);
          });
          this.subscriptionOrdersLength = Object.keys(this.subscriptionOrders).length;
        }
        if (this.cartService.editSubsPaymentTrack) {
          this.openTab(null, "Subscribed");
        }
      },
      error: (err: Error) => {
        alert("Active subcription read error!");
      }
    });

  }

  openTab(evt: any, target: "Daily" | "Subscribed") {
    this.activeTab = target;
    document.querySelector("#Daily")['style'].display = "none";
    document.querySelector("#Subscribed")['style'].display = "none";
    document.querySelector("#" + target)['style'].display = "block";
  }

  orderCancelAction(order: any) {
    this.targetOrder = order;
    this.orderCancelFlag = true;
  }

  orderViewAction(order: any) {
    order.expanded = !order.expanded;
    if (!order.expanded) return;

    if (order.products && order.products.length > 0) return;

    this.orderService.getIndividualOrder(order).subscribe({
      next: (res: any) => {
        const itemsList: Array<any> = Array.isArray(res) ? res : (res && Array.isArray(res.items) ? res.items : []);
        itemsList.forEach((pro: any) => {
          pro.is_subscription = this.isSubscriptionProduct(pro);
        });
        order.itemsList = itemsList;
        order.is_subscription = itemsList.some((pro: any) => pro.is_subscription);

        if (itemsList && itemsList.length > 0) {
          let products_id = itemsList.map((product) => { return product.productID || product.product_id; });

          let productsMap: any = {};
          for (let product of itemsList) {
            const pId = product.productID || product.product_id;
            productsMap[pId] = {
              order_item_id: product.id,
              product_id: pId,
              productID: pId,
              quantity: product.quantity,
              price: product.price,
              weight: product.weight,
              product_name: product.product_name,
              img_url: product.img_url,
              subscriptionType: product.subscriptionType,
              is_subscription: product.is_subscription,
              item_status: product.item_status || 'active',
              subsStatus: product.subsStatus || 'active',
              refund_amount: product.refund_amount || 0,
              rangeDates: (product.rangeDates && product.rangeDates != "undefined") ? (typeof product.rangeDates === 'string' ? JSON.parse(product.rangeDates) : product.rangeDates) : [],
              subscribedDates: (product.subscribedDates && product.subscribedDates != "undefined") ? (typeof product.subscribedDates === 'string' ? JSON.parse(product.subscribedDates) : product.subscribedDates) : []
            };
          }

          this.orderService.getMultipleProducts(products_id).subscribe({
            next: (prodRes: any) => {
              const liveProducts = [];
              if (prodRes && prodRes.live) {
                prodRes.live.forEach(item => {
                  const pData = productsMap[item.id] || {};
                  item.order_item_id = pData.order_item_id;
                  item.product_id = item.id;
                  item.productID = item.id;
                  item.units = pData.quantity || 1;
                  item.price = pData.price || item.price;
                  item.name = item.name || pData.product_name || 'Product Item';
                  item.img_url = item.img_url || pData.img_url;
                  item.is_subscription = (pData.is_subscription !== undefined) ? pData.is_subscription : false;
                  item.item_status = pData.item_status || 'active';
                  item.subsStatus = pData.subsStatus || 'active';
                  liveProducts.push({ ...item, ...pData });
                });
              }
              order.products = liveProducts.length > 0 ? liveProducts : itemsList;
              this.products = order.products;

              if (!order.order_total || order.order_total === 0) {
                let calcTotal = 0;
                order.products.forEach((p: any) => {
                  calcTotal += this.getItemTotalPrice(p);
                });
                if (calcTotal > 0) {
                  order.order_total = calcTotal;
                }
              }
            },
            error: () => {
              order.products = itemsList;
              if (!order.order_total || order.order_total === 0) {
                let calcTotal = 0;
                order.products.forEach((p: any) => {
                  calcTotal += this.getItemTotalPrice(p);
                });
                if (calcTotal > 0) {
                  order.order_total = calcTotal;
                }
              }
            }
          });
        } else {
          order.products = [];
        }
      },
      error: (err: Error) => {
        alert("Order history read error!");
      }
    });
  }

  orderCancelConfirmAction() {
    if (!this.targetOrder) return;
    this.isCancelling = true;

    this.orderService.cancelOrder(this.targetOrder).subscribe({
      next: (res: any) => {
        this.isCancelling = false;
        this.orderCancelFlag = false;

        const isSuccess = res === 'SUCCESS' || res?.status === 'SUCCESS';
        if (isSuccess) {
          this.targetOrder.status = 'CANCELLED';
          if (res?.refund_amount > 0) {
            this.targetOrder.refund_amount = res.refund_amount;
            this.loginService.readWallet();
            this.showToast(`Order cancelled. ₹${res.refund_amount} has been refunded to your wallet!`, 'success');
          } else {
            const codMsg = this.targetOrder.payment_type === 'COD' 
              ? 'Order cancelled. Since this was COD, no wallet refund was needed.' 
              : 'Order cancelled successfully.';
            this.showToast(codMsg, 'info');
          }

          // Move order from upcomingOrders to pastOrders
          this.upcomingOrders = this.upcomingOrders.filter(o => o.order_id !== this.targetOrder.order_id);
          if (!this.pastOrders.some(o => o.order_id === this.targetOrder.order_id)) {
            this.pastOrders.unshift(this.targetOrder);
          }
        } else {
          this.showToast(res?.error || 'Unable to cancel order.', 'error');
        }
      },
      error: (err: any) => {
        this.isCancelling = false;
        this.orderCancelFlag = false;
        this.showToast(err?.error?.error || 'Error cancelling order.', 'error');
      }
    });
  }

  promptCancelItem(order: any, item: any, event: MouseEvent) {
    event.stopPropagation();
    this.targetItemOrder = order;
    this.targetItemToCancel = item;
    this.itemCancelFlag = true;
  }

  confirmCancelItem() {
    if (!this.targetItemOrder || !this.targetItemToCancel) return;
    this.isCancelling = true;

    this.orderService.cancelOrderItem(this.targetItemOrder.order_id, this.targetItemToCancel).subscribe({
      next: (res: any) => {
        this.isCancelling = false;
        this.itemCancelFlag = false;

        if (res && res.status === 'SUCCESS') {
          this.targetItemToCancel.item_status = 'cancelled';
          this.targetItemToCancel.subsStatus = 'cancelled';

          if (res.new_order_total !== undefined) {
            this.targetItemOrder.order_total = res.new_order_total;
          }
          if (res.order_status) {
            this.targetItemOrder.status = res.order_status;
            if (res.order_status === 'CANCELLED') {
              this.upcomingOrders = this.upcomingOrders.filter(o => o.order_id !== this.targetItemOrder.order_id);
              if (!this.pastOrders.some(o => o.order_id === this.targetItemOrder.order_id)) {
                this.pastOrders.unshift(this.targetItemOrder);
              }
            }
          }

          if (res.refund_amount > 0) {
            this.targetItemOrder.refund_amount = (this.targetItemOrder.refund_amount || 0) + res.refund_amount;
            this.loginService.readWallet();
            this.showToast(`Item cancelled. ₹${res.refund_amount} refunded to your wallet!`, 'success');
          } else {
            const itemMsg = this.targetItemOrder.payment_type === 'COD'
              ? `Item cancelled. Order total payable on delivery updated to ₹${res.new_order_total || this.targetItemOrder.order_total}.`
              : 'Item cancelled successfully.';
            this.showToast(itemMsg, 'info');
          }
        } else {
          this.showToast(res?.error || 'Unable to cancel item.', 'error');
        }
      },
      error: (err: any) => {
        this.isCancelling = false;
        this.itemCancelFlag = false;
        this.showToast(err?.error?.error || 'Error cancelling item.', 'error');
      }
    });
  }

  alertClose() {
    this.orderCancelFlag = false;
    this.itemCancelFlag = false;
    this.orderViewFlag = false;
    this.targetOrder = null;
    this.targetItemToCancel = null;
    this.targetItemOrder = null;
  }

  pastOrderViewAction(order: any) {
    this.orderViewAction(order);
  }

  orderAgainAction(order: any) {
    this.orderService.orderAgain(order);
  }

  expandedAction(item: any) {
    this.expanded = !this.expanded;
  }

  ngOnDestroy(): void {
  }
}

