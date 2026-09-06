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

  referralId: string = '';
  shareFlg: boolean = false;
  
  copiedCodeToast: boolean = false;
  copiedLinkToast: boolean = false;

  // Referral metrics (can be dynamic or preset defaults)
  rewardAmount: number = 100;
  discountPct: number = 25;
  friendsJoined: number = 0;
  totalEarned: number = 0;

  constructor(
    private cartS: CartService,
    private loginS: LoginService,
    public sanitizer: DomSanitizer,
  ) {
    this.cartS.headerChangeEvent.next("type4");
    this.referralId = this.loginS.user?.referralId || '';
    if (!this.referralId || this.referralId === "XXXXXX") {
      this.loginS.readUser().subscribe((res: any) => {
        if (res && res.length > 0) {
          this.referralId = res[0].referral_id || res[0].referralId || 'THINK' + Math.floor(100000 + Math.random() * 900000);
        } else {
          this.referralId = 'THINK' + (this.loginS.user?.mobile ? this.loginS.user.mobile.slice(-4) : 'SPOT');
        }
      });
    }
  }

  getShareMessage(): string {
    const mobile = this.loginS.user?.mobile || '';
    const code = this.referralId || '';
    const repoUrl = `http://thinkspot.in/?mobile=${mobile}&id=${code}&type=WELCOME`;
    return `Hey! Join me on Thinkspot for 100% fresh, natural food & daily essentials delivered right to your doorstep. 🥬🍏\n\n🎁 Get ${this.discountPct}% CASHBACK on your first order when you sign up with my code: *${code}*\n\nDownload now: ${repoUrl}`;
  }

  getReferralLink(): string {
    const mobile = this.loginS.user?.mobile || '';
    const code = this.referralId || '';
    return `http://thinkspot.in/?mobile=${mobile}&id=${code}&type=WELCOME`;
  }

  copyCode(): void {
    if (!this.referralId) return;
    this.copyToClipboard(this.referralId);
    this.copiedCodeToast = true;
    setTimeout(() => {
      this.copiedCodeToast = false;
    }, 2500);
  }

  copyLink(): void {
    const link = this.getReferralLink();
    this.copyToClipboard(link);
    this.copiedLinkToast = true;
    setTimeout(() => {
      this.copiedLinkToast = false;
    }, 2500);
  }

  private copyToClipboard(text: string): void {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => this.fallbackCopy(text));
    } else {
      this.fallbackCopy(text);
    }
  }

  private fallbackCopy(text: string): void {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
    } catch (e) {}
    document.body.removeChild(textarea);
  }

  shareWhatsApp(): void {
    const message = encodeURIComponent(this.getShareMessage());
    const whatsappUrl = `https://api.whatsapp.com/send?text=${message}`;
    window.open(whatsappUrl, '_blank');
  }

  shareNative(): void {
    const shareData = {
      title: 'Thinkspot Fresh Foods - Referral',
      text: this.getShareMessage(),
      url: this.getReferralLink()
    };

    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else {
      this.shareAction();
    }
  }

  shareAction(): void {
    this.shareFlg = true;

    const mobile = this.loginS.user?.mobile || '';
    const referralId = this.referralId;

    const repoUrl = `http://thinkspot.in/?mobile=${mobile}&id=${referralId}&type=WELCOME`;
    const params = `?id=${referralId}&type=WELCOME`;
    this.url = `./assets/iframe/index.html${params}`;
    this.urlSafe = this.sanitizer.bypassSecurityTrustResourceUrl(this.url);

    const shareText = this.getShareMessage();

    if (window['webkit'] && window['webkit'].messageHandlers && window['webkit'].messageHandlers.shareHandler) {
      window['webkit'].messageHandlers.shareHandler.postMessage(
        JSON.stringify({ html: shareText })
      );
    } else if (window["Android"] && window["Android"].showToast) {
      window["Android"].showToast(
        JSON.stringify({ html: shareText })
      );
    } else if (!navigator.share) {
      this.shareWhatsApp();
    }
  }
}

