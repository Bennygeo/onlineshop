import { Subject } from "rxjs";
import { DateE } from "./custom-classes";
import { DeliveryStatus } from "../components/subs-child-view/subs-child-view.component";
import { UserCoupon } from "../services/coupon.service";

export class Types {

}

export type Product = {
    name: string;
    tamil_name: string;

    id: string;
    main_category: string;
    sub_category: string;

    whole_sale_price: number;
    profit_percent: number;
    show_off_percent: number;

    price: number | string;
    total_price: number | string;
    original_price: number | string;
    offer_percentage?: number;

    original_weight: number;
    weight: number;
    updated_weight?: number;

    img_url: string;

    base_unit: number;
    units: number;
    updated_units?: number;

    original_unit_name: string;
    //may change after quantity changes (ex. grams to kg)
    unit_name: string;

    //to order the products
    index: number;

    offer: number;

    disabled: boolean;
    cat?: string;

    packing_charges: number;
    delivery_charges: number;

    delivery_day?: number;
    delivery_date?: DateE;
    delivery_date_enhanced?: string;
    postponed?: number;
    time_limit?: number;

    //for subscriptions
    min_days?: number;
    max_days?: number;

    //for improved search
    tags?: Array<string>;

    badge?: string;
    badge_txt?: string;

    subscribe?: boolean;
    subscribeFlg?: boolean;
    subscribe_flg?: number;

    changeInProduct?: Subject<Product>;

    subs_options?: SubsOptions;

    //Check weather the product available for the current zone
    zoneAvailability?: boolean;
}

//Subscription Options
export type SubsOptions = {
    units: number;
    startDate?: DateE;
    endDate?: DateE;
    minDate?: DateE;
    maxDate?: DateE;
    type?: 'range' | 'multi_day' | 'undefined';
    rangeCnt?: number;
    multiCnt?: number;
    price?: string;
    totalPrice?: number;
    rangeSelected?: Array<SubsEntry>;
    multiDaySelected?: Array<SubsEntry>;
}
export type SubsEntry = {
    date: string;
    count: number;
    modifiedCount?: number,
    status?: DeliveryStatus,
    price?: number,
    totalPrice?: number
}

//Cart Object
export type CartType = {
    [key: string]: Product,
}

//Hold the all cart products and the target product
export type CartAndTarget = {
    cart: CartType,
    product?: Product,
    unit?: number,
    info?: string,
    type?: string
}

export type CartDetails = {
    total: number;
    totalItems: number;
    cartAction?: () => {}
}

/*
* To get a structured product object
*/
export type ProductType = {
    [cat: string]: SubProductType;
}

export type SubProductType = {
    [sub_cat: string]: {
        products: Array<Product>,
        index?: number
    };
}

export type DescriptionOptions = {
    defaultMsg: string;
    productname?: string;
    imgurl?: string;
    id?: string;
    shortdesc?: string;
    shortdesctitle?: string;

    longdesc1?: string;
    longdesc1title?: string;
    longdesc2?: string;
    longdesc2title?: string;
    longdesc3?: string;
    longdesc3title?: string;

    loadingstatus: boolean;

    descClickHandler?: (evt: MouseEvent) => void;
}

export type Status = "CART" | "PLACED" | "DELIVERED" | "CANCELLED" | "REFUNDED" | "RESHEDULED";
//sql structure #order_main
export type OrderMainTable = {
    orderID: string,
    mobile: string,
    createdAt: number,
    modifiedAt: number,
    packedBy: string,
    deliveredBy: string,
    deliveredAt: number,
    assignedTo: string,
    status: Status,
    address: string,
    orderTotal: number,
    procuredTotal: number,
    paymentID: string,
    paymentStatus: string
}

