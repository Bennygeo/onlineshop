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

  ngOnInit(): void {
    this.orderService.getOrders();
    this.cartService.headerChangeEvent.next("type5");
    this.openTab(null, "Daily");

    this.orderService.ordersEvent.subscribe((res: Array<any>) => {
      if (res && res.constructor.name === "Array") {
        this.upcomingOrders = res.filter((item) => { return item.status == 'PLACED' });
        this.pastOrders = res.filter((item) => { return (item.status == 'DELIVERED' || item.status == 'CANCELLED') });
        this.upcomingOrders.map((item) => {
          if (!item.processed) {
            item.delivery_date = new Date(item.delivery_date);
            let addr = JSON.parse(item.address);
            item.address = `${addr.name}, ${addr.addr_line_1}, ${addr.pincode}`;
            item.processed = true;
          }
        });
        this.pastOrders.map((item) => {
          if (!item.processed) {
            item.delivered_at = new Date(item.delivered_at);
            let addr = JSON.parse(item.address);
            item.address = `${addr.name}, ${addr.addr_line_1}, ${addr.pincode}`;
            item.processed = true;
          }
        });
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
    //to avoid the background scroll
    this.utils.css(".orders-cont", { height: '90vh', overflowY: 'hidden' });

    order.expanded = !order.expanded;

    if(!order.expanded) return;

    let products = {};
    this.orderService.getIndividualOrder(order).subscribe({
      next: (res: any) => {
        if (res !== "NOT_FOUND") {
          let products_id = res.map((product) => { return product.productID });

          products = {};
          for (let product of res) {
            products[product.productID] = {
              quantity: product.quantity,
              price: product.price,
              weight: product.weight,
              rangeDates: (product.rangeDates != "undefined") ? JSON.parse(product.rangeDates) : [],
              subscribedDates: (product.subscribedDates != "undefined") ? JSON.parse(product.subscribedDates) : []
            }
          }

          this.orderService.getMultipleProducts(products_id).subscribe(res => {
            //     this.orderIndividualEvent.next({ live: res.live, products: products, orderId: orderId });
            // this.orderViewFlag = true;
            this.products = [];
            this.subscribedProducts = [];
            this.activeSubscriptions = [];
            res.live.forEach(item => {
              item.units = products[item.id].quantity;
              item.price = products[item.id].price;
              if (products[item.id].rangeDates.length > 0 || products[item.id].subscribedDates.length > 0) {
                item = { ...item, ...products[item.id] };
                this.subscribedProducts.push(item);

                //this should be filtered based on the dates          
                // this.activeSubscriptions.push(item);
              } else {
                this.products.push(item);
              }
            });
          });
        } else {
          this.orderService.getMultipleProducts([]);
        }
        this.expanded = true;
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

