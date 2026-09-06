import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedModule } from '../../shared/shared.module';

@Component({
  selector: 'app-web',
  standalone: true,
  imports: [CommonModule, SharedModule],
  templateUrl: './web.component.html',
  styleUrl: './web.component.scss'
})
export class WebComponent implements OnInit {
  currentUrl: string = '';
  qrCodeUrl: string = '';
  copiedToast: boolean = false;
  showDevToolsTip: boolean = false;

  ngOnInit(): void {
    let loadingEl = document.getElementById("loading");
    if (loadingEl) loadingEl.remove();

    this.currentUrl = window.location.origin || window.location.href;
    // Generate dynamic QR code targeting the main application home route
    const mobileHomeUrl = `${window.location.protocol}//${window.location.host}/home/view`;
    this.qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(mobileHomeUrl)}&color=0f4c3a&bgcolor=ffffff`;
  }

  copyLink(): void {
    const mobileHomeUrl = `${window.location.protocol}//${window.location.host}/home/view`;
    navigator.clipboard.writeText(mobileHomeUrl).then(() => {
      this.copiedToast = true;
      setTimeout(() => {
        this.copiedToast = false;
      }, 3000);
    }).catch(err => {
      // Fallback copy strategy
      const textarea = document.createElement('textarea');
      textarea.value = mobileHomeUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.copiedToast = true;
      setTimeout(() => {
        this.copiedToast = false;
      }, 3000);
    });
  }

  toggleDevToolsTip(): void {
    this.showDevToolsTip = !this.showDevToolsTip;
  }
}

