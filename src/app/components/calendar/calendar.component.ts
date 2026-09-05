import { AfterViewChecked, Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild, ViewEncapsulation } from '@angular/core';
import { CartService } from 'src/app/services/cart.service';
import { DateE } from 'src/app/utils/custom-classes';
import { Product, ProductOptions, SubsEntry, SubsOptions } from 'src/app/utils/types';
import { DeliveryStatus } from '../subs-child-view/subs-child-view.component';
import { Utils } from 'src/app/utils/utils';
import { MatCalendar, MatCalendarCellClassFunction } from '@angular/material/datepicker';

@Component({
  selector: 'app-calendar',
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.scss',
  encapsulation: ViewEncapsulation.None
})
export class CalendarComponent implements OnChanges, AfterViewChecked {

  @ViewChild('calendar1', { static: false }) multiSelectCalendar: MatCalendar<Date>;

  @Input() data: any;
  @Output() changesEvent = new EventEmitter();

  productsOptions: ProductOptions;

  subs_options: SubsOptions = {
    units: 1,
    startDate: null,
    endDate: null,
    minDate: new DateE(),
    maxDate: new DateE(),
    type: "range",
    rangeCnt: 0,
    multiCnt: 0,
    totalPrice: 0,
    rangeSelected: [],
    multiDaySelected: []
  };

  selectedCalendarType: "undefined" | "range" | "multi_day";

  productDescFlg: boolean = false;
  afterViewInitFlg: boolean = false;

  calendarSwitchMsg: string = "";
  calendarSwitchFlg: boolean = false;
  calenderSwitchBtnName: string = "";
  firstTimeCalViewFlg: boolean = true;

  constructor(
    private cartService: CartService,
    private utils: Utils,
    private el: ElementRef
  ) {
    // this.productsOptions = this.data.productsOptions;
    // this.subs_options = this.data.subsOptions;
  }

  ngAfterViewChecked(): void {
    this.attachQuantityBadges();
  }

  attachQuantityBadges(): void {
    if (!this.el) return;
    const cells: NodeListOf<HTMLElement> = this.el.nativeElement.querySelectorAll('.mat-calendar-body-cell');
    cells.forEach((cell: HTMLElement) => {
      const match = cell.className.match(/qty-(\d+)/);
      if (match) {
        const qty = match[1];
        const qtyText = `${qty} qty`;
        const content = cell.querySelector('.mat-calendar-body-cell-content');
        if (content) {
          let badge = content.querySelector('.cell-qty-badge') as HTMLElement;
          if (!badge) {
            badge = document.createElement('span');
            badge.className = 'cell-qty-badge';
            content.appendChild(badge);
          }
          if (badge.innerText !== qtyText) {
            badge.innerText = qtyText;
          }
        }
      } else {
        const content = cell.querySelector('.mat-calendar-body-cell-content');
        if (content) {
          const badge = content.querySelector('.cell-qty-badge');
          if (badge) {
            badge.remove();
          }
        }
      }
    });
  }
  ngOnChanges(changes: SimpleChanges): void {
    this.productsOptions = this.data.productsOptions;
    this.subs_options = this.data.subsOptions;
    this.productChanges(this.productsOptions.product);
  }

  plusMinusSubsValue(val: number): void {
    this.subs_options.units = val;

    //update the subscribed units to every entry
    if (this.subs_options.type == "range") {
      this.subs_options.rangeSelected.map((entry: SubsEntry) => {
        entry.count = val
      });
    }
    if (this.subs_options.type == "multi_day") {
      this.subs_options.multiDaySelected.map((entry: SubsEntry) => {
        entry.count = val
      });
    }

    this.cartService.cartUpdateEvent.next({ cart: this.cartService.cartProducts, product: this.productsOptions.product, unit: val });
  }

  productChanges(product: Product) {
    this.productsOptions.product = product;
    if (!this.productsOptions.product['updated_weight']) {
      this.productsOptions.product['updated_weight'] = this.productsOptions.product['weight'] || 1;
    }

    //reset the local object
    this.subs_options = {
      units: product.units,
      startDate: null,
      endDate: null,
      minDate: new DateE(),
      maxDate: new DateE(),
      type: "range",
      rangeCnt: 0,
      multiCnt: 0,
      multiDaySelected: [],
      rangeSelected: []
    };

    this.subs_options = (this.productsOptions.product.subs_options) ? this.productsOptions.product.subs_options : this.subs_options;
    if (this.subs_options.startDate && this.subs_options.startDate) {
      this.subs_options.rangeCnt = DateE.dateDiff(this.cartService.deliveryDate, this.subs_options.endDate);
    }
    //get the count of selected days
    this.subs_options.multiCnt = this.subs_options.multiDaySelected.length || 0;
    this.subs_options.rangeCnt = this.subs_options.rangeSelected.length || 0;

    this.productsOptions.product['max_days'] = Number(this.productsOptions.product['max_days']);
    //update calendar
    this.subs_options.minDate = new DateE();
    this.subs_options.maxDate = new DateE();
    this.subs_options.minDate.addDays(1);
    this.subs_options.maxDate.addDays(this.productsOptions.product['max_days'] || 30);
    //render buttons, and it should triggered after the popup has been updated, since element creation happening inside the popup
    window.setTimeout(() => {
      this.subscribeCalendarSelection(this.subs_options.type || "range");
    });
  }


