import { Component } from '@angular/core';
import { CartService } from 'src/app/services/cart.service';

@Component({
  selector: 'app-support',
  templateUrl: './support.component.html',
  styleUrls: ['./support.component.scss']
})
export class SupportComponent {

  mobile: string = "+917200015551";
  message: string = 'Hi there!';
  whatsappLink: string;
  mailto: string = "mailto:hey@thinkspot.in";

  constructor(private cartS: CartService) {
    this.cartS.headerChangeEvent.next("type2");

    this.whatsappLink = `whatsapp://send?phone=${this.mobile}&text=${this.message}`;
  }



}
