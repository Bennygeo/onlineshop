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

  constructor(
    private cartS: CartService,
  ) { }

  deleteItem(evt: MouseEvent) {

    let el = document.getElementById(`cart_${this.index}`);
    let interval, el_height = Number(el.offsetHeight), int_cnt = el_height;

    interval = window.setInterval(() => {
      el.style.opacity = String(int_cnt / 100);

      int_cnt -= 2;
      if (int_cnt < 0) {
        el.style.padding = "0px";
        el.style.height = (((int_cnt + 100) / el_height) * el_height) + "px";
        el.style.marginBottom = String((((int_cnt + 100) / el_height) * 6)) + "px";

        if (int_cnt < -100) {
          el.style.height = "0px";
          el.style.marginTop = "0px";
          el.style.marginBottom = "0px";
          el.style.display = "none";

          window.clearInterval(interval);
          this.plusMinusAction(0);
        }
      }
    }, 2);
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

  viewDates(evt): void {
    this.viewDatesFlg = true;
  }

  viewDatesCloseAction(evt): void {
    this.viewDatesFlg = false;
  }
}
