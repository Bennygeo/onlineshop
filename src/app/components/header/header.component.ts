import { Component, OnInit } from '@angular/core';
import { CartService } from 'src/app/services/cart.service';
import { LoginService } from 'src/app/services/login.service';
import { Location } from '@angular/common';
import { Common } from 'src/app/modal/Common';
import { User } from 'src/app/modals/user';
import { animate, style, transition, trigger } from '@angular/animations';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  animations: [
    trigger('translateEffect', [
      transition(':enter', [   // :enter is alias to 'void => *'
        style({ opacity: 1, transform: "translateY(5%)" }), //apply default styles before animation starts
        animate(
          "150ms",
          style({ opacity: 1, transform: "translateY(0)" })
        )
      ]),
      transition(':leave', [   // :leave is alias to '* => void'
        style({ opacity: 1, transform: "translateY(0%)" }), //apply default styles before animation starts
        animate(
          "100ms",
          style({ opacity: 1, transform: "translateY(5%)" })
        )
      ])
    ]),
    trigger('fadeOut', [
      transition(':leave', [   // :leave is alias to '* => void'
        animate("100ms", style({ opacity: 0 }))
      ])
    ])
  ]
})
export class HeaderComponent implements OnInit {

  type: string = "type1";

  //Check wether the page is scrolled or not
  isScrolled: boolean = false;
  mobile: number;
  logged_in_flg: boolean = true;
  address_flg: boolean = false;

  is_notifications_exist: boolean = false;

  support_email: string = "hey@thinkspot.in";

  //default pincode
  addressName: string = "600095";

  public user: User = new User();

  userName: string = "";

  addressFlg: boolean = false;

  loginFlg: boolean = false;

  menus: any = [
    {
      name: "My Orders",
      img_url: "assets/icons/Document.png",
      path: "/home/orders"
    },
    {
      name: "My Profile",
      img_url: "assets/icons/Profile.png",
      path: "/home/profile"
    },
    {
      name: "Delivery Address",
      img_url: "assets/icons/Location.png",
      path: "/home/address"
    },
    {
      name: "Wallet",
      img_url: "assets/icons/Wallet.png",
      path: "/home/wallet"
    },
    {
      name: "Contact Us",
      img_url: "assets/icons/Message.png",
      path: "/home/support"
    },
    {
      name: "Refer and Earn",
      img_url: "assets/icons/Refer.png",
      path: "/home/referral"
    },
    // },
    // {
    //   name: "Settings",
    //   img_url: "assets/icons/Message.png",
    //   path: "/home/wallet"
    // },
    {
      name: "Helps & FAQs",
      img_url: "assets/icons/Helps.png",
      path: "/home/policy"
    }
  ]

  constructor(
    private cartS: CartService,
    private loginS: LoginService,
    private location: Location) {

    //route the appropriate component
    this.loginS.loginChangeEvent.subscribe((res: string) => {
      if (res === Common.loginStatus.LOGIN) {
        this.logged_in_flg = true;
        this.address_flg = true;
        this.user = this.loginS.user;

        if (this.user.addresses.length > 0) {
          this.addressName = this.user.address?.title;
          this.userName = this.user.address?.name;
        } else {
          this.userName = "Thinkspot user";
          this.addressName = "600095";
          // this.addressFlg = true;

        }
      } else if (res === Common.loginStatus.LOGOUT) {
        this.logged_in_flg = false;
        this.address_flg = false;
        this.addressName = this.loginS.defaultPincode;

      }
    });


    this.loginS.addressChangeEvent.subscribe({
      next: () => {
        this.user = this.loginS.user;
        if (this.user.addresses.length > 0) {
          this.userName = this.user.address?.name;
          this.addressName = this.loginS.user.address?.title;
        } else {
          this.userName = "Thinkspot user";
          this.addressName = "600095";
          this.addressFlg = true;
        }
      },
      error: () => {
        alert("Address change error!");
      }
    });

    this.loginS.loginPromptEvent.subscribe((res: boolean) => {
      this.loginFlg = res;
    });

    this.loginS.headerAddressSelectionEvent.subscribe((res: boolean) => {
      if (res != undefined) {
        if (this.loginS.userStatus === Common.loginStatus.LOGIN) {
          this.addressFlg = res;
          // if (this.user.addresses.length === 0) this.loginS.noAddressEvent.next(true);
          // this.loginS.addressChangeEvent.next();
        } else {
          this.loginFlg = true;
          this.loginS.loginPromptEvent.next(true);
        }
      }
    });

    this.loginS.addressCloseEvent.subscribe((flg) => {
      if (flg) this.addressCloseAction();
    })


    this.cartS.headerChangeEvent.subscribe((res: string) => {
      this.type = res;
    });



    //if no address found in the id
    this.loginS.noAddressEvent.subscribe((res: boolean) => {
      if (res === true) {
        this.addressName = "600095";
        this.addressFlg = true;
      }
    });
  }

  ngOnInit(): void {
    this.loginS.addressChangeEvent.subscribe(res => {
      this.user = this.loginS.user;
    });

    let loadingEl = document.getElementById("loading");
    if (loadingEl)
      loadingEl.remove();
  }

  homeBtnClick() {
    this.cartS.router.navigate(["home/view"]);
  }

  profileAction() {
    if (this.logged_in_flg) {
      this.openNav();
    } else {
      this.loginS.loginPromptEvent.next(true);
    }
  }

  addressSelection() {
    this.loginS.headerAddressSelectionEvent.next(true);
  }

  menuClick() {
    this.closeNav();
  }

  backBtnAction() {
    this.location.back();
  }

  onSuccessfulLogin() {

  }

  searchChangeAction(evt: any): void {

  }

  clear_click_action(evt: any): void {

  }

  /* Set the width of the side navigation to 250px */
  openNav() {
    let nodeList = document.querySelectorAll("meta");
    nodeList.forEach(node => {
      if (node.name == 'theme-color') node.setAttribute("content", "#ffffff");
    });

    // document.getElementById("mySidenav").style.width = "320px";
    document.getElementById("mySidenav").style.left = "0px";
    document.getElementById("navbg").style.opacity = "0.4";
    document.getElementById("navbg").style.pointerEvents = "auto";
    document.getElementById("navbg").style.display = "block";
    // document.getElementById("viewCont").style.marginLeft = "220px";
    // document.getElementById("viewCont").style.borderRadius = "36px";
  }

  /* Set the width of the side navigation to 0 */
  closeNav() {
    let nodeList = document.querySelectorAll("meta");
    nodeList.forEach(node => {
      if (node.name == 'theme-color') node.setAttribute("content", "#30d2ad");
    });

    // document.getElementById("mySidenav").style.width = "0";
    document.getElementById("mySidenav").style.left = "-240px";
    document.getElementById("navbg").style.opacity = "0";
    document.getElementById("navbg").style.pointerEvents = "none";

    // document.getElementById("viewCont").style.marginLeft = "0px";
    // document.getElementById("viewCont").style.borderRadius = "0";
  }

  addressOutsideClickAction(evt: any) {
    if (evt.target.classList[0] == "popup_parent" || evt.target.classList[0] == "popup_cont") this.addressFlg = false;
  }

  addressCloseAction() {
    this.addressFlg = false;
  }

  searchChange(evt: any) {
    if (this.cartS.routeURL != "/products/search") this.cartS.router.navigate(['/products/search']);
    this.cartS.searchChangeEvent.next(evt.target.value);
  }

  logoutAction() {
    this.closeNav();
    this.loginS.logoutEvent.next();
  }

}
