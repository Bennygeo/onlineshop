import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatRadioChange } from '@angular/material/radio';
import { delay, of } from 'rxjs';
import { User } from 'src/app/modals/user';
import { ApiService } from 'src/app/services/api.service';
import { CartService } from 'src/app/services/cart.service';
import { LoginService } from 'src/app/services/login.service';
import { Address, AddressAction } from 'src/app/utils/types';

@Component({
  selector: 'app-addresses',
  templateUrl: './addresses.component.html',
  styleUrls: ['./addresses.component.scss']
})
export class AddressesComponent implements OnInit, OnDestroy {

  addresses: Array<Address> = [];
  public selectedAddress: Address;
  editBtnFlg: boolean;
  addressTitle: string;

  deleteTarget: HTMLBodyElement;
  deleteIndex: number = undefined;
  closebtnFlg: boolean = false;

  type: "INSERT" | "UPDATE" | "DELETE";

  constructor(
    private _api: ApiService,
    private loginS: LoginService,
    private cartService: CartService,
    private user: User) {

    this.user = this.loginS.user;

    this.addresses = this.loginS.user.addresses;
    this.selectedAddress = this.loginS.user.address;
    this.syncActiveAddress();

    this.loginS.addressChangeEvent.subscribe({
      next: () => {
        this.addresses = this.loginS.user.addresses;
        this.selectedAddress = this.loginS.user.address;
        this.syncActiveAddress();
        if (this.addresses && this.addresses.length > 0) {
          this.loginS.noAddressEvent.next(false);
        }
      },
      error: () => {
        alert("Address change ERROR!");
      }
    });

    //should be called after address fetching
    this.editBtnFlg = false;
    this.loginS.noAddressEvent.subscribe({
      next: (res: boolean) => {
        const hasAddrs = (this.addresses && this.addresses.length > 0) ||
                         (this.loginS.user?.addresses && this.loginS.user.addresses.length > 0);
        if (res === true && !hasAddrs) {
          window.setTimeout(() => {
            if (!this.addresses || this.addresses.length === 0) {
              this.addAddressAction();
            }
          }, 300);
        }
      }
    });
  }

  serviceablePincodes: Set<string> = new Set(['400071']);

  ngOnInit(): void {
    if (this.cartService.routeURL == "/home/address") {
      this.closebtnFlg = true;
      this.cartService.headerChangeEvent.next("type5");
    }
    this.loadServiceablePincodes();
  }

  loadServiceablePincodes(): void {
    this._api.getApi('com/read_zone.php?action=get_serviceable_list').subscribe({
      next: (res: any) => {
        if (Array.isArray(res) && res.length > 0) {
          this.serviceablePincodes = new Set(res.map((r: any) => String(r.pincode).trim()));
        }
      },
      error: () => {}
    });
  }

  isPincodeServiceable(pin: any): boolean {
    if (!pin) return false;
    const cleanPin = String(pin).trim();
    return this.serviceablePincodes.has(cleanPin);
  }

  public selectedIndex: number = 0;

  editAddress(address: Address): void {
    this.type = "UPDATE";
    this.selectedAddress = undefined;
    window.setTimeout((addr) => {
      this.selectedAddress = addr;
      this.editBtnFlg = true;
    }, 0, address);
    this.addressTitle = "Edit address";
  }

  addressChange(evt: MatRadioChange) {
    let index = evt.value * 1;
    this.selectedIndex = index;

    for (var ind = 0; ind < this.addresses.length; ind++) {
      this.addresses[ind].active = (ind === index) ? 1 : 0;
    }

    this.user.address = this.addresses[index];
    this.selectedAddress = this.addresses[index];
    this.user.pincode = this.user.address.pincode;
  }

  //from address component
  closeEvent() {
    this.editBtnFlg = false;
  }

  updateEvent(res: any) {
    switch (this.type) {
      case "INSERT":
        if (res === "EXCEEDED") alert("MAX 15 address allowed!");
        else {
          if (!this.addresses) this.addresses = [];
          for (var ind = 0; ind < this.addresses.length; ind++) {
            if (this.addresses[ind].active == 1) this.addresses[ind].active = 0;
          }
          if (this.addresses.length === 0) {
            res.active = 1;
            res.default = 1;
            res.is_default = 1;
          }
          this.addresses.push(res);
        }
        this.loginS.user.addresses = this.user.addresses = this.addresses;
        this.loginS.user.address = this.user.address = res;
        this.loginS.user.pincode = this.user.pincode = res.pincode;
        this.selectedAddress = res;
        this.editBtnFlg = false;
        this.loginS.noAddressEvent.next(false);
        this.loginS.addressChangeEvent.next(AddressAction.INSERT);
        this.syncActiveAddress();
        break;

      case "UPDATE":
        let index = undefined;
        for (let i = 0; i < this.addresses.length; i++) {
          if (this.addresses[i].id == res.id) index = i;
        }
        if (index !== undefined) {
          this.addresses[index]['active'] = 1;
          this.addresses[index]['address'] = res['address'] || res['addr_line_1'];
          this.addresses[index]['name'] = res['name'];
          this.addresses[index]['pincode'] = res['pincode'];
          this.addresses[index]['title'] = res['title'];

          this.user.address = this.addresses[index];
          this.user.addresses = this.addresses;
          this.loginS.user.address = this.addresses[index];
          this.loginS.user.addresses = this.addresses;
        }
        this.editBtnFlg = false;
        this.loginS.addressChangeEvent.next(AddressAction.UPDATE);
        this.syncActiveAddress();
        break;

      case "DELETE":
        this._api.postApi("user/delete_address.php", { "address": JSON.stringify(this.selectedAddress) }).subscribe({
          next: (res) => {
            this.closeEvent();
            this.deleteTarget.style.opacity = "0";

            of(this.selectedAddress).pipe(delay(300)).subscribe(res => {
              this.addresses.splice(this.deleteIndex, 1);

              this.user.address = this.addresses[0];
              for (var ind = 0; ind < this.addresses.length; ind++) {
                if (this.addresses[ind].active == 1) this.loginS.user.address = this.user.address = this.addresses[ind];
              }
              this.loginS.user.addresses = this.user.addresses = this.addresses;
              this.loginS.addressChangeEvent.next(AddressAction.DELETE);
            });
          },
          error: (err: Error) => {
            alert("Address delete error");
          }
        });
        break;

      default:
        break;
    }

  }

