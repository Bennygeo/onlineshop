import { Injectable } from '@angular/core';
import { User } from '../modals/user';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { Common } from '../modal/Common';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';
import { Address, AddressAction, PopupType, UserType, Wallet } from '../utils/types';

@Injectable({
    providedIn: 'root'
})
export class LoginService {

    user: User = new User();

    //login change event based on cookie
    loginChangeEvent: BehaviorSubject<string> = new BehaviorSubject<string>(undefined);

    //promopt user if not user logged in
    loginPromptEvent: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

    //Selection of address from the header
    headerAddressSelectionEvent: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(undefined);

    //logout event
    logoutEvent: Subject<void> = new Subject<void>();

    ////handle address related changes
    addressChangeEvent: Subject<AddressAction> = new Subject<AddressAction>();

    addressCloseEvent: Subject<boolean> = new Subject<boolean>();

    //if the user doesn't have any address
    noAddressEvent: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(undefined);

    userStatus: LoginStatus;

    defaultPincode: string = "600095";

    //to show popup from the app component by triggering from home module
    popupEvent: BehaviorSubject<PopupType> = new BehaviorSubject<PopupType>({ flag: false, msg: "" });

    walletUpdateEvent: BehaviorSubject<Array<Wallet>> = new BehaviorSubject<Array<Wallet>>([]);

    queryParams: any = {};

    referrrarinfo: Referrer = {
        coupon_desc: "xxx",
        referrer: 'xxxx',
        referrer_name: 'xxxx',
        status: 0
    };

    constructor(
        private apiService: ApiService,
        private storageS: StorageService
    ) {
        let localVal = atob(this.storageS.getItem('login') || "");
        if (localVal.length === 10) {
            this.userStatus = "LOGIN";
            this.user.mobile = localVal;
            this.loginChangeEvent.next(Common.loginStatus.LOGIN);
            this.loginPromptEvent.next(false);

            this.readWallet();
            this.readAddress();
            // this.readUser();

        } else {
            this.userStatus = "LOGOUT";
            this.loginChangeEvent.next(Common.loginStatus.LOGOUT);
            this.loginPromptEvent.next(true);
        }

        this.logoutEvent.subscribe(() => {
            this.storageS.removeItem("login");
            this.storageS.removeItem("tnk_location");
            this.user = new User();
            this.userStatus = "LOGOUT";
            this.loginChangeEvent.next(Common.loginStatus.LOGOUT);
            this.loginPromptEvent.next(true);
        });

        this.readUser().subscribe((res: any) => {
            if (res.length > 0) {
                this.user.referralId = res[0].referral_id;
            } else {
                this.logoutEvent.next();
            }
        });
    }

    logUserAction(action: string, details?: any) {
        let message = `User: ${this.user.mobile} - Action: ${action}`;
        if (details) {
            message += ` - Details: ${JSON.stringify(details)}`;
        }
        console.log(message); // Replace with actual logging mechanism (e.g., sending to server)
    }

    referralValidation(params: any): Observable<any> {
        return this.apiService.postApi("referral/referral_validation.php", { mobile: params.mobile, referralCode: params.referralCode });
    }

    readUser(): Observable<any> {
        return this.apiService.postApi("user/read_user.php", { mobile: this.user.mobile });
    }

    loginstatus(): boolean {
        return (this.userStatus === Common.loginStatus.LOGIN) ? true : false;
    }

    addUser(details: UserType): Observable<any> {
        // if (this.userStatus === Common.loginStatus.LOGOUT) {
        //     this.apiService.postApi("user/new_user.php", details).subscribe((res: string) => {
        //         // alert(res);
        //     });
        // } else {
        //     // alert("USER EXIST - from login service class");
        // }
        return this.apiService.postApi("user/new_user.php", details);
    }

    readAddress() {
        if (this.userStatus === Common.loginStatus.LOGIN) {
            this.apiService.postApi("user/read_address.php", { id: this.user.mobile }).subscribe((res: Array<Address>) => {
                if (res.length > 0) {
                    this.user.addresses = res;
                    // this.addresses = res;
                    res.forEach((item) => {
                        if (item.active == 1) {
                            this.user.address = item;
                            this.user.pincode = item.pincode;
                        }
                    });
                    this.addressChangeEvent.next(AddressAction.READ);
                } else {
                    //For no address user
                    this.noAddressEvent.next(true);
                }
            });
        }
    }

    readWallet(): void {
        this.apiService.postApi("wallet/read_wallet.php", { id: this.user.mobile }).subscribe({
            next: (res: Array<Wallet>) => {
                this.user.walletHistory = res.reverse();
                this.user.wallet = res[0]?.total || 0;
                this.walletUpdateEvent.next(res);
            },
            error: (err: Error) => {
                alert("Read wallet error");
            }
        });
    }

    updateUser(params: any): Observable<any> {
        return this.apiService.postApi("user/update_user.php", params);
    }
}

export type LoginStatus = "LOGIN" | "LOGOUT";

export type Referrer = {
    referrer: string,
    referrer_name: string,
    status: number,
    coupon_desc: string
}
