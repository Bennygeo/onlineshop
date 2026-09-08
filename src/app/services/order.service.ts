import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { LoginService } from './login.service';
import { Common } from '../modal/Common';
import { ApiService } from './api.service';
import { CartService } from './cart.service';

@Injectable({
  providedIn: 'root'
})
export class OrderService {

  ordersEvent: BehaviorSubject<any> = new BehaviorSubject<any>(undefined);
  orderIndividualEvent: Subject<any> = new Subject<any>();
  orderCancelEvent: Subject<any> = new Subject<any>();

  userID: string;
  subscriptionOrders: any = {};

  constructor(private loginS: LoginService,
    private apiS: ApiService,
    private cartS: CartService
  ) {

    this.loginS.loginChangeEvent.subscribe((res) => {
      if (res === Common.loginStatus.LOGIN) {
        this.userID = this.loginS.user.mobile;
      }
    });
    this.getOrders();
  }

  getOrders() {
    this.apiS.postApi("orders/order_history.php", { details: JSON.stringify({ mobile: this.loginS.user.mobile }) }).subscribe({
      next: (res: any) => {
        this.ordersEvent.next(res);
      },
      error: (err: Error) => {
        alert("Order history read error!");
      }
    });
  }

  orderAgain(details) {
    if (!details || !details.order_id) return;
    this.apiS.postApi("orders/read_individual_order.php", { details: JSON.stringify({ order_id: details.order_id, status: details.status }) }).subscribe({
      next: (res: any) => {
        const items = Array.isArray(res) ? res : (res && Array.isArray(res.items) ? res.items : []);
        if (items && items.length > 0) {
          let products_id = items.map((product) => { return product.productID || product.product_id; });

          let productsMap = {};
          for (let product of items) {
            const pid = product.productID || product.product_id;
            productsMap[pid] = {
              quantity: product.quantity || 1,
              price: product.price,
              weight: product.weight,
            };
          }

          this.apiS.postApi("products/download_multiple_products.php", {
            "data": JSON.stringify(products_id)
          }).subscribe({
            next: (prodRes: any) => {
              const liveList = prodRes && Array.isArray(prodRes.live) ? prodRes.live : (Array.isArray(prodRes) ? prodRes : []);
              if (liveList.length > 0) {
                liveList.forEach((product) => {
                  const qty = productsMap[product.id] ? productsMap[product.id].quantity : 1;
                  this.cartS.cartUpdateEvent.next({ cart: this.cartS.cartProducts, product: product, unit: qty });
                });
              } else {
                items.forEach((item) => {
                  const productObj: any = {
                    id: item.productID || item.product_id,
                    name: item.product_name || 'Product Item',
                    price: item.price,
                    weight: item.weight,
                    img_url: item.img_url || 'assets/categories/Thinkspot_veggiesIcon.png'
                  };
                  this.cartS.cartUpdateEvent.next({ cart: this.cartS.cartProducts, product: productObj, unit: item.quantity || 1 });
                });
              }
              this.cartS.router.navigate(["products/cart"]);
            },
            error: () => {
              items.forEach((item) => {
                const productObj: any = {
                  id: item.productID || item.product_id,
                  name: item.product_name || 'Product Item',
                  price: item.price,
                  weight: item.weight,
                  img_url: item.img_url || 'assets/categories/Thinkspot_veggiesIcon.png'
                };
                this.cartS.cartUpdateEvent.next({ cart: this.cartS.cartProducts, product: productObj, unit: item.quantity || 1 });
              });
              this.cartS.router.navigate(["products/cart"]);
            }
          });
        }
      },
      error: (err: Error) => {
        alert("Unable to fetch order details to reorder.");
      }
    });
  }

  getIndividualOrder(details): Observable<any> {
    return this.apiS.postApi("orders/read_individual_order.php", { details: JSON.stringify({ order_id: details.order_id, status: details.status }) });
  }

  getMultipleProducts(products_id): Observable<any> {
    // if (products_id.length == 0) {
    //   alert("Error! No items found!");
    //   return;
    // } else {
    // this.apiS.postApi("orders/download_order_products.php", {
    //   "data": JSON.stringify(products_id)
    // }).subscribe({
    //   next: (res: any) => {
    //     this.orderIndividualEvent.next({ live: res.live, products: products, orderId: orderId });
    //   },
    //   error: (err: Error) => {
    //     alert("Read product error!");
    //   }
    // });
    return this.apiS.postApi("orders/download_order_products.php", {
      "data": JSON.stringify(products_id)
    });
  }


  cancelOrder(order: any) {
    this.apiS.postApi("orders/cancel_order.php", {
      "data": JSON.stringify(order)
    }).subscribe({
      next: (res: any) => {
        this.orderCancelEvent.next(res);
      },
      error: (err: Error) => {
        alert("Read product error!");
      }
    });
  }

  getActiveSubscriptions(): Observable<any> {
    return this.apiS.postApi('orders/active_subs.php', { details: JSON.stringify({ mobile: this.userID }) });
  }

  updateSubscription(data): Observable<any> {
    return this.apiS.postApi('orders/update_subs.php', { details: JSON.stringify(data) });
  }

  pausePlay(data): Observable<any> {
    return this.apiS.postApi('orders/pause_play.php', { details: JSON.stringify(data) });
  }
}
