import { NativeDateAdapter } from "@angular/material/core";

export class CustomAdaptor extends NativeDateAdapter {

    override getFirstDayOfWeek(): number {
        return 1; // Monday
    }
}
