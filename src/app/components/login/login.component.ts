import { Component, OnInit } from '@angular/core';
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
export class LoginComponent implements OnInit {

  matcher = new MyErrorStateMatcher();

  pincodeFormControl = new FormControl('', [
    Validators.required,
    ValidationsService.checkLimit(500000, 999999)
  ]);

  mobileFormControl = new FormControl('', [
    Validators.required,
    ValidationsService.checkLimit(5000000000, 9999999999)
  ]);

  referralFormControl = new FormControl('', [
    Validators.required, Validators.maxLength(6)
  ]);

  userID: string;
  inputVal: string;

  input_val_on_key_down: string = "";

  otpCodeFlg: boolean = false;

  otpCode: string;
  otpUserVal: string;
  secondsCounter: any;
  resend_otp_flag: boolean = false;
  otpFlag: boolean;
  validOTPFlg: boolean;

  btnName: string = "Verify";
  maxTimerInterval: number = 30;

  locationPageFlg: boolean;
  mobilePageFlg: boolean;
  otpPageFlg: boolean;
  referralFlg: boolean = false;

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
    private cartS: CartService
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

  next(evt, target) {

    if (target) target.value = "";
    var getKeyCode = function (str) {
      return str.charCodeAt(str.length);
    }

    evt.currentTarget.value = "";
    charKeyCode = evt.keyCode;

    if (navigator.userAgent.match(/Android/i)) {
      var inputValue = evt.currentTarget.value;
      var charKeyCode = evt.keyCode || evt.which;

      if (charKeyCode == 0 || charKeyCode == 229) charKeyCode = getKeyCode(inputValue);
    }

    if (evt.keyCode == 17 || evt.keyCode == 86) return;

    if (charKeyCode == 8) {
      if (evt.currentTarget.value.length < 1) {
        if (evt.currentTarget.id.slice(-1) == 4 && this.input_val_on_key_down.length == 1) {
          this._utils.getElement("#otp_" + (evt.currentTarget.id.slice(-1))).focus();
        } else {
          let _target = (evt.currentTarget.id.slice(-1) - 1) || 1;
          this._utils.getElement("#otp_" + _target).focus();
        }
      }
      this.input_val_on_key_down = "";
      return;
    }

    if (evt.keyCode == 46) {
      evt.currentTarget.value = "";
      return;
    }

    evt.currentTarget.value = this.inputVal;

    if (((evt.keyCode >= 48 && evt.keyCode <= 57) || (evt.keyCode >= 96 && evt.keyCode <= 105) || evt.keyCode == 229) && !Number.isNaN(charKeyCode)) {
      this.otpUserVal = this._utils.getElement("#otp_1").value + this._utils.getElement("#otp_2").value + this._utils.getElement("#otp_3").value + this._utils.getElement("#otp_4").value;
      if (target) {
        target.value = "";
        target.focus();
      }
    } else if (evt.keyCode == 13) {
      this.otpSubmit();
    } else {
      return;
    }
  }

  focusFunction(evt) {
    evt.currentTarget.value = "";
  }

  onKeydown(evt) {
    this.input_val_on_key_down = evt.currentTarget.value;
  }

  onKeyUpHandler(val, target) {
    this.next(val, target);
  }

  onOtpChange(evt: any) {
    this.otpStatus = "";
    this.inputVal = evt.data;
    this.otpUserVal = this._utils.getElement("#otp_1").value + this._utils.getElement("#otp_2").value + this._utils.getElement("#otp_3").value + this._utils.getElement("#otp_4").value;

    if (this.otpUserVal.length == 4) {
      this.otpFlag = false
      this.pauseTimer();
    } else {
      this.otpFlag = true;
      this.resumeTimer();
    }
  }

