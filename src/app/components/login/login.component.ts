import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { FormControl, Validators, FormGroupDirective, NgForm } from '@angular/forms';
import { ValidationsService } from '../../services/validations.service';
import { Utils } from '../../utils/utils';
import { environment } from '../../../environments/environment';
import { ApiService } from '../../services/api.service';
import { ErrorStateMatcher } from '@angular/material/core';
import { CartService } from 'src/app/services/cart.service';
import { LoginService } from 'src/app/services/login.service';
import { LocationService } from 'src/app/services/location.service';
import { GeoLocation } from 'src/app/modals/geo-location';
import { animate, style, transition, trigger } from '@angular/animations';
import { Common } from 'src/app/modal/Common';
import { StorageService } from 'src/app/services/storage.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  animations: [
    trigger('translateEffect', [
      transition(':enter', [   // :enter is alias to 'void => *'
        style({ opacity: 1, transform: "translateY(5%)" }), //apply default styles before animation starts
        animate(
          "100ms",
          style({ opacity: 1, transform: "translateY(0)" })
        )
      ]),
      transition(':leave', [   // :leave is alias to '* => void'
        style({ opacity: 0, transform: "translateY(0)" }), //apply default styles before animation starts
        animate(
          "100ms",
          style({ opacity: 0, transform: "translateY(5%)" })
        )
      ])
    ]),
    trigger('fadeInOut', [
      transition(':leave', [   // :leave is alias to '* => void'
        animate("0ms", style({ opacity: 0 }))
      ])
    ]),
    trigger('fadeOut', [
      transition(':leave', [   // :leave is alias to '* => void'
        animate("0ms", style({ opacity: 0 }))
      ])
    ])
  ]
})
export class LoginComponent implements OnInit, OnDestroy {

  matcher = new MyErrorStateMatcher();

  pincodeFormControl = new FormControl('', [
    Validators.required,
    ValidationsService.checkLimit(100000, 999999),
    Validators.pattern(/^[0-9]{6}$/)
  ]);

  mobileFormControl = new FormControl('', [
    Validators.required,
    ValidationsService.checkLimit(5000000000, 9999999999)
  ]);

  referralFormControl = new FormControl('', [
    Validators.required, Validators.maxLength(20)
  ]);

  userID: string;
  inputVal: string;

  input_val_on_key_down: string = "";

  otpCodeFlg: boolean = false;

  otpCode: string;
  otpUserVal: string;
  otpSessionId: string = "";
  secondsCounter: any;
  resend_otp_flag: boolean = false;
  otpFlag: boolean;
  validOTPFlg: boolean;

  otpValues: string[] = ['', '', '', '', '', ''];
  private isFillingOtp: boolean = false;
  private webOtpAbortController: AbortController | null = null;

  btnName: string = "Verify";
  maxTimerInterval: number = 30;

  locationPageFlg: boolean;
  mobilePageFlg: boolean;
  otpPageFlg: boolean;
  referralFlg: boolean = false;
  unserviceableModalFlg: boolean = false;
  enteredPincode: string = '';

  fetchStatus: string = "";
  locationFetchBtnFlg: boolean = false;
  sendOTPBtnFlg: boolean = false;
  otpStatus: string = "";

  bgClickFlg: boolean = false;
  referralSuccessFlg: boolean = false;
  referralErrorCodeFlg: boolean = false;

  constructor(
    private _utils: Utils,
    private api: ApiService,
    public loginS: LoginService,
    private _location: LocationService,
    private storageS: StorageService,
    private cartS: CartService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.bgClickFlg = false;
    this.locationPageFlg = true;
    this.mobilePageFlg = false;
    this.otpPageFlg = false;
    this.referralFlg = false;
    this.validOTPFlg = undefined;
    this.otpFlag = true;

    this.mobileFormControl.valueChanges.subscribe(res => {
      if (this.mobileFormControl.valid) {
        this.userID = res;
        this.sendOTPBtnFlg = true;
      } else {
        this.sendOTPBtnFlg = false;
      }
    });

    this.loginS.loginPromptEvent.subscribe((res: boolean) => {
      if (res == true) {
        this.bgClickFlg = res;
        this.validOTPFlg = false;
        this.locationPageFlg = true;
      }
    });

    this.referralFormControl.valueChanges.subscribe(res => {
      this.referralErrorCodeFlg = false;
    });

    //if uer already fetched the location
    if (this.storageS.getItem("tnk_location")) {
      const pincode = atob(this.storageS.getItem("tnk_location"));
      if (pincode.length == 6) {
        this.pincodeFormControl.setValue(pincode);
        this.goNext();
      }
    }
  }

