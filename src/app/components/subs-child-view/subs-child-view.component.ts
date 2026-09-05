import { Component, Input, OnChanges, OnInit, SimpleChanges, ViewEncapsulation } from '@angular/core';
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
export class SubsChildViewComponent implements OnInit, OnChanges {

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
    const date = cellDate.getFullYear() + "-" + ("00" + (cellDate.getMonth() + 1)).slice(-2) + "-" + ("00" + cellDate.getDate()).slice(-2);
    let cls = '';
    if (DateE.isDatePast(cellDate) && !DateE.isToday(cellDate)) {
      const bound = dateArray.filter(x => (x.date == date) ? x : null);
      if (bound) {
        if (bound[0] != undefined) {
          if (bound[0].status === DeliveryStatus.MISSED || bound[0].status === DeliveryStatus.SHEDULED || bound[0].status === DeliveryStatus.NOSTATUS) {
            cls = DeliveryStatus.MISSED;
          } else if (bound[0].status === DeliveryStatus.DELIVERED) {
            cls = DeliveryStatus.DELIVERED
          } else {
            cls = DeliveryStatus.MISSED;
          }
        }
      }

    } else if (DateE.isToday(cellDate)) {
      const bound = dateArray.filter(x => (x.date == date) ? x : null);
      if (bound) {
        if (bound[0] != undefined && bound[0].status === DeliveryStatus.DELIVERED) {
          cls = DeliveryStatus.DELIVERED;
        } else {
          if (bound[0] != undefined && bound[0].status)
            cls = DeliveryStatus.SELECTED;
        }
      }
    }
    else if (!DateE.isDatePast(cellDate) && !DateE.isToday(cellDate)) {
      if (cellDate.getDay() === 0 || cellDate.getDay() === 6) {
        cls = ((dateArray.find(x => x.date == date) ? DeliveryStatus.SELECTED : null) == null) ? 'week-ends' : 'selected';
      } else {
        cls = dateArray.find(x => x.date == date) ? DeliveryStatus.SELECTED : null;
      }
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