import { Component } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CartService } from 'src/app/services/cart.service';
import { LoginService } from 'src/app/services/login.service';

@Component({
  selector: 'app-refer',
  templateUrl: './refer.component.html',
  styleUrls: ['./refer.component.scss']
})
export class ReferComponent {

  urlSafe: SafeResourceUrl;
  url: string = "./assets/iframe/index.html";

  referralId: string;
  shareFlg: boolean = false;

  constructor(
    private cartS: CartService,
    private loginS: LoginService,
    public sanitizer: DomSanitizer,
  ) {
    this.cartS.headerChangeEvent.next("type4");
    this.referralId = this.loginS.user.referralId;
    if (this.referralId == "XXXXXX") {
      this.loginS.readUser().subscribe((res: any) => {
        if (res.length > 0) {
          this.referralId = res[0].referral_id;
        } else {
          alert("Referral ID not found! \n\nPlease contact your admin.");
        }
      });
    }
  }

  shareAction() {
    this.shareFlg = true;

    const mobile = this.loginS.user.mobile;
    const referralId = this.loginS.user.referralId;

    let repoUrl = `http://thinkspot.in/?mobile=${mobile}&id=${referralId}&type=WELCOME`;
    let params = `?id=${referralId}&type=WELCOME`
    this.url = `${this.url}${params}`;
    this.urlSafe = this.sanitizer.bypassSecurityTrustResourceUrl(this.url);

    if (window['webkit']) {
      let _data = "Hey, looking for a cool solution that delivers all your natural food needs absolutely fresh.\n\nAnd here's more; get 5% off on your next 5 purchases of vegetables.\n\nDownload the app: https://play.google.com/store/apps/details?id=com.think.thinkspot \n\nUse code: " + referralId + "\n\n(or)\n\n" + repoUrl;
      window['webkit'].messageHandlers.shareHandler.postMessage(
        JSON.stringify({
          html: _data
        }));
    } else if (window["Android"]) {
      let _data = "Hey, looking for a cool solution that delivers all your natural food needs absolutely fresh.\n\nAnd here's more; get 5% off on your next 5 purchases of vegetables.\n\nDownload the app: https://play.google.com/store/apps/details?id=com.think.thinkspot \n\nUse code: " + referralId + "\n\n(or)\n\n" + repoUrl;

      window["Android"].showToast(
        JSON.stringify({
          html: _data
        })
      );
    }
  }
}
