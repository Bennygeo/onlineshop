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
    } else {
      this.addressShowFlg = false;
    }

    if (this.addressGroup) {
      if (this.type === "UPDATE" && this.address) {
        this.addressGroup.patchValue({
          name: this.address.name || '',
          pincode: this.address.pincode || '',
          address: this.address.address || '',
          email: this.address.email || '',
          altMobile: this.address.alt_mobile || '',
          title: this.address.title || 'My Home'
        });
      } else if (this.type === "INSERT") {
        this.addressGroup.patchValue({
          name: this.user?.name || '',
          pincode: this.user?.pincode || '',
          address: '',
          email: '',
          altMobile: '',
          title: "My Home"
        });
      }
      this.valid_addr_flg = this.addressGroup.valid;
    }
    this.cdr.markForCheck();
  }

  ngOnInit(): void {
    this.user = this.loginS.user;
    this.loginS.loginChangeEvent.subscribe((res: any) => {
      if (res === Common.loginStatus.LOGIN) {
        this.user = this.loginS.user;
      }
    });

    this.addressGroup = this.formBuilder.group({
      title: ['My Home'],
      name: ['', [Validators.required, Validators.minLength(2)]],
      pincode: ['', [Validators.required, Validators.pattern(/^[0-9]{6}$/)]],
      address: ['', [Validators.required, Validators.minLength(3)]],
      altMobile: ['']
    });

    if (this.type === 'UPDATE' && this.address) {
      this.addressGroup.patchValue({
        name: this.address.name || '',
        pincode: this.address.pincode || '',
        address: this.address.address || '',
        email: this.address.email || '',
        altMobile: this.address.alt_mobile || '',
        title: this.address.title || 'My Home'
      });
    } else if (this.type === 'INSERT') {
      this.addressGroup.patchValue({
        name: this.user?.name || '',
        pincode: this.user?.pincode || '',
        address: '',
        title: 'My Home'
      });
    }

    this.valid_addr_flg = this.addressGroup.valid;

    this.addressGroup.valueChanges.subscribe((data) => {
      this.valid_addr_flg = this.addressGroup.valid;
      if (this.addressGroup.valid) {
        this.user.name = data['name'];
        this.user.pincode = data['pincode'];
        this.user.address = data['address'];
        this.user.alternateMobile = data['altMobile'];
      }
      this.cdr.markForCheck();
    });
  }

  setTitlePreset(preset: string): void {
    if (this.addressGroup) {
      this.addressGroup.get('title')?.setValue(preset);
      this.valid_addr_flg = this.addressGroup.valid;
      this.cdr.markForCheck();
    }
  }

  isPresetActive(preset: string): boolean {
    return this.addressGroup?.get('title')?.value?.toLowerCase() === preset.toLowerCase();
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
          address: res.address || this.addressGroup.get('address')?.value || ''
        });
        this.valid_addr_flg = this.addressGroup.valid;
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
      this.cdr.markForCheck();
    }).catch(() => {
      this.detect_loc_loader_flg = false;
      this.cdr.markForCheck();
    });
  }

  udateAddress(evt: MouseEvent) {
    if (!this.valid_addr_flg) return;

    let addr: Address = { ...this.addressGroup.value };
    addr.mobile = this.user?.mobile || this.loginS.user?.mobile || '';

    switch (this.type) {
      case "INSERT":
        this._api.postApi('user/write_address.php', { "address": JSON.stringify(addr) }, true).subscribe({
          next: (res: any) => {
            if (res && res.id) {
              addr.id = res.id;
              if (res.is_default !== undefined) {
                addr.default = res.is_default;
                addr['is_default'] = res.is_default;
                addr.active = res.is_default;
              }
            } else {
              addr.id = Date.now();
              addr.default = 1;
              addr['is_default'] = 1;
              addr.active = 1;
            }
            this.update.emit(addr);
            this.closeAction(true);
          },
          error: (err: Error) => {
            addr.id = Date.now();
            addr.default = 1;
            addr['is_default'] = 1;
            addr.active = 1;
            this.update.emit(addr);
            this.closeAction(true);
          }
        });
        break;

      case "UPDATE":
        addr.id = this.address.id;
        this._api.postApi("user/update_address.php", { "address": JSON.stringify(addr) }, true).subscribe({
          next: (res: any) => {
            this.update.emit(addr);
            this.closeAction(true);
          },
          error: (err: Error) => {
            this.update.emit(addr);
            this.closeAction(true);
          }
        });
        break;

      default:
        break;
    }
  }

  hasAddresses(): boolean {
    const addrs = this.loginS.user?.addresses;
    return !!(addrs && addrs.length > 0);
  }

  deleteCancelAction() {
    // this.update.emit("CANCEL");
    this.closeAction(true);
  }

  deleteAction() {
    this.update.emit("DELETE");
    this.closeAction(true);
  }

  @HostListener("click", ["$event.target"])
  outsideClickAction(evt: any) {
    if (evt.classList && evt.classList[0] == "popup_parent") {
      if (this.hasAddresses()) {
        this.closeAction();
      }
    }
  }

  closeAction(force: boolean = false) {
    if (!force && this.type === 'INSERT' && !this.hasAddresses()) {
      return;
    }
    this.close.emit();
    this.addressShowFlg = false;
    of(100).pipe(delay(100)).subscribe(res => {
      this.animationDoneFlg = true;
      this.cdr.detectChanges();
    });
  }

}

