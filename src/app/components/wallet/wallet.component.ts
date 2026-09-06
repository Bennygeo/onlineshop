import { animate, style, transition, trigger } from '@angular/animations';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { Payment } from 'src/app/modal/payment';
import { User } from 'src/app/modals/user';
import { ApiService } from 'src/app/services/api.service';
import { CartService } from 'src/app/services/cart.service';
import { LoginService } from 'src/app/services/login.service';
import { RazorpayService } from 'src/app/services/razorpay.service';
import { Wallet } from 'src/app/utils/types';

@Component({
    selector: 'app-wallet',
    templateUrl: './wallet.component.html',
    styleUrls: ['./wallet.component.scss'],

    animations: [
        trigger('fadeInOut', [
            transition(':enter', [   // :enter is alias to 'void => *'
                style({ opacity: 0 }),
                animate(100, style({ opacity: 1 }))
            ]),
            transition(':leave', [   // :leave is alias to '* => void'
                animate(200, style({ opacity: 0 }))
            ])
        ])
    ]
})
export class WalletComponent implements OnInit, OnDestroy {

    history: Array<Wallet> = [];

    rechargeAmounts: Array<string> = ["₹100", "₹500", "₹1000", "₹5000"];
    rechargeActiveAmtindex: number = 0;
    rechargeAmt: string = "₹0";
    rcWindowFlg: boolean = false;

    walletForm: FormGroup;
    walletTotal: number = 0;

    private unsubscribe = new Subject<void>();

    constructor(
        private fb: FormBuilder,
        public user: User,
        private loginS: LoginService,
        private cartS: CartService,
        private razorPay: RazorpayService,
        private apiService: ApiService,
        private payment: Payment,
        private cdr: ChangeDetectorRef,
        private activatedRoute: ActivatedRoute,
    ) {

        this.user = this.loginS.user;

        this.payment = new Payment();

        this.cartS.headerChangeEvent.next("type2");

        this.loginS.walletUpdateEvent.subscribe((res) => {
            this.user = this.loginS.user;
            this.history = this.user.walletHistory;
            this.walletTotal = this.user.wallet;
        });

        this.rechargeAmt = this.rechargeAmounts[this.rechargeActiveAmtindex];
        this.walletForm = this.fb.group({
            amount: [this.rechargeAmt, [
                Validators.required]],
        });

        this.walletForm.valueChanges.subscribe((res: any) => {
            this.rechargeActiveAmtindex = -1;
            for (var i = 0; i < this.rechargeAmounts.length; i++) {
                if (this.rechargeAmounts[i] === res.amount) {
                    this.rechargeActiveAmtindex = i;
                    break;
                }
            }
            this.rechargeAmt = (res.amount.length > 1) ? res.amount : ("₹" + 0);
        });

        this.razorPay.changeEvent.pipe(
            takeUntil(this.unsubscribe)
        ).subscribe({
            next: (res: any) => {
                switch (res.split("#")[0]) {
                    case this.payment.PaymentStaus.AUTHORIZED:
                        this.readLastTrxn();
                        break;

                    case this.payment.PaymentStaus.FAILED:
                        this.readLastTrxn();
                        break;

                    case this.payment.PaymentStaus.CANCELLED:
                        this.readLastTrxn();
                        break;

                    case this.payment.PaymentStaus.PENDING:
                        this.readLastTrxn();
                        break;
                }
            },
            error: (err: Error) => {

            }
        });
        // this.loginS.readWallet();
    }
    ngOnDestroy(): void {
        // Emit something to stop all Observables
        this.unsubscribe.next();
        // Complete the notifying Observable to remove it
        this.unsubscribe.complete();
    }

    ngOnInit(): void {
        let loadingEl = document.getElementById("loading");
        if (loadingEl)
            loadingEl.remove();

        this.loginS.readWallet();

        this.activatedRoute.queryParams.subscribe((params: any) => {
            if (params['pay']) {
                this.rcWindowFlg = true;
                this.rcOptionClickAction(params['pay']);
            }
        });
    }

    rcOptionClickAction(amt: string): void {
        this.rechargeActiveAmtindex = this.rechargeAmounts.indexOf(amt);
        if (this.rechargeActiveAmtindex === -1) {
            this.rechargeAmt = "₹" + amt;
        } else {
            this.rechargeAmt = amt;
        }

        this.walletForm.controls["amount"].setValue(this.rechargeAmt);
    }

    showAllHistory: boolean = false;

    isWithinLast5Days(timestamp: number): boolean {
        if (!timestamp) return true;
        const fiveDaysInMillis = 5 * 24 * 60 * 60 * 1000;
        return (Date.now() - timestamp) <= fiveDaysInMillis;
    }

    get displayedHistory(): Array<Wallet> {
        if (this.showAllHistory) {
            return this.history;
        }
        const recent = this.history.filter(item => this.isWithinLast5Days(item.timestamp));
        return recent.length > 0 ? recent : this.history;
    }

    addMoneyToWallet(evt: MouseEvent) {
        this.razorPay.initiatePaymentModal(this.user, this.rechargeAmt);
    }

    rcWindowClose() {
        this.rcWindowFlg = !this.rcWindowFlg;
    }

    readLastTrxn(): void {
        this.apiService.postApi("wallet/read_last.php", { id: this.user.mobile }).subscribe(res => {
            if (res && res[0]) {
                this.history.unshift(res[0]);
                this.walletTotal = res[0].total;
                this.loginS.user.wallet = this.walletTotal;
                this.loginS.user.walletHistory = this.history;
            }

            this.rcWindowFlg = false;
            this.loginS.readWallet();

            const lastStatus = (res && res[0] && res[0].status) ? res[0].status.toLowerCase() : '';
            const isSuccessTx = res && res[0] && 
                (lastStatus === 'authorized' || lastStatus === 'captured' || lastStatus === 'success') &&
                (res[0].type === 'Credit' || res[0].type === 'CREDIT');

            if (res && res[0] && this.cartS.payAndCheckoutFlg) {
                if (isSuccessTx) {
                    this.cartS.placeOrder((orderRes: Wallet) => {
                        this.history.unshift(orderRes);
                        this.walletTotal = orderRes.total;
                        this.loginS.user.wallet = this.walletTotal;
                        this.loginS.user.walletHistory = this.history;
                        this.cartS.payAndCheckoutFlg = false;
                        this.cartS.router.navigate(["/products/cart"]);
                    });
                } else {
                    this.cartS.payAndCheckoutFlg = false;
                    alert("Payment was not completed or was cancelled. Order could not be placed.");
                }
            }

            if (res && res[0] && this.cartS.editSubsPaymentTrack && isSuccessTx) {
                this.cartS.router.navigate(["/home/orders"]);
            }
            this.cdr.detectChanges();
        });
    }
}


