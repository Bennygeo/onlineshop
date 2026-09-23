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

    rechargeAmounts: Array<string> = ["₹200", "₹500", "₹1000", "₹2000", "₹5000"];
    rechargeActiveAmtindex: number = 1;
    rechargeAmt: string = "₹500";
    rcWindowFlg: boolean = false;
    showLedgerModal: boolean = false;

    activeTab: 'all' | 'credit' | 'debit' = 'all';
    searchTerm: string = '';

    walletForm: FormGroup;
    walletTotal: number = 0;

    private unsubscribe = new Subject<void>();

    constructor(
        private fb: FormBuilder,
        public user: User,
        private loginS: LoginService,
        public cartS: CartService,
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
            this.history = this.user.walletHistory || [];
            this.walletTotal = Math.round(this.user.wallet || 0);
        });

        this.rechargeAmt = this.rechargeAmounts[this.rechargeActiveAmtindex] || "₹500";
        this.walletForm = this.fb.group({
            amount: [this.rechargeAmt, [Validators.required]],
        });

        this.walletForm.valueChanges.subscribe((res: any) => {
            this.rechargeActiveAmtindex = -1;
            for (var i = 0; i < this.rechargeAmounts.length; i++) {
                if (this.rechargeAmounts[i] === res.amount) {
                    this.rechargeActiveAmtindex = i;
                    break;
                }
            }
            this.rechargeAmt = (res.amount && res.amount.length > 1) ? res.amount : ("₹" + 0);
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
    }

    ngOnDestroy(): void {
        this.unsubscribe.next();
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
            this.rechargeAmt = amt.startsWith("₹") ? amt : ("₹" + amt);
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

    get filteredHistory(): Array<Wallet> {
        let list = this.displayedHistory || [];

        if (this.activeTab === 'credit') {
            list = list.filter(item => item.type === 'Credit');
        } else if (this.activeTab === 'debit') {
            list = list.filter(item => item.type === 'Debit');
        }

        if (this.searchTerm && this.searchTerm.trim() !== '') {
            const query = this.searchTerm.toLowerCase().trim();
            list = list.filter(item => 
                (item.description && item.description.toLowerCase().includes(query)) ||
                (item.trxn_id && item.trxn_id.toLowerCase().includes(query)) ||
                (item.amount && item.amount.toString().includes(query))
            );
        }

        return list;
    }

    get parsedRechargeAmt(): number {
        if (!this.rechargeAmt) return 0;
        const num = parseInt(this.rechargeAmt.replace(/[^0-9]/g, ''), 10);
        return isNaN(num) ? 0 : num;
    }

    get projectedBalance(): number {
        return (this.walletTotal || 0) + this.parsedRechargeAmt;
    }

    setTab(tab: 'all' | 'credit' | 'debit'): void {
        this.activeTab = tab;
    }

    toggleLedgerModal(show?: boolean): void {
        this.showLedgerModal = show !== undefined ? show : !this.showLedgerModal;
    }

    addMoneyToWallet(evt: MouseEvent) {
        if (!this.cartS.enableRazorpay) {
            alert("Online wallet recharge via Razorpay is temporarily disabled by the store administration.");
            return;
        }
        this.razorPay.initiatePaymentModal(this.user, this.rechargeAmt);
    }

    rcWindowClose() {
        this.rcWindowFlg = false;
    }

    readLastTrxn(): void {
        this.apiService.postApi("wallet/read_last.php", { id: this.user.mobile }).subscribe(res => {
            if (res && res[0]) {
                this.history.unshift(res[0]);
                this.walletTotal = Math.round(res[0].total || 0);
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
                        this.walletTotal = Math.round(orderRes.total || 0);
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