  ngOnDestroy(): void {
    if (this.webOtpAbortController) {
      try { this.webOtpAbortController.abort(); } catch (e) { }
      this.webOtpAbortController = null;
    }
    if (this.secondsCounter) {
      window.clearInterval(this.secondsCounter);
    }
  }

  getOtpValue(): string {
    let val = "";
    for (let i = 1; i <= 6; i++) {
      const el: any = document.getElementById("otp_" + i);
      if (el && el.value !== undefined && el.value !== "") {
        val += String(el.value).trim();
      } else if (this.otpValues && this.otpValues[i - 1]) {
        val += String(this.otpValues[i - 1]).trim();
      }
    }
    return val;
  }

  fillOtpString(otpStr: string) {
    if (!otpStr) return;
    const digits = String(otpStr).replace(/\D/g, '').slice(0, 6);
    if (digits.length === 0) return;

    this.isFillingOtp = true;
    try {
      for (let i = 0; i < 6; i++) {
        const d = digits[i] || '';
        this.otpValues[i] = d;
        const el: any = document.getElementById(`otp_${i + 1}`);
        if (el) {
          el.value = d;
          try {
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          } catch (e) { }
        }
      }

      this.otpUserVal = this.getOtpValue();
      if (this.otpUserVal.length === 6 || (this.otpUserVal.length === 4 && this.otpUserVal === '1111')) {
        this.otpFlag = false;
        this.pauseTimer();
        this.btnName = "Verify";
        this.cdr.detectChanges();

        // Auto submit after a brief delay for seamless mobile 1-tap UX
        setTimeout(() => {
          if (!this.otpFlag && this.btnName === "Verify") {
            this.otpSubmit();
          }
        }, 150);
      } else {
        this.otpFlag = true;
        const nextIdx = Math.min(digits.length + 1, 6);
        const nextEl: any = document.getElementById(`otp_${nextIdx}`);
        if (nextEl) nextEl.focus();
        this.cdr.detectChanges();
      }
    } finally {
      this.isFillingOtp = false;
    }
  }

  onOtpInput(evt: any, index: number, nextTarget: any) {
    if (this.isFillingOtp) return;

    this.otpStatus = "";
    const rawVal = evt?.target?.value || "";
    const digits = rawVal.replace(/\D/g, '');

    // Case 1: Mobile SMS Autofill clicked or multi-digit paste/input
    if (digits.length > 1) {
      this.fillOtpString(digits);
      return;
    }

    // Case 2: Single digit typed
    if (digits.length === 1) {
      evt.target.value = digits;
      if (this.otpValues && index >= 1 && index <= 6) {
        this.otpValues[index - 1] = digits;
      }
      this.otpUserVal = this.getOtpValue();

      if (this.otpUserVal.length === 6 || (this.otpUserVal.length === 4 && this.otpUserVal === '1111')) {
        this.otpFlag = false;
        this.pauseTimer();
        this.btnName = "Verify";
      } else {
        this.otpFlag = true;
        if (nextTarget) {
          nextTarget.focus();
        }
      }
    } else {
      evt.target.value = "";
      if (this.otpValues && index >= 1 && index <= 6) {
        this.otpValues[index - 1] = "";
      }
      this.otpUserVal = this.getOtpValue();
      this.otpFlag = true;
    }
    this.cdr.detectChanges();
  }

  onKeyUpHandler(evt: any, nextTarget: any, index: number) {
    // Handle backspace
    if (evt.key === 'Backspace' || evt.keyCode === 8) {
      const currentEl: any = document.getElementById(`otp_${index}`);
      if (currentEl && currentEl.value === '') {
        const prevIdx = index - 1;
        if (prevIdx >= 1) {
          const prevEl: any = document.getElementById(`otp_${prevIdx}`);
          if (prevEl) {
            prevEl.value = '';
            if (this.otpValues && this.otpValues[prevIdx - 1] !== undefined) {
              this.otpValues[prevIdx - 1] = '';
            }
            prevEl.focus();
          }
        }
      }
      if (this.otpValues && index >= 1 && index <= 6) {
        this.otpValues[index - 1] = currentEl?.value || '';
      }
      this.otpUserVal = this.getOtpValue();
      this.otpFlag = true;
      this.cdr.detectChanges();
      return;
    }

    if (evt.key === 'Enter' || evt.keyCode === 13) {
      if (!this.otpFlag) {
        this.otpSubmit();
      }
    }
  }

  onPasteAction(evt: ClipboardEvent) {
    evt.preventDefault();
    const clipboardData = evt.clipboardData || (window as any)['clipboardData'];
    const pastedText = (clipboardData?.getData('text') || '').trim();
    this.fillOtpString(pastedText);
  }

  listenForWebOtp() {
    if (typeof window === 'undefined' || !('OTPCredential' in window) || !navigator.credentials) {
      return;
    }

    // Abort previous in-flight listener if any
    if (this.webOtpAbortController) {
      try {
        this.webOtpAbortController.abort();
      } catch (e) { }
      this.webOtpAbortController = null;
    }

    try {
      this.webOtpAbortController = new AbortController();
      navigator.credentials.get({
        otp: { transport: ['sms'] },
        signal: this.webOtpAbortController.signal
      } as any).then((content: any) => {
        this.webOtpAbortController = null;
        const code = (content && (content.code || content.id || content.otp)) 
          ? String(content.code || content.id || content.otp) 
          : (typeof content === 'string' ? content : '');

        if (code) {
          this.ngZone.run(() => {
            this.fillOtpString(code);
            this.cdr.detectChanges();
          });
        }
      }).catch((err: any) => {
        this.webOtpAbortController = null;
      });
    } catch (err) {
      this.webOtpAbortController = null;
    }
  }


  otpTimer() {
    this.maxTimerInterval--;
    if (this.maxTimerInterval > 0) {
      this.btnName = `Resend in ${this.maxTimerInterval}`;
      clearInterval(this.secondsCounter);
      this.secondsCounter = setInterval(() => {
        this.btnName = `Resend in ${this.maxTimerInterval}`;
        this.maxTimerInterval--;
        if (this.maxTimerInterval == -1) {
          this.otpFlag = false;
          window.clearInterval(this.secondsCounter);
          this.btnName = "Resend";
        }
      }, 1000);
    } else {
      this.otpFlag = false;
      this.btnName = "Resend";
      window.clearInterval(this.secondsCounter);
    }
  }

  pauseTimer() {
    this.btnName = "Verify";
    window.clearInterval(this.secondsCounter);
    this.resend_otp_flag = false;
  }

  resumeTimer() {
    this.otpTimer();
  }

  otpSubmit() {
    if (this.btnName == "Verify") {
      this.otpFlag = true;
      this.mobileFormControl.disable();
      this.btnName = "Validating...";
      this.otpStatus = "Validating...";

      this.api.postApi("com/validate_otp.php", { 
        mobile: this.userID, 
        otp: this.otpUserVal,
        sessionId: this.otpSessionId 
      }).subscribe({
        next: (res: any) => {
          const isSuccess = res === "SUCCESS" || (typeof res === 'object' && (res?.status === "SUCCESS" || res?.verified === true));
          if (isSuccess) {
            this.handleSuccessfulOTP();
          } else {
            this.handleInvalidOTP(res?.message);
          }
        },
        error: (err: any) => {
          this.handleInvalidOTP(err?.error?.message);
        }
      });
    } else if (this.btnName === "Resend") {
      this.otpFlag = true;
      this.maxTimerInterval = 30;
      this.sendOTPAction();
    }
  }

  handleSuccessfulOTP() {
    this.btnName = "Success";
    this.otpStatus = "Valid";
    this.otpPageFlg = false;

    this.storageS.setItem("login", btoa(this.userID));
    this.loginS.addUser({
      name: "",
      defaultAddressID: 0,
      mobile: this.userID,
      referralCode: this.referralFormControl.value || this.loginS.queryParams?.id
    }).subscribe({
      next: (res: any) => {
        this.loginS.user.mobile = this.userID;
        this.locationPageFlg = false;
        this.mobilePageFlg = false;
        this.otpPageFlg = false;

        const isNewUser = res && (res.is_new === true || res.status === "ADDED");

        if (isNewUser) {
          this.referralFlg = true;
          if (res.referrer != null) {
            this.loginS.setReferralInfo(res.referrer);
            this.referralSuccessFlg = true;
          }
        } else {
          // Already registered user: bypass referral dialog completely
          this.referralFlg = false;
          this.couponContinue();
        }
      },
      error: () => {
        this.loginS.user.mobile = this.userID;
        this.locationPageFlg = false;
        this.mobilePageFlg = false;
        this.otpPageFlg = false;
        this.referralFlg = false;
        this.couponContinue();
      }
    });
  }

  handleInvalidOTP(customMsg?: string) {
    this.mobileFormControl.enable();
    this.loginS.user.mobile = this.userID;
    this.validOTPFlg = false;
    this.otpStatus = customMsg || "Invalid OTP! Please check the SMS and try again";
    this.btnName = "Verify";
    this.otpFlag = false;
    this.resumeTimer();
  }

  referralValidation() {
    const code = this.referralFormControl.value;
    if (!code) {
      this.couponContinue();
      return;
    }
    this.referralErrorCodeFlg = false;
    this.referralSuccessFlg = false;
    this.loginS.referralValidation({ mobile: this.userID || this.loginS.user.mobile, referralCode: code }).subscribe(res => {
      if (res && (res.status == "INVALID" || res.valid === false)) {
        this.referralErrorCodeFlg = true;
      } else {
        const refInfo = res || {
          referrer_name: 'TomorrowNeeds Partner',
          coupon_desc: '25% CASHBACK Coupon Unlocked! (1-time use)',
          referrer: code,
          status: 1
        };
        this.loginS.setReferralInfo(refInfo);
        this.referralSuccessFlg = true;
        // Refresh wallet balance so the ₹100 credit appears in user's wallet
        this.loginS.readWallet();
      }
    });
  }

  navigateTolandingpage() {
    //Route to a Page
    this.bgClickFlg = false;
    this.cartS.router.navigate(["/home/view"]);
    this.loginS.user.mobile = this.userID;
    this.loginS.userStatus = "LOGIN";
    this.loginS.readAddress();
    this.loginS.loginChangeEvent.next(Common.loginStatus.LOGIN);
  }

  sendOTPAction(): void {
    console.log("Send otp action for:", this.userID);

    this.sendOTPBtnFlg = true;
    this.fetchStatus = "Sending verification code...";
    this.otpStatus = "";

    this.api.postApi("com/otp.php", { mobile: this.userID }).subscribe({
      next: (res: any) => {
        if (res && res.status === "SUCCESS") {
          this.otpSessionId = res.sessionId || "";
          this.fetchStatus = "";

          // Route to otp page
          this.otpPageFlg = true;
          this.mobilePageFlg = false;
          this.locationPageFlg = false;

          // Reset OTP values
          this.otpValues = ['', '', '', '', '', ''];
          this.otpUserVal = '';
          this.otpFlag = true;

          // Start otp timer
          this.resend_otp_flag = true;
          this.maxTimerInterval = 30;
          this.btnName = "Resend in 30";
          this.otpTimer();

          // Listen for native mobile WebOTP auto-fill
          this.listenForWebOtp();

          window.setTimeout(() => {
            const el = document.getElementById("otp_1");
            if (el) el.focus();
          }, 300);
        } else {
          this.sendOTPBtnFlg = false;
          this.fetchStatus = res?.message || "Failed to send verification code. Please try again.";
        }
      },
      error: (err: any) => {
        this.sendOTPBtnFlg = false;
        this.fetchStatus = err?.error?.message || "Failed to send verification code. Please check your network.";
      }
    });
  }

