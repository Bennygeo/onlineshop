import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd } from '@angular/router';
import { CartService } from './services/cart.service';
import { CartDetails, PopupType } from './utils/types';
import { Common } from './modal/Common';
import { LoginService } from './services/login.service';
import { Utils } from './utils/utils';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  loadingFlg: boolean = false;
  test:string="trt";

  cart_details: CartDetails = {
    total: 0,
    totalItems: 0
  };
  //Decide the cart vivibility flag variable
  cartBarVisibilityFlg: boolean = true;

  bottombarClass: string = "";
  popupItem: PopupType;
  isMobile: boolean = false;


  constructor(
    public loginS: LoginService,
    public cartS: CartService,
    private activatedRoute: ActivatedRoute,
    private utils: Utils
  ) {

    this.loginS.popupEvent.subscribe((res: PopupType) => {
      this.popupItem = res;
    });

    this.loginS.loginChangeEvent.subscribe((res: any) => {
      if (res === Common.loginStatus.LOGIN) {
        this.cartS.notifyCartEvent.subscribe(() => {
          this.cart_details = this.cartS.cartDetails;
        });
      }
    });

    this.activatedRoute.queryParams.subscribe(res => {
      this.loginS.queryParams = res;
    });

    this.cartS.router.events.subscribe((res) => {
      if (res instanceof NavigationEnd) {

        const url = this.cartS.router.url.split("?")[0];
        if (url === "/home/view") {
          this.bottombarClass = "type1";
        } else if (url.search("/products/category/") != 1) {
          this.bottombarClass = "type2";
        }

        if (url == "/home")
          this.cartS.router.navigate(["home/view"], this.loginS.queryParams);
      }
    });


    window.addEventListener("load", function () {
      setTimeout(function () {
        // This hides the address bar:
        window.scrollTo(0, 1);
      }, 1000);
    });
  }

  alertClose() {
    this.loginS.popupEvent.next({ flag: false, msg: "" });
  }

  ngOnInit(): void {
    this.cartS.windowSize$.subscribe(res => {
      if (res.width >= 550 || !this.utils.isMobile) {
        this.cartS.router.navigate(['/web']);
        this.isMobile = false;
      } else if (this.utils.isMobile) {
        const url = this.cartS.router.url.split("?")[0];
        if (url == "/web") this.cartS.router.navigate(['/home/view']);
        this.isMobile = true;
      }
    });
  }
}