  onPasteAction(evt: ClipboardEvent) {
    let clipboardData = evt.clipboardData || window['clipboardData'];
    let pastedText = clipboardData.getData('text');

    window.setTimeout(() => {
      for (let i in pastedText) {
        this._utils.getElement("#otp_" + (Number(i) + 1)).focus();
        this._utils.getElement("#otp_" + (Number(i) + 1)).value = pastedText[i];
      }
    }, 300);

    if (pastedText.length == 4) this.otpFlag = false;
    return;
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

      if (environment.production) {
        this.api.postApi("com/validate_otp.php", { mobile: this.userID, otp: this.otpUserVal }).subscribe(res => {
          if (res == "SUCCESS") {
            this.btnName = "Sucesss";
            this.otpStatus = "Valid";
            this.validOTPFlg = true;

            this.otpPageFlg = false;

            //setup cookie
            this.storageS.setItem("login", btoa(this.userID));
            this.loginS.addUser({
              name: "",
              defaultAddressID: 0,
              mobile: this.userID,
              referralCode: this.loginS.queryParams.id
            }).subscribe(res => {
              this.loginS.user.mobile = this.userID;
              if (res.status == "ADDED") {
                if (res.referrer != null) {
                  this.loginS.referrrarinfo = res;
                  this.referralSuccessFlg = true;
                } else {
                  this.locationPageFlg = false;
                  this.mobilePageFlg = false;
                  this.otpPageFlg = false;
                }
                this.referralFlg = true;
              } else {
                this.navigateTolandingpage();
              }
            });
          } else {
            this.loginS.user.mobile = this.userID;
            this.validOTPFlg = false;
            this.otpStatus = "Invalid";
            this.resumeTimer();
          }
        });
      } else {
        this.btnName = "Sucesss";
        this.otpStatus = "Valid";
        // this.validOTPFlg = true;

        this.otpPageFlg = false;

        //setup cookie
        this.storageS.setItem("login", btoa(this.userID));
        this.loginS.addUser({
          name: "",
          defaultAddressID: 0,
          mobile: this.userID,
          referralCode: this.loginS.queryParams.id
        }).subscribe(res => {
          this.loginS.user.mobile = this.userID;
          if (res.status == "ADDED") {
            if (res.referrer != null) {
              this.loginS.referrrarinfo = res;
              this.referralSuccessFlg = true;
            } else {
              this.locationPageFlg = false;
              this.mobilePageFlg = false;
              this.otpPageFlg = false;
            }
            this.referralFlg = true;
          } else {
            this.navigateTolandingpage();
          }
        });
      }
    } else if (this.btnName === "Resend") {
      //Sttart otp timer     
      this.otpFlag = true;
      this.maxTimerInterval = 30;
      this.sendOTPAction();
    }
  }

  referralValidation() {
    this.referralErrorCodeFlg = false;
    this.referralSuccessFlg = false;
    this.loginS.referralValidation({ mobile: this.loginS.user.mobile, referralCode: this.referralFormControl.value }).subscribe(res => {
      if (res.status == "INVALID") {
        this.referralErrorCodeFlg = true;
      } else {
        this.loginS.referrrarinfo = res;
        this.referralSuccessFlg = true;
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
    console.log("Send otp action");

    this.sendOTPBtnFlg = true;
    this.fetchStatus = "Sending verification code...";

    if (!environment.production) {
      this.otpCode = this._utils.generateOTP();
      // this.api.postApi("com/otp.php", { mobile: this.userID }).subscribe((res) => {
      this.fetchStatus = "routing...";

      //Route to otp page
      this.otpPageFlg = true;
      this.mobilePageFlg = false;
      this.locationPageFlg = false;

      //Sttart otp timer        
      this.resend_otp_flag = true;
      this.btnName = "Resend in 30";
      this.otpTimer();

      window.setTimeout(() => {
        this.fetchStatus = "";
        document.getElementById("otp_1").focus();
      }, 1000);
      // });
    }

    if (environment.production) {
      this.otpCode = this._utils.generateOTP();

      this.api.postApi("com/otp.php", { mobile: this.userID }).subscribe((res) => {
        this.fetchStatus = "routing...";

        //Route to otp page
        this.otpPageFlg = true;
        this.mobilePageFlg = false;
        this.locationPageFlg = false;

        //Sttart otp timer        
        this.resend_otp_flag = true;
        this.btnName = "Resend in 30";
        this.otpTimer();

        window.setTimeout(() => {
          this.fetchStatus = "";
        }, 1000);
      });
    }
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
    this.cartS.getZone(this.pincodeFormControl.value).subscribe(res => {
      if (res.length > 0) {
        this.loginS.user.zone = res[0].zone;
      } else {
        this.loginS.user.zone = "zone2";
        alert("Maybe the products you see not comes under our delivery zone area!");
      }
      this.cartS.zoneChangeEvent.next(this.loginS.user.zone);
      this.loginS.user.pincode = this.pincodeFormControl.value;
    });

    this.locationPageFlg = false;
    this.otpPageFlg = false;
    this.mobilePageFlg = true;
  }

  skipAction(evt: MouseEvent): void {
    this.pincodeFormControl.setValue("600095");
    alert("Maybe the products you see not comes under our delivery zone area!");
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
    this.bgClickFlg = false;
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