//sql structure of placed|cart product structure
export type CartProductTable = {
    orderID: string,
    productID: string,
    price: number,
    originalPrice: number,
    oferPrice: number,
    modifiedAt: number,
    status: Status,
    modifiedBy: string,
    quantity: number,
    weight: number,
    unitName: string,
    packedBy: string
    deliveredBy: string,
    resheduleDesc: string,
    refundDesc: string,
    deliveryDate: DateE,
    subscribedQuantity?: number,
    subscribedDates?: Array<string>,
    rangeDates?: Array<string>,
    startDate?: DateE | string,
    endDate?: DateE | string,
    subscriptionType?: 'range' | 'multi_day' | 'undefined',
    subsStatus: "active" | "paused",
    pausedDates: string
}

export type Banner = {
    index: number,
    routeUrl: string,
    bgClr: string,
    title: string,
    desc: string
}

export type menuOptions = {
    //Catogory menu
    list: Array<string>;
    activeMenu?: string;
    activeClr?: string;
    defaultMenu?: string;
    menuClickHandler?: (menu: string, evt?: MouseEvent) => void;
    /*
   * Sub categories based on categories
   * Rendered when select a particular category
   */
    subCategoryList?: Array<string>;
    /*
    * Used for generate css id for html sub category menu elements
    * Sub category names has space in-between, so we can't assign as css id name, that's keeping a seperate array named subCategoryListID.
    */
    subCategoryListID?: Array<string>;
    activeSubMenu?: string;
    defaultSubMenu?: string;
    subMenuClickHandler?: (menu: string, evt: MouseEvent) => void;
}

export type renderOptions = {
    //products based on selected category
    productsCategoryWise: SubProductType;
    //Sub categories based on selected category
    subCategories: Array<string>;
}

export type ProductOptions = {
    //Contains all products from the database
    products: Array<Product>;

    //products based on selected category
    productsCategoryWise: SubProductType;

    //Contians individual product item
    product?: Product;

    //Products loading flag
    loadingFlg?: boolean;

    //Structured object
    Products_test?: ProductType;

    Subs_test?: SubProductType;

}

export enum AddressAction {
    SWITCH = "switch",
    UPDATE = "update",
    INSERT = "insert",
    DELETE = "delete",
    READ = "read",
    //if address zone is same when switching the address
    SAME = "same"
}

export type CartDateWise = {
    [key: string]: Product[]
}

export type OrderInfo = {
    //Total amout of the order including delivery charge and others
    total: number,
    //Total amout of the order excluding other charges
    subTotal: number,
    //TOtal cart items count
    totalItemsCount: number,
    //total delivery charges
    totalDeliveryCharges: number,
    //All cart products
    cart: CartType,
    //Tax and fees
    taxAndFees: number,

    remainingToPay: number,
    cartProductDateWise: CartDateWise,
    subscribedItems: Array<Product>,
    selectedCoupon: UserCoupon
}

export interface WindowSize {
    width: number;
    height: number;
}



export interface Address {
    id: number;
    mobile: string;
    address: string;
    email: string;
    name: string;
    pincode: string;
    //default address chosen by customer incase customer have multiple address
    default: number;
    gps: GeoLoc;
    /**
     * Optional
     */
    alt_mobile?: string;
    title?: string;
    active?: number;
}

export type GeoLoc = {
    lat: number;
    lng: number;
}

/**
 * Database responses from DB
 */
export const ADDRESS = {
    EXCEEDED: "Exceeded",
    ADDED: "Added"
}

export interface Wallet {
    type: "Credit" | "Debit";
    amount: number;
    total: number;
    timestamp: number;
    description: string;
    trxn_id: string;
    trxn_type?: "Account" | "Ledger";
    id?: string;
    mobile?: string;
    status?: string;
}

export interface UserLoginStatus {
    status: "LOGIN" | "LOGOUT";
}

export interface PopupType {
    flag: boolean;
    msg: string;
}

export interface UserType {
    name: string;
    mobile: string;
    defaultAddressID: number;
    email?: string;
    referralCode?: string
}