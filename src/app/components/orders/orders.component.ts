import { Component, OnDestroy, OnInit } from '@angular/core';
import { CartService } from 'src/app/services/cart.service';
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

  targetOrder: any;

  subscriptionOrders: any = {};
  subscriptionOrdersLength: number = 0;

  expanded: boolean = false;
  testC: string = "dgrt\n<b>rtwertre</b>\nfdgsdfg\nfdgfgd\nfdgfdgsdf\n\nsdsadfdsf\n";

  constructor(
    private cartService: CartService,
    public orderService: OrderService,
    private utils: Utils
  ) {
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

  getDeliveryModeText(mode: any): string {
    if (mode === undefined || mode === null || mode === '') return 'Leave at door';
    const sMode = String(mode).trim().toLowerCase();
    if (sMode === '0' || sMode.includes('door')) return 'Leave at door';
    if (sMode === '1' || sMode.includes('ring')) return 'Ring the bell';
    if (sMode === '2' || sMode.includes('hand')) return 'Hand it over to me';
    return String(mode);
  }

  isSubscriptionProduct(pro: any): boolean {
    if (!pro) return false;
    const type = String(pro.subscriptionType || pro.subscription_type || '').toLowerCase();
    if (type && type !== 'none' && type !== 'undefined' && type !== 'null') return true;

    const hasRange = pro.rangeDates && pro.rangeDates !== '[]' && pro.rangeDates !== 'undefined' && pro.rangeDates !== 'null' && pro.rangeDates !== '';
    const hasSubs = pro.subscribedDates && pro.subscribedDates !== '[]' && pro.subscribedDates !== 'undefined' && pro.subscribedDates !== 'null' && pro.subscribedDates !== '';
    return !!(hasRange || hasSubs);
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
    const qty = Number(pro.units || pro.quantity || 1);
    const rawPrice = Number(pro.price || 0);
    const unitPrice = Number(pro.unit_price || (pro.price && !this.isSubscriptionProduct(pro) ? pro.price : (rawPrice > 0 && this.getItemDaysCount(pro) > 1 ? rawPrice / (qty * this.getItemDaysCount(pro)) : rawPrice)));
    const days = this.isSubscriptionProduct(pro) ? this.getItemDaysCount(pro) : 1;

    if (this.isSubscriptionProduct(pro) && days > 1) {
      if (rawPrice > 0 && rawPrice > unitPrice * qty) {
        return rawPrice;
      }
      return (unitPrice > 0 ? unitPrice : rawPrice) * qty * days;
    }
    return rawPrice > 0 ? rawPrice * qty : unitPrice * qty;
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

        this.upcomingOrders = res.filter((item) => { return item.status == 'PLACED' });
        this.pastOrders = res.filter((item) => { return (item.status == 'DELIVERED' || item.status == 'CANCELLED') });
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
    this.utils.css(".orders-cont", { height: '90vh', overflowY: 'hidden' });
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
        order.itemsList = itemsList;

        if (itemsList.some((pro: any) => this.isSubscriptionProduct(pro))) {
          order.is_subscription = true;
        }

        if (itemsList && itemsList.length > 0) {
          let products_id = itemsList.map((product) => { return product.productID || product.product_id; });

          let productsMap: any = {};
          for (let product of itemsList) {
            const pId = product.productID || product.product_id;
            productsMap[pId] = {
              quantity: product.quantity,
              price: product.price,
              weight: product.weight,
              product_name: product.product_name,
              img_url: product.img_url,
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
                  item.units = pData.quantity || 1;
                  item.price = pData.price || item.price;
                  item.name = item.name || pData.product_name || 'Product Item';
                  item.img_url = item.img_url || pData.img_url;
                  liveProducts.push({ ...item, ...pData });
                });
              }
              order.products = liveProducts.length > 0 ? liveProducts : itemsList;
              this.products = order.products;

              let calcTotal = 0;
              order.products.forEach((p: any) => {
                calcTotal += this.getItemTotalPrice(p);
              });
              if (calcTotal > 0) {
                order.order_total = calcTotal;
              }
            },
            error: () => {
              order.products = itemsList;
              let calcTotal = 0;
              order.products.forEach((p: any) => {
                calcTotal += this.getItemTotalPrice(p);
              });
              if (calcTotal > 0) {
                order.order_total = calcTotal;
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
    this.orderService.cancelOrder(this.targetOrder);
  }

  alertClose() {
    this.orderCancelFlag = false;
    this.orderViewFlag = false;
    this.utils.css(".orders-cont", { height: 'auto', overflowY: 'auto' });
  }

  pastOrderViewAction(order: any) {
    this.utils.css(".orders-cont", { height: '90vh', overflowY: 'hidden' });
    this.orderService.getIndividualOrder(order);
  }

  orderAgainAction(order: any) {
    this.utils.css(".orders-cont", { height: '90vh', overflowY: 'hidden' });
    this.orderService.orderAgain(order);
  }

  expandedAction(item: any) {
    this.expanded = !this.expanded;
  }

  ngOnDestroy(): void {
  }
}

