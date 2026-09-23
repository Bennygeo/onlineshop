import { Component, OnInit } from '@angular/core';
import { CartService } from 'src/app/services/cart.service';

@Component({
  selector: 'app-support',
  templateUrl: './support.component.html',
  styleUrls: ['./support.component.scss']
})
export class SupportComponent implements OnInit {

  mobile: string = "+919876543210";
  displayMobile: string = "+91 98765 43210";
  message: string = 'Hi TomorrowNeeds Team! I need some assistance regarding my order / account.';
  whatsappLink: string;
  email: string = "hey@tomorrowneeds.in";
  mailto: string;
  callLink: string;

  constructor(private cartS: CartService) {
    this.cartS.headerChangeEvent.next("type2");

    const cleanPhone = this.mobile.replace('+', '');
    this.whatsappLink = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(this.message)}`;
    this.mailto = `mailto:${this.email}?subject=${encodeURIComponent('Support Request - TomorrowNeeds')}`;
    this.callLink = `tel:${this.mobile}`;
  }

  ngOnInit(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

}