  deleteAction(evt: MouseEvent, addr: Address, index: number) {
    if (addr.active == 1) {
      alert("Not allowed to delete default address!");
    } else {
      this.type = "DELETE";
      this.selectedAddress = undefined;
      window.setTimeout((addr) => {
        this.selectedAddress = addr;
        this.editBtnFlg = true;
      }, 0, addr);
      this.addressTitle = "Edit address";
      this.deleteTarget = evt.currentTarget['parentElement'].parentElement;
      this.deleteIndex = index;
    }
  }

  addAddressAction(): void {
    if (this.addresses && this.addresses.length >= 15) {
      alert("MAX 15 address allowed!");
      return;
    }
    this.type = "INSERT";
    this.selectedAddress = undefined;
    this.editBtnFlg = true;
    this.addressTitle = "Add a new address";
  }

  defaultAddress(address: Address): void {
    this.selectedAddress = address;
    this.user.address = address;
    this.user.pincode = address.pincode;

    for (let i = 0; i < this.addresses.length; i++) {
      if (this.addresses[i].id === address.id) {
        this.addresses[i].active = 1;
        this.addresses[i].default = 1;
        this.addresses[i]['is_default'] = 1;
        this.selectedIndex = i;
      } else {
        this.addresses[i].active = 0;
        this.addresses[i].default = 0;
        this.addresses[i]['is_default'] = 0;
      }
    }

    this.cartService.getZone(this.user.pincode).subscribe(area => {
      if (area && area.length > 0) {
        if (area[0].zone.toLocaleLowerCase() != this.user.zone) {
          this.user.zone = area[0].zone.toLocaleLowerCase();
        }
      } else {
        if (this.user.zone !== "zone2") {
          this.user.zone = "zone2";
        }
      }
      this.cartService.zoneChangeEvent.next(this.user.zone);
    });

    let addrParam = {
      id: address.id,
      mobile: this.user.mobile
    };

    this._api.postApi("user/set_default_address.php", { "address": JSON.stringify(addrParam) }).subscribe({
      next: () => {
        this.loginS.addressChangeEvent.next(AddressAction.SWITCH);
        this.loginS.addressCloseEvent.next(true);
      },
      error: (err: Error) => {
        alert("Default address write error.");
      }
    });
  }

  hasAddresses(): boolean {
    return !!((this.addresses && this.addresses.length > 0) || (this.loginS.user?.addresses && this.loginS.user.addresses.length > 0));
  }

  popupClose() {
    if (this.hasAddresses()) {
      this.loginS.addressCloseEvent.next(true);
    }
  }

  isDefaultAddress(address: Address): boolean {
    return !!address && (address.default == 1 || address['is_default'] == 1);
  }

  getAddressIcon(title: string): string {
    if (!title) return 'place';
    const t = title.toLowerCase();
    if (t.includes('home')) return 'home';
    if (t.includes('work') || t.includes('office')) return 'work';
    if (t.includes('flat') || t.includes('apt') || t.includes('apartment')) return 'apartment';
    return 'place';
  }

  selectCardAddress(address: Address, index: number): void {
    if (this.selectedIndex === index && address.active === 1) {
      return;
    }
    this.selectedIndex = index;
    for (var ind = 0; ind < this.addresses.length; ind++) {
      this.addresses[ind].active = (ind === index) ? 1 : 0;
    }
    this.user.address = this.addresses[index];
    this.selectedAddress = this.addresses[index];
    this.user.pincode = this.user.address.pincode;
  }

  syncActiveAddress(): void {
    if (this.addresses && this.addresses.length > 0) {
      let activeIdx = -1;
      for (let i = 0; i < this.addresses.length; i++) {
        if (this.addresses[i].default == 1 || this.addresses[i]['is_default'] == 1 || this.addresses[i].active == 1) {
          this.addresses[i].active = 1;
          if (activeIdx === -1) activeIdx = i;
        } else {
          this.addresses[i].active = 0;
        }
      }
      if (activeIdx === -1) {
        activeIdx = 0;
        this.addresses[0].active = 1;
      }
      this.selectedIndex = activeIdx;
      this.selectedAddress = this.addresses[activeIdx];
      this.user.address = this.addresses[activeIdx];
    }
  }

  trackByAddressId(index: number, address: Address): any {
    return address ? address.id || index : index;
  }

  ngOnDestroy(): void {
  }
}
