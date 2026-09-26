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

    defaultPincode: string = "400071";

    //to show popup from the app component by triggering from home module
    popupEvent: BehaviorSubject<PopupType> = new BehaviorSubject<PopupType>({ flag: false, msg: "" });

    walletUpdateEvent: BehaviorSubject<Array<Wallet>> = new BehaviorSubject<Array<Wallet>>([]);

    queryParams: any = {};

    referrrarinfo: Referrer = {
        coupon_desc: "",
        referrer: '',
        referrer_name: '',
        status: 0
    };

    constructor(
        private apiService: ApiService,
        private storageS: StorageService
    ) {
        const savedRef = this.storageS.getItem('user_referral_info');
        if (savedRef) {
            try {
                const parsed = JSON.parse(savedRef);
                if (parsed && parsed.referrer && parsed.referrer !== 'xxxx') {
                    this.referrrarinfo = parsed;
                }
            } catch (e) {}
        }

        let localVal = atob(this.storageS.getItem('login') || "");
        if (localVal.length === 10) {
            this.userStatus = "LOGIN";
            this.user.mobile = localVal;
            this.loginChangeEvent.next(Common.loginStatus.LOGIN);
            this.loginPromptEvent.next(false);

            this.readWallet();
            this.readAddress();
            this.readUser().subscribe({
                next: (res: any) => {
                    if (res && res.length > 0 && res[0].referred_by && res[0].referred_by !== 'xxxx') {
                        if (!this.referrrarinfo || !this.referrrarinfo.referrer || this.referrrarinfo.referrer === 'xxxx') {
                            this.setReferralInfo({
                                referrer: res[0].referred_by,
                                referrer_name: 'Partner ' + res[0].referred_by,
                                coupon_desc: '25% OFF applied to your account!',
                                status: 1
                            });
                        }
                    }
                }
            });

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
            if (res && res.length > 0) {
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

    setReferralInfo(info: Referrer) {
        if (!info) return;
        this.referrrarinfo = info;
        try {
            this.storageS.setItem('user_referral_info', JSON.stringify(info));
        } catch (e) {}
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
            const cachedKey = 'tnk_user_addrs_' + this.user.mobile;
            const cachedRaw = this.storageS.getItem(cachedKey);
            let cachedList: Array<Address> = [];
            if (cachedRaw) {
                try { cachedList = JSON.parse(cachedRaw); } catch (e) {}
            }

            this.apiService.postApi("user/read_address.php", { id: this.user.mobile }, true).subscribe({
                next: (res: Array<Address>) => {
                    const addresses = (res && Array.isArray(res) && res.length > 0) ? res : cachedList;
                    if (addresses && addresses.length > 0) {
                        let hasActive = false;
                        addresses.forEach((item) => {
                            if (item.default == 1 || item['is_default'] == 1 || item.active == 1) {
                                item.active = 1;
                                this.user.address = item;
                                this.user.pincode = item.pincode;
                                hasActive = true;
                            } else {
                                item.active = 0;
                            }
                        });
                        if (!hasActive && addresses.length > 0) {
                            addresses[0].active = 1;
                            this.user.address = addresses[0];
                            this.user.pincode = addresses[0].pincode;
                        }
                        this.user.addresses = addresses;
                        this.storageS.setItem(cachedKey, JSON.stringify(addresses));
                        this.noAddressEvent.next(false);
                        this.addressChangeEvent.next(AddressAction.READ);
                    } else {
                        this.user.addresses = [];
                        this.user.address = null;
                        this.noAddressEvent.next(true);
                    }
                },
                error: () => {
                    if (cachedList && cachedList.length > 0) {
                        this.user.addresses = cachedList;
                        this.user.address = cachedList[0];
                        this.user.pincode = cachedList[0].pincode;
                        this.noAddressEvent.next(false);
                        this.addressChangeEvent.next(AddressAction.READ);
                    } else {
                        this.user.addresses = [];
                        this.user.address = null;
                        this.noAddressEvent.next(true);
                    }
                }
            });
        }
    }

    readWallet(): void {
        this.apiService.postApi("wallet/read_wallet.php", { id: this.user.mobile }, true).subscribe({
            next: (res: Array<Wallet>) => {
                if (res && Array.isArray(res)) {
                    this.user.walletHistory = res.reverse();
                    this.user.wallet = Math.round(res[0]?.total || 0);
                    this.user.ledger = Math.round((res[0] as any)?.ledger_balance || 0);
                    this.walletUpdateEvent.next(res);
                }
            },
            error: (err: Error) => {
            }
        });
    }

    impersonateCustomer(mobile: string, name: string = 'Customer', adminUsername: string = 'Admin'): void {
        this.storageS.setItem('login', btoa(mobile));
        const adminModeData = {
            active: true,
            customerMobile: mobile,
            customerName: name,
            adminUsername: adminUsername,
            startedAt: new Date().toISOString()
        };
        this.storageS.setItem('tnkspt_admin_mode', adminModeData);
        this.userStatus = 'LOGIN';
        this.user = new User();
        this.user.mobile = mobile;
        this.user.name = name;
        this.loginChangeEvent.next(Common.loginStatus.LOGIN);
        this.loginPromptEvent.next(false);
        this.readWallet();
        this.readAddress();
        this.readUser().subscribe((res: any) => {
            if (res && res.length > 0) {
                this.user.referralId = res[0].referral_id;
                if (res[0].name) {
                    this.user.name = res[0].name;
                }
            }
        });
    }

    getAdminMode(): { active: boolean; customerMobile: string; customerName: string; adminUsername: string; startedAt: string } | null {
        try {
            const raw = this.storageS.getItem('tnkspt_admin_mode');
            if (!raw) return null;
            return typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch (e) {
            return null;
        }
    }

    exitAdminMode(): void {
        this.storageS.removeItem('tnkspt_admin_mode');
        this.logoutEvent.next();
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