  subscribeCalendarSelection(type: "undefined" | "range" | "multi_day"): void {
    this.selectedCalendarType = type;
    const showAlert = () => {
      this.calendarSwitchFlg = true;
      this.calendarSwitchMsg = `You are navigating from <b>${(type == 'multi_day' ? 'Date Range' : 'Custom Dates')}</b> selection to <b>${(type !== 'multi_day' ? 'Date Range' : 'Custom Dates')}</b> selection. All the dates selected in <b>${(type === 'multi_day' ? 'Date Range' : 'Custom Dates')}</b> will be removed. <br><br>Are you sure you want to proceed?"`;
      this.calenderSwitchBtnName = `Goto <b>${(type === 'multi_day' ? 'Custom Dates' : 'Date Range')}</b>`;
    }

    const validFlg = this.firstTimeCalViewFlg === false && type;
    if (type === "range" && validFlg && this.subs_options.multiDaySelected.length > 0) showAlert();
    else if (type == "multi_day" && validFlg && this.subs_options.rangeSelected.length > 0) showAlert();
    else {
      if (type) this.subs_options.type = type;
      this.alertGotoAction();
    }

    if (this.firstTimeCalViewFlg) this.alertGotoAction();
  }

  alertGotoAction() {
    if (this.selectedCalendarType) {
      this.selectedCalendarType = (this.selectedCalendarType === "undefined") ? "range" : this.selectedCalendarType;
      this.subs_options.type = this.selectedCalendarType;
      if (this.subs_options.type === "range") {
        if (!this.firstTimeCalViewFlg) {
          this.subs_options.multiDaySelected = [];
          this.subs_options.multiCnt = 0;
        }
        this.utils.css("#range", { 'background-color': "#1bbc9d", 'color': "#ffffff" });
        this.utils.css("#custom", { 'background-color': "#dddddd", 'color': "#999999" });
      } else if (this.subs_options.type == "multi_day") {
        if (!this.firstTimeCalViewFlg) {
          this.subs_options.rangeSelected = [];
          this.subs_options.rangeCnt = 0;
        }
        this.utils.css("#custom", { 'background-color': "#1bbc9d", 'color': "#ffffff" });
        this.utils.css("#range", { 'background-color': "#dddddd", 'color': "#999999" });
      } else {
        throw new Error("Error code:CUSTOM - Calendar type not found!");
      }
      this.firstTimeCalViewFlg = false;
      this.calendarSwitchFlg = false;
    }
  }


  //Multi-day calender
  isSelected: MatCalendarCellClassFunction<Date> = (cellDate, view) => {
    const date = cellDate.getFullYear() + "-" + ("00" + (cellDate.getMonth() + 1)).slice(-2) + "-" + ("00" + cellDate.getDate()).slice(-2);
    if (this.subs_options.type == "multi_day") {
      let cls = '';
      const entry = this.subs_options.multiDaySelected?.find(x => x.date == date);
      if (cellDate.getDay() === 0 || cellDate.getDay() === 6) {
        cls = ((entry ? "selected" : null) == null) ? 'week-ends' : 'selected';
      } else {
        cls = entry ? "selected" : null;
      }
      if (cls === 'selected' && entry) {
        const qty = entry.count || this.subs_options.units || 1;
        cls += ` has-qty qty-${qty}`;
      }
      return cls;
    } else if (this.subs_options.type == "range") {
      let cls = '';
      let qty = 0;
      this.subs_options.rangeSelected?.find((x, index) => {
        if (x.date == date) {
          qty = x.count || this.subs_options.units || 1;
          if (index == 0) {
            cls = "firstChild";
          } else if (this.subs_options.rangeSelected.length > 1 && index != this.subs_options.rangeSelected.length - 1) {
            cls = "square";
          } else {
            cls = "lastChild";
          }
        }
      });
      if (cls && qty > 0) {
        cls += ` has-qty qty-${qty}`;
      }
      return cls;
    }
    return null;
  };


  alternateDays() {
    this.subs_options.multiDaySelected = [];
    this.subs_options.multiDaySelected = DateE.getAlternateDays(this.subs_options.minDate, this.subs_options.maxDate);
    this.updateMultiSelectCalendar();
  }

  weekEnds() {
    this.subs_options.multiDaySelected = [];
    this.subs_options.multiDaySelected = DateE.getWeekEnds(this.subs_options.minDate, this.subs_options.maxDate);
    this.updateMultiSelectCalendar();
  }

  weekDays() {
    this.subs_options.multiDaySelected = [];
    this.subs_options.multiDaySelected = DateE.getWeekDays(this.subs_options.minDate, this.subs_options.maxDate);
    this.updateMultiSelectCalendar();
  }



