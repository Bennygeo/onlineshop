import { SubsEntry } from "./types";

interface IDate {
    addDays(days: number, useThis?: boolean): Date;
    isToday(): boolean;
    clone(): Date;
    isAnotherMonth(date: Date): boolean;
    isWeekend(): boolean;
    isSameDate(date: Date): boolean;
    getStringDate(): String;
    formatAMPM(): string;
    getDesiredDeliveryDate(day): Date;
}

//Custom class with extended Date class
//DateE => Date extended
export class DateE extends Date implements IDate {

    private static month_names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    addDays(days: number): Date {
        if (!days) return this;
        let date = this;
        date.setDate(date.getDate() + days);
        return date;
    };

    isToday(): boolean {
        let today = new Date();
        return this.isSameDate(today);
    };

    clone(): Date {
        return new Date(+this);
    };

    isAnotherMonth(date: Date): boolean {
        return date && this.getMonth() !== date.getMonth();
    };

    isWeekend(): boolean {
        return this.getDay() === 0 || this.getDay() === 6;
    };

    isSameDate(date: Date): boolean {
        return date && this.getFullYear() === date.getFullYear() && this.getMonth() === date.getMonth() && this.getDate() === date.getDate();
    };

    getStringDate(): String {
        let today = new Date();
        if (this.getMonth() == today.getMonth() && this.getDay() == today.getDay()) {
            return "Today";
        } else if (this.getMonth() == today.getMonth() && this.getDay() == today.getDay() + 1) {
            return "Tomorrow";
        } else if (this.getMonth() == today.getMonth() && this.getDay() == today.getDay() - 1) {
            return "Yesterday";
        } else {
            return DateE.month_names[this.getMonth()] + ' ' + this.getDay() + ', ' + this.getFullYear();
        }
    }

    formatAMPM(): string {
        let hours: number = this.getHours();
        let minutes: number | string = this.getMinutes();
        let ampm = (hours >= 12) ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        minutes = minutes < 10 ? '0' + minutes : minutes;
        let strTime = hours + ':' + minutes + ' ' + ampm;
        return strTime;
    }


    duration(t0: any, t1: any) {
        let d = new Date(t1).getTime() - new Date(t0).getTime();
        let weekdays = Math.floor(d / 1000 / 60 / 60 / 24 / 7);
        let days = Math.floor(d / 1000 / 60 / 60 / 24 - weekdays * 7);
        let hours = Math.floor(d / 1000 / 60 / 60 - weekdays * 7 * 24 - days * 24);
        let minutes = Math.floor(d / 1000 / 60 - weekdays * 7 * 24 * 60 - days * 24 * 60 - hours * 60);
        let seconds = Math.floor(d / 1000 - weekdays * 7 * 24 * 60 * 60 - days * 24 * 60 * 60 - hours * 60 * 60 - minutes * 60);
        let milliseconds = Math.floor(d - weekdays * 7 * 24 * 60 * 60 * 1000 - days * 24 * 60 * 60 * 1000 - hours * 60 * 60 * 1000 - minutes * 60 * 1000 - seconds * 1000);
        let t = {};
        ['weekdays', 'days', 'hours', 'minutes', 'seconds', 'milliseconds'].forEach(q => { if (eval(q) > 0) { t[q] = eval(q); } });
        return t;
    }

    getDesiredDeliveryDate(day: number): Date {
        var d = new Date();
        d.setDate(d.getDate() + ((7 - d.getDay()) % 7 + (day)) % 7);
        return new Date(d);
    }

    //returns the difference in days
    static dateDiff(startD, endD): number {
        const _MS_PER_DAY = 1000 * 60 * 60 * 24;
        const utc1 = Date.UTC(startD.getFullYear(), startD.getMonth(), startD.getDate());
        const utc2 = Date.UTC(endD.getFullYear(), endD.getMonth(), endD.getDate());
        return Math.floor((utc2 - utc1) / _MS_PER_DAY);
    }

