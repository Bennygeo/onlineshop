import { animate, style, transition, trigger } from '@angular/animations';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, HostListener, Inject, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { delay, of } from 'rxjs';
import { Common } from 'src/app/modal/Common';
import { GeoLocation } from 'src/app/modals/geo-location';
import { User } from 'src/app/modals/user';
import { ApiService } from 'src/app/services/api.service';
import { LocationService } from 'src/app/services/location.service';
import { LoginService } from 'src/app/services/login.service';
import { Address } from 'src/app/utils/types';

@Component({
  selector: 'app-address',
  templateUrl: './address.component.html',
  styleUrls: ['./address.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('translateEffect', [
      transition(':enter', [   // :enter is alias to 'void => *'
        style({ opacity: 1, transform: "translateY(5%)" }), //apply default styles before animation starts
        animate(
          "150ms ease-out",
          style({ opacity: 1, transform: "translateY(0)" })
        )
      ]),
      transition(':leave', [   // :leave is alias to '* => void'
        style({ opacity: 1, transform: "translateY(0)" }), //apply default styles before animation starts
        animate(
          "150ms ease-out",
          style({ opacity: 1, transform: "translateY(100%)" })
        )
      ])
    ]),
    trigger('fadeInOut', [
      transition(':leave', [   // :leave is alias to '* => void'
        animate("0.3s 100ms", style({ opacity: 0 }))
      ])
    ])
  ]
})
export class AddressComponent implements OnInit, OnChanges {

  @Input() address: Address;
  @Input() type: "INSERT" | "UPDATE" | "DELETE";
  @Input() title: string;

  @Input() editBtnFlg: boolean = false;
  @Output() close = new EventEmitter();
  @Output() update = new EventEmitter<any>();

  addressGroup: FormGroup;

  //holds referral code status 
  referral_status: string = "";
  disable_referral_check_btn: boolean = true;

  detect_loc_loader_flg: boolean = false;

  user: User;

  out_of_range: boolean = false;

  //true if all the required address fileds are filled
  public valid_addr_flg: boolean = false;

  addressShowFlg: boolean;
  animationDoneFlg: boolean;

  constructor(
    private formBuilder: FormBuilder,
    private loginS: LoginService,
    private _api: ApiService,
    @Inject('Window') private windowRef: Window,
    private cdr: ChangeDetectorRef,
    private _location: LocationService
  ) {
    this.addressShowFlg = false;
    this.animationDoneFlg = true;

  }

  ngOnChanges(): void {
    this.user = this.loginS.user;
    if (this.editBtnFlg) {
      this.addressShowFlg = true;
      this.animationDoneFlg = false;
    }

    if (this.address && this.addressGroup) {
      this.addressGroup.patchValue({
        name: this.address.name,
        pincode: this.address.pincode,
        address: this.address.address,
        email: this.address.email,
        altMobile: this.address.alt_mobile,
        title: this.address.title
      });

      if (this.type == "INSERT") {
        this.addressGroup.patchValue({
          name: '',
          pincode: '',
          address: '',
          email: '',
          altMobile: '',
          title: "My Home"
        });
      }
    }
  }

  ngOnInit(): void {

    this.user = this.loginS.user;
    this.loginS.loginChangeEvent.subscribe((res: any) => {
      if (res === Common.loginStatus.LOGIN) {
        this.user = this.loginS.user;
      }

      if (res === Common.loginStatus.LOGOUT) {

      }
    });

    this.addressGroup = this.formBuilder.group({
      title: ['', Validators.minLength(3)],
      name: ['', Validators.minLength(3)],
      pincode: ['', Validators.minLength(6)],
      address: ['', Validators.minLength(6)],
      // email: ['', [Validators.required, ValidationsService.emailValidatorFn()]],
      altMobile: ['', [Validators.minLength(10), Validators.maxLength(10)]]
    });

    this.addressGroup.valueChanges.subscribe((data) => {
      this.valid_addr_flg = this.addressGroup.valid;
      if (this.addressGroup.valid) {
        this.user.name = data['name'];
        this.user.mail = data['email'];
        this.user.pincode = data['pincode'];
        this.user.address = data['addr_line_1'];
        this.user.alternateMobile = data['altMobile']
      }
    });
  }

  onReferralSubmit(evt, val) {
    document.getElementById("#referral").setAttribute("disabled", "true");
  }

  onPinChange() {

  }

  detect_my_location(e) {
    this.detect_loc_loader_flg = true;
    this._location.detect_my_location().then((res) => {
      this.detect_loc_loader_flg = false;

      if (typeof res === 'object' && res.pincode !== undefined) {
        this.addressGroup.patchValue({
          pincode: res.pincode,
          address: res.address || ''
        });
      } else {
        switch (res) {
          case GeoLocation.GPS_DENIED:
          case "DENIED":
            alert("Please enable location on your browser.");
            break;
          case GeoLocation.LOCATION_PROMPT:
            alert("Location prompt");
            break;
          case GeoLocation.NOT_STARTED:
            alert("GPS not activated!");
            break;
          default:
            alert("Please enable location.");
            break;
        }
      }
      this.cdr.detectChanges();
    }).catch(() => {
      this.detect_loc_loader_flg = false;
      this.cdr.detectChanges();
    });
  }

  udateAddress(evt: MouseEvent) {
    let addr: Address;
    switch (this.type) {
      case "INSERT":
        addr = this.addressGroup.value;
        /**
         * Sending write request to db
         */
        addr.mobile = this.user.mobile;

        this._api.postApi('user/write_address.php', { "address": JSON.stringify(addr) }).subscribe({
          next: (res: any) => {
            if (res && res.id) {
              addr.id = res.id;
            }
            this.update.emit(addr);
            this.closeAction();
          },
          error: (err: Error) => {
            alert(err);
          }
        });
        break;


      case "UPDATE":
        addr = this.addressGroup.value;
        addr.mobile = this.user.mobile;
        addr.id = this.address.id;
        this._api.postApi("user/update_address.php", { "address": JSON.stringify(addr) }).subscribe({
          next: (res: any) => {
            this.update.emit(addr);
            this.closeAction();
          },
          error: (err: Error) => {
            alert(err);
          }
        });
        break;

      default:
        break;
    }
  }

  deleteCancelAction() {
    // this.update.emit("CANCEL");
    this.closeAction();
  }

  deleteAction() {
    this.update.emit("DELETE");
    this.closeAction();
  }

  @HostListener("click", ["$event.target"])
  outsideClickAction(evt: any) {
    if (evt.classList[0] == "popup_parent") {
      this.closeAction();
    }
  }

  closeAction() {
    this.close.emit();
    this.addressShowFlg = false;
    of(100).pipe(delay(100)).subscribe(res => {
      this.animationDoneFlg = true;
      this.cdr.detectChanges();
    });
  }

}