  fetchLocation(evt: MouseEvent) {

    this.fetchStatus = "Fetching user location...";
    this.pincodeFormControl.setValue("");
    this.locationFetchBtnFlg = true;

    this._location.detect_my_location().then((res) => {

      setTimeout(() => {
        this.locationFetchBtnFlg = false;
        this.fetchStatus = "";
      }, 1000);

      switch (res) {
        case GeoLocation.ACCESS_GRANTED:
          alert(GeoLocation.ACCESS_GRANTED);
          this.fetchStatus = GeoLocation.ACCESS_GRANTED;
          break;

        case GeoLocation.FAILED:
          this.fetchStatus = GeoLocation.FAILED;
          alert(GeoLocation.FAILED);
          break;

        case GeoLocation.GPS_DENIED:
          this.fetchStatus = GeoLocation.GPS_DENIED;
          alert(GeoLocation.GPS_DENIED);
          break;

        case GeoLocation.LOCATION_PROMPT:
          this.fetchStatus = GeoLocation.LOCATION_PROMPT;
          alert(GeoLocation.LOCATION_PROMPT);
          break;

        case GeoLocation.NOT_STARTED:
          this.fetchStatus = GeoLocation.NOT_STARTED;
          alert(GeoLocation.NOT_STARTED);
          break;

        case GeoLocation.PLEASE_ENABLE_LOCATION:
          this.fetchStatus = GeoLocation.PLEASE_ENABLE_LOCATION;
          alert(GeoLocation.PLEASE_ENABLE_LOCATION);
          break;

        default:
          this.fetchStatus = "Location fetched!"
          this.pincodeFormControl.setValue(res.pincode);
          break;
      }

      if (res.pincode.length == 6) {
        this.storageS.setItem("tnk_location", btoa(res.pincode));
        this.goNext();
      }
    });
  }

  goNext(): void {
    const enteredPin = String(this.pincodeFormControl.value || '').trim();
    if (!enteredPin) return;

    this.cartS.getZone(enteredPin).subscribe({
      next: (res: any) => {
        if (res && res.length > 0) {
          // Pincode is serviceable!
          const matchedZone = (res[0].zone || 'zone1').toLocaleLowerCase();
          this.loginS.user.zone = matchedZone;
          this.loginS.user.pincode = enteredPin;
          this.cartS.zoneChangeEvent.next(matchedZone);
          this.storageS.setItem("tnk_location", btoa(enteredPin));

          this.unserviceableModalFlg = false;
          this.locationPageFlg = false;
          this.otpPageFlg = false;
          this.mobilePageFlg = true;
        } else {
          // Pincode is NOT in the serviceable list -> Show beautiful alert UI!
          this.enteredPincode = enteredPin;
          this.unserviceableModalFlg = true;
          this.locationPageFlg = false;
        }
      },
      error: () => {
        // Fallback: show unserviceable alert UI
        this.enteredPincode = enteredPin;
        this.unserviceableModalFlg = true;
        this.locationPageFlg = false;
      }
    });
  }

  retryPincode(): void {
    this.unserviceableModalFlg = false;
    this.locationPageFlg = true;
    this.pincodeFormControl.setValue('');
  }

  useServiceablePincode(pincode: string): void {
    this.pincodeFormControl.setValue(pincode);
    this.unserviceableModalFlg = false;
    this.goNext();
  }

  exploreAnyway(): void {
    // Sets user zone to zone2 (loads 0 products as requested)
    this.loginS.user.zone = "zone2";
    this.loginS.user.pincode = this.enteredPincode;
    this.cartS.zoneChangeEvent.next("zone2");
    this.storageS.setItem("tnk_location", btoa(this.enteredPincode));

    this.unserviceableModalFlg = false;
    this.locationPageFlg = false;
    this.otpPageFlg = false;
    this.mobilePageFlg = false;
    this.bgClickFlg = false;
  }

  skipAction(evt: MouseEvent): void {
    this.pincodeFormControl.setValue("400071");
    this.loginS.user.zone = "zone1";
    this.loginS.user.pincode = "400071";
    this.cartS.zoneChangeEvent.next("zone1");
    this.storageS.setItem("tnk_location", btoa("400071"));
    this.locationPageFlg = false;
    this.otpPageFlg = false;
    this.mobilePageFlg = false;
    this.bgClickFlg = false;
  }

  contClickAction(evt) {
  }

  submitRefferalCode() {

  }



  couponContinue() {
    this.validOTPFlg = true;
    this.bgClickFlg = false;
    this.referralFlg = false;
    this.navigateTolandingpage();
  }

  overlayClick(evt) {
    evt.preventDefault();
    if (evt.target.classList[0] == "popup_parent") this.bgClickFlg = false;
  }
}

export class MyErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null, form: FormGroupDirective | NgForm | null): boolean {
    const isSubmitted = form && form.submitted;
    return !!(control && control.invalid && (control.dirty || control.touched || isSubmitted));
  }
}