    static getGreeting(date): string {
        let greet: string = "";

        let hrs = date.getHours();
        let mins = date.getMinutes(); // changed date to myDate

        if (hrs >= 5 && ((hrs == 5 && mins >= 30) || (hrs > 5 && hrs < 12)))
            greet = 'Good Morning';
        else if (hrs >= 12 && hrs < 18)
            greet = 'Good Afternoon';
        else if ((hrs >= 18 && hrs < 24) || hrs > 0)
            greet = 'Good Evening';


        return greet || "Greetings";
    }

    /*
    * To get date(string) between two dates
    */
    static getDaysBetween(date1: Date, date2: Date, others?: any): Array<SubsEntry> {

        var getDaysArray = function (start, end) {
            for (var arr = [], dt = new Date(start); dt <= new Date(end); dt.setDate(dt.getDate() + 1)) {
                arr.push(new Date(dt));
            }
            return arr;
        };

        var daylist = getDaysArray(date1, date2);
        return daylist.map((v) => {
            let obj = { date: v.getFullYear() + "-" + ("00" + (v.getMonth() + 1)).slice(-2) + "-" + ("00" + v.getDate()).slice(-2) };
            return { ...obj, ...others }
        });
    }

    constructor(date?: Date) {
        super(date || new Date());
    }

    static getWeekDays(startDate: Date, endDate: Date): SubsEntry[] {
        const weekdays: Date[] = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        for (let date = start; date <= end; date.setDate(date.getDate() + 1)) {
            const day = date.getDay();
            if (day !== 0 && day !== 6) { // 0 = Sunday, 6 = Saturday
                weekdays.push(new Date(date));
            }
        }
        return weekdays.map((v) => {
            return {
                date: v.getFullYear() + "-" + ("00" + (v.getMonth() + 1)).slice(-2) + "-" + ("00" + v.getDate()).slice(-2),
                count: 1
            }
        });

    }

    static getWeekEnds(startDate: Date, endDate: Date): SubsEntry[] {
        const weekdays: Date[] = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        for (let date = start; date <= end; date.setDate(date.getDate() + 1)) {
            const day = date.getDay();
            if (day === 0 || day === 6) { // 0 = Sunday, 6 = Saturday
                weekdays.push(new Date(date));
            }
        }
        return weekdays.map((v) => {
            return {
                date: v.getFullYear() + "-" + ("00" + (v.getMonth() + 1)).slice(-2) + "-" + ("00" + v.getDate()).slice(-2),
                count: 1
            }
        });

    }

    static getAlternateDays(startDate: Date, endDate: Date): SubsEntry[] {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const alternateDays: Date[] = [];
        for (let date = start; date <= end; date.setDate(date.getDate() + 2)) {
            alternateDays.push(new Date(date));
        }
        return alternateDays.map((v) => {
            return {
                date: v.getFullYear() + "-" + ("00" + (v.getMonth() + 1)).slice(-2) + "-" + ("00" + v.getDate()).slice(-2),
                count: 1
            }
        });
    }

    static isDatePast(date: Date): boolean {
        const now = new Date();

        const dateInMilliseconds = date.getTime();
        const nowInMilliseconds = now.getTime();

        return dateInMilliseconds < nowInMilliseconds;
    }

    static isToday(date: Date): boolean {
        const today = new Date();

        const todayYear = today.getFullYear();
        const todayMonth = today.getMonth();
        const todayDay = today.getDate();

        const dateYear = date.getFullYear();
        const dateMonth = date.getMonth();
        const dateDay = date.getDate();

        return (
            todayYear === dateYear && todayMonth === dateMonth && todayDay === dateDay
        );
    }

    static addDays(date: Date, days: number): Date {
        const newDate = new Date(date.getTime());
        newDate.setDate(newDate.getDate() + days);
        return newDate;
    }
}