  updateMultiSelectCalendar() {
    this.productsOptions.product['subs_options'] = this.subs_options;
    this.multiSelectCalendar.updateTodaysDate();

    //get the count of selected days
    this.subs_options.multiCnt = this.subs_options.multiDaySelected.length;
    const unitPrice = Number(this.productsOptions.product.price || 0);
    const qty = Number(this.subs_options.units || 1);
    this.subs_options.price = (unitPrice * qty * this.subs_options.multiCnt).toString();

    //copying to product object
    this.productsOptions.product['subs_options'] = this.subs_options;
    this.updateChildComponent();
  }

  /*
  * Multi day select handler 
  */
  select(event: any, calendar: any) {
    this.subs_options.type = "multi_day";
    this.subs_options.units = this.subs_options.units * 1 || 1;

    const date = event.getFullYear() + "-" + ("00" + (event.getMonth() + 1)).slice(-2) + "-" + ("00" + event.getDate()).slice(-2);
    const index = this.subs_options.multiDaySelected.findIndex(x => x.date == date);
    if (index < 0) this.subs_options.multiDaySelected.push({
      date: date,
      count: this.subs_options.units,
      status: DeliveryStatus.SHEDULED,
      price: Number(this.productsOptions.product.price),
      totalPrice: Number(this.productsOptions.product.price) * this.subs_options.multiDaySelected.length
    });
    else this.subs_options.multiDaySelected.splice(index, 1);

    //get the count of selected days
    this.subs_options.multiCnt = this.subs_options.multiDaySelected.length;
    const unitPrice = Number(this.productsOptions.product.price || 0);
    const qty = Number(this.subs_options.units || 1);
    this.subs_options.price = (unitPrice * qty * this.subs_options.multiCnt).toString();

    calendar.updateTodaysDate();

    //copying to product object
    this.productsOptions.product['subs_options'] = this.subs_options;
    this.updateChildComponent();

  }

  rangeChange(event, calendar: any): void {
    this.subs_options.type = "range";
    this.subs_options.units = this.subs_options.units * 1 || 1;

    const date = event.getFullYear() + "-" + ("00" + (event.getMonth() + 1)).slice(-2) + "-" + ("00" + event.getDate()).slice(-2);
    const index = this.subs_options.rangeSelected.findIndex(x => x.date == date);

    if (this.subs_options.rangeSelected.length > 0) {
      //Remove the date if it is aleready selected
      const diff = DateE.dateDiff(new Date(this.subs_options.rangeSelected[0].date), new Date(date));

      if (diff < 0) {
        // alert("Please select a future date from the selected date.");
        this.subs_options.rangeSelected = [];
        this.subs_options.rangeSelected.push({
          date: date,
          count: this.subs_options.units,
          status: DeliveryStatus.SHEDULED,
          price: Number(this.productsOptions.product.price),
          totalPrice: Number(this.productsOptions.product.price) * this.subs_options.rangeSelected.length
        });
      }

      if (index === 0) {
        // this.subs_options.rangeSelected.splice(index, 1);
        this.subs_options.rangeSelected = [];
      }

      if (diff > 0) this.subs_options.rangeSelected = DateE.getDaysBetween(new Date(this.subs_options.rangeSelected[0].date), new Date(date),
        {
          count: this.subs_options.units,
          status: DeliveryStatus.SHEDULED,
          price: Number(this.productsOptions.product.price),
          totalPrice: Number(this.productsOptions.product.price) * this.subs_options.rangeSelected.length
        });


    } else {
      const index = this.subs_options.rangeSelected.findIndex(x => x.date == date);
      if (index < 0) this.subs_options.rangeSelected.push({
        date: date,
        count: this.subs_options.units,
        status: DeliveryStatus.SHEDULED,
        price: Number(this.productsOptions.product.price),
        totalPrice: Number(this.productsOptions.product.price) * this.subs_options.rangeSelected.length
      });
      else this.subs_options.rangeSelected.splice(index, 1);
    }
    this.subs_options.rangeCnt = this.subs_options.rangeSelected.length;
    const unitPrice = Number(this.productsOptions.product.price || 0);
    const qty = Number(this.subs_options.units || 1);
    this.subs_options.price = (unitPrice * qty * this.subs_options.rangeCnt).toString();

    calendar.updateTodaysDate();
    this.productsOptions.product['subs_options'] = this.subs_options;
    this.updateChildComponent();
  }

  /*
  * To update product component
  */
  updateChildComponent() {
    this.productsOptions.product['changeInProduct'].next(this.productsOptions.product);
  }

  clearSubscription() {
    this.cartService.cartUpdateEvent.next({ cart: this.cartService.cartProducts, product: this.productsOptions.product, unit: 0 });
    this.subs_options = {
      units: 0,
      multiDaySelected: [],
      rangeSelected: [],
      type: 'undefined',
      price: "0",
      totalPrice: 0
    }
    this.productsOptions.product.subs_options = this.subs_options;
    this.productsOptions.product.subscribe = false;
    this.updateChildComponent();
  }

  alertCancelAction() {
    this.calendarSwitchFlg = false;
  }

  subscribeAction() {
    //to close the modal
    this.changesEvent.emit("close");
  }
}
