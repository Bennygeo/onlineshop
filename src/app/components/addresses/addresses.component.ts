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

    this.loginS.addressChangeEvent.subscribe({
      next: () => {
        this.addresses = this.loginS.user.addresses;
        this.selectedAddress = this.loginS.user.address;
        window.setTimeout(() => {
          for (var i = 0; i < this.addresses.length; i++) {
            document.querySelector(`#addr_${i}>.flex-box>mat-radio-button>div>.mdc-radio`)['style'].height = (document.querySelector(`#addr_${i}>.flex-box>mat-radio-button>div>.mdc-label`).clientHeight) + "px";
          }
        });
      },
      error: () => {
        alert("Address change ERROR!");
      }
    });

    //should be called after address fetching
    this.editBtnFlg = false;
    this.loginS.noAddressEvent.subscribe({
      next: (res: boolean) => {
        if (res === true) {
          window.setTimeout(() => {
            this.addAddressAction();
          }, 600);
        }
      }
    });
  }

  ngOnInit(): void {
    if (this.cartService.routeURL == "/home/address") {
      this.closebtnFlg = true;
      this.cartService.headerChangeEvent.next("type5");
    }

    // const parents = this.utils.getAllParentDivs(document.querySelector('.address-cont'));
    // parents.forEach(el => {
    //   // el.style.overflowY = "hidden";
    // });
  }

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

    for (var ind = 0; ind < this.addresses.length; ind++)
      if (this.addresses[ind].active == 1) this.addresses[ind].active = 0;

    this.addresses[index].active = 1;
    this.user.address = this.addresses[index];
    this.user.pincode = this.user.address.pincode;

    this.cartService.getZone(this.user.pincode).subscribe(area => {
      if (area.length > 0) {
        if (area[0].zone.toLocaleLowerCase() != this.user.zone) {
          this.user.zone = area[0].zone.toLocaleLowerCase();
          this.loginS.addressChangeEvent.next(AddressAction.SWITCH);
        } else {
          this.loginS.addressChangeEvent.next(AddressAction.SAME);
        }
      } else {
        if (this.user.zone === "zone2") {
          this.loginS.addressChangeEvent.next(AddressAction.SAME);
        } else {
          this.user.zone = "zone2";
          this.loginS.addressChangeEvent.next(AddressAction.SWITCH);
        }
      }
      this.cartService.zoneChangeEvent.next(this.user.zone);
    });

    let address = {
      id: this.user.address.id,
      mobile: this.user.address.mobile
    }
    this._api.postApi("user/set_default_address.php", { "address": JSON.stringify(address) }).subscribe({
      next: (res: any) => {

      },
      error: (err: Error) => {
        alert("Default address write error.");
      }
    });

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
          for (var ind = 0; ind < this.addresses.length; ind++)
            if (this.addresses[ind].active == 1) this.addresses[ind].active = 0;
          this.addresses.push(res);
        }
        this.user.addresses = this.addresses;
        this.user.address = res;
        this.loginS.addressChangeEvent.next(AddressAction.INSERT);
        break;

      case "UPDATE":
        let index = undefined;
        for (let i = 0; i < this.addresses.length; i++) {
          if (this.addresses[i].id == res.id) index = i;
        }
        this.addresses[index]['active'] = 1;
        this.addresses[index]['addr_line_1'] = res['addr_line_1'];
        this.addresses[index]['name'] = res['name'];
        this.addresses[index]['pincode'] = res['pincode'];
        this.addresses[index]['title'] = res['title'];

        this.user.address = this.addresses[index];
        this.user.addresses = this.addresses;
        this.loginS.addressChangeEvent.next(AddressAction.UPDATE);
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
    this.type = "INSERT";
    this.selectedAddress = undefined;
    this.editBtnFlg = true;
    this.addressTitle = "Add a new address";
  }

  defaultAddress(address: Address): void {
    this.selectedAddress = address;
    this.loginS.addressCloseEvent.next(true);
  }

  popupClose() {
    this.loginS.addressCloseEvent.next(true);
  }

  ngOnDestroy(): void {
    // this.loginS.noAddressEvent.complete();
  }
}
