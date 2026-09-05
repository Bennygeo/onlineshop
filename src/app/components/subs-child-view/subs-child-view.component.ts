import { AfterViewChecked, Component, ElementRef, Input, OnChanges, OnInit, SimpleChanges, ViewEncapsulation } from '@angular/core';
import { MatCalendarCellClassFunction } from '@angular/material/datepicker';
import { DateE } from 'src/app/utils/custom-classes';
import { SubsOptions } from 'src/app/utils/types';
import { DateAdapter } from '@angular/material/core';
import { CustomAdaptor } from 'src/app/utils/custom-adaptor';

@Component({
  selector: 'app-subs-child-view',
  templateUrl: './subs-child-view.component.html',
  styleUrl: './subs-child-view.component.scss',
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: DateAdapter, useClass: CustomAdaptor }]
})
export class SubsChildViewComponent implements OnInit, OnChanges, AfterViewChecked {

  @Input() data: any;

  subs_options: SubsOptions = {
    units: 1,
    startDate: null,
    endDate: null,
    minDate: new DateE(),
    maxDate: new DateE(),
    type: "range",
    rangeCnt: 0,
    multiCnt: 0,
    rangeSelected: [],
    multiDaySelected: []
  }

  constructor(private el: ElementRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    this.subs_options.minDate = new DateE();
    this.subs_options.maxDate = new DateE();
    this.subs_options.minDate.addDays(1);
    this.subs_options.maxDate.addDays(30);
  }
  ngOnInit(): void {

    if (this.data.subscriptionType === "range") {
      this.subs_options.type = "range";
      this.subs_options.rangeSelected = JSON.parse(this.data.rangeDates);
    } else if (this.data.subscriptionType === "multi_day") {
      this.subs_options.type = "multi_day";
      this.subs_options.multiDaySelected = JSON.parse(this.data.subscribedDates);
    }
    else this.subs_options.type = 'undefined';
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

  select(evt, calendar) {

  }

  isSelected: MatCalendarCellClassFunction<Date> = (cellDate, view) => {
    let cls = null;
    if (this.subs_options.type == "multi_day") {
      cls = this.updateCalendarStatus(cellDate, this.subs_options.multiDaySelected);
    } else if (this.subs_options.type == "range") {
      cls = this.updateCalendarStatus(cellDate, this.subs_options.rangeSelected);
    }
    return cls;
  };

  updateCalendarStatus(cellDate, dateArray): string {
    if (!dateArray || !Array.isArray(dateArray)) return '';
    const date = cellDate.getFullYear() + "-" + ("00" + (cellDate.getMonth() + 1)).slice(-2) + "-" + ("00" + cellDate.getDate()).slice(-2);
    let cls = '';
    let qty = 0;

    const bound = dateArray.find(x => (typeof x === 'object' && x.date === date) || x === date);
    if (bound) {
      qty = (typeof bound === 'object' && (bound.modifiedCount || bound.count)) ? Number(bound.modifiedCount || bound.count) : 1;
    }

    if (DateE.isDatePast(cellDate) && !DateE.isToday(cellDate)) {
      if (bound) {
        if (typeof bound === 'object') {
          if (bound.status === DeliveryStatus.MISSED || bound.status === DeliveryStatus.SHEDULED || bound.status === DeliveryStatus.NOSTATUS) {
            cls = DeliveryStatus.MISSED;
          } else if (bound.status === DeliveryStatus.DELIVERED) {
            cls = DeliveryStatus.DELIVERED;
          } else {
            cls = DeliveryStatus.MISSED;
          }
        } else {
          cls = DeliveryStatus.MISSED;
        }
      }
    } else if (DateE.isToday(cellDate)) {
      if (bound) {
        if (typeof bound === 'object' && bound.status === DeliveryStatus.DELIVERED) {
          cls = DeliveryStatus.DELIVERED;
        } else {
          cls = DeliveryStatus.SELECTED;
        }
      }
    } else if (!DateE.isDatePast(cellDate) && !DateE.isToday(cellDate)) {
      if (bound) {
        cls = DeliveryStatus.SELECTED;
      } else if (cellDate.getDay() === 0 || cellDate.getDay() === 6) {
        cls = 'week-ends';
      }
    }

    if (cls && cls !== 'week-ends' && qty > 0) {
      cls += ` has-qty qty-${qty}`;
    }

    return cls;
  }
}

export enum DeliveryStatus {
  DELIVERED = "delivered",
  SHEDULED = "sheduled",
  MISSED = "missed",
  NOSTATUS = "",
  SELECTED = "selected"
}