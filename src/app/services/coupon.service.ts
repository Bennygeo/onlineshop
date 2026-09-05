import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CouponService {

  couponEvent = new BehaviorSubject<Array<Coupon>>(undefined);

  coupons: Coupons = {
    master: [],
    users: [],
    msg: "",
    couponExistFlg: false,
    addedFlg: false
  }

  selectedCoupon: UserCoupon = undefined;

  constructor(private api: ApiService) {
    this.getCoupons().subscribe((coupons: any) => {
      if (coupons === "NOT_EXIST") {
        this.coupons.msg = "Not exist or expired!";
      } else {
        this.coupons.msg = "Great!";
        this.coupons.master = coupons;
      }
    });

  }

  getCoupons(): Observable<any> {
    return this.api.postApi('coupon/master_coupons.php');
  }

  getUserCoupons(data): Observable<any> {
    return this.api.postApi('coupon/user_coupons.php', { data: JSON.stringify(data) });
  }

  writeUserCoupon(data): Observable<any> {
    return this.api.postApi('coupon/write_user_coupon.php', { data: JSON.stringify(data) });
  }

  updateUserCoupon(data): Observable<any> {
    return this.api.postApi('coupon/update_user_coupon.php', { data: JSON.stringify(data) });
  }

}

type Coupon = {
  code: string;
  description: string;
  percentage: string;
  required: number;
  expiry: Date;
  timestamp?: number;
}

export type MasterCouponType = {
  code: string;
  categories: string;
  count: number;
  description: string;
  offer: string;
  offer_desc: string;
  expiry_date: Date;
  created_at?: Date;
}

export type Coupons = {
  master: Array<MasterCouponType>;
  users: Array<UserCoupon>,
  msg: string,
  couponExistFlg?: boolean;
  addedFlg?: boolean;
  invalidFlg?: boolean;
}

export type UserCoupon = {
  mobile: string;
  code: string;
  count: number;
  used_count: number;
  history: string;
  expiry_date: Date;
  created_at: Date;
  last_used: Date;
  description: string;
  offer: string;
}


