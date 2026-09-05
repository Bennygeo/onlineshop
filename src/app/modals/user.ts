import { Address, Wallet } from "../utils/types";
import { GeoLocation } from "./geo-location";

export class User {
    private userName: string = "xxxx";
    private userEmail: string = "xxxxx@xxxx.xxx";
    private userMobile: string = "xxxxxxxxxx";
    private userAltMobile: string;
    private userAddresses: Array<Address> = [];
    private userAddress: Address;
    private userPincode: string;
    private gpsInfo: GeoLocation = new GeoLocation();
    private walletAmt: number = 0;
    private walletHistoryAry: Array<Wallet> = [];
    private userOrderID: string;
    private userOrderHistory: Array<any> = [];
    private productZone: string = "zone1";
    private referralID: string = "XXXXXX";

    //User name set
    public set name(name: string) {
        this.userName = name;
    }
    //User name get
    public get name(): string {
        return this.userName;
    }
    //User mail set
    public set mail(email: string) {
        this.userEmail = email;
    }
    //User mail get
    public get mail(): string {
        return this.userEmail;
    }
    //User mobile set
    public set mobile(mobile: string) {
        this.userMobile = mobile;
    }
    //User mobile get
    public get mobile(): string {
        return this.userMobile;
    }

    //User mobile set
    public set alternateMobile(mobile: string) {
        this.userAltMobile = mobile;
    }
    //User mobile get
    public get alternateMobile(): string {
        return this.userAltMobile;
    }

    //User address set
    public set address(address: Address) {
        this.userAddress = address;
    }
    //User address get
    public get address(): Address {
        return this.userAddress;
    }

    //to set all addresses
    public set addresses(_addr: Array<Address>) {
        this.userAddresses = _addr;
    }

    //to get alll addresses
    public get addresses() {
        return this.userAddresses;
    }

    //User pincode set
    public set pincode(pincode: string) {
        this.userPincode = pincode;
    }
    //User pincode get
    public get pincode(): string {
        return this.userPincode;
    }

    public set zone(zone: string) {
        this.productZone = zone;
    }

    public get zone(): string {
        return this.productZone;
    }
    //GPS info
    public set GPSInfo(gps: GeoLocation) {
        this.gpsInfo = gps;
    }
    public get GPSInfo(): GeoLocation {
        return this.gpsInfo;
    }

    private ledgerAmt: number = 0;

    public set wallet(amt: number) {
        this.walletAmt = amt;
    }

    public get wallet(): number {
        return this.walletAmt;
    }

    public set ledger(amt: number) {
        this.ledgerAmt = amt;
    }

    public get ledger(): number {
        return this.ledgerAmt;
    }

    public set walletHistory(list: Array<Wallet>) {
        this.walletHistoryAry = list;
    }

    public get walletHistory(): Array<Wallet> {
        return this.walletHistoryAry;
    }

    public set orderID(orderID: string) {
        this.userOrderID = orderID;
    }

    public get orderID() {
        return this.userOrderID;
    }

    public set orderHistory(history: Array<any>) {
        this.userOrderHistory = history;
    }

    public get orderHistory() {
        return this.userOrderHistory;
    }

    public set referralId(id: string) {
        this.referralID = id;
    }

    public get referralId(): string {
        return this.referralID;
    }
}


