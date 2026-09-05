import { Directive, ElementRef, HostListener } from '@angular/core';

@Directive({
  selector: '[TextInputFilter]'
})
export class TextInputDirective {

  constructor(private el: ElementRef) {

  }

  @HostListener('input')
  onChange() {
    let val: any = (this.el.nativeElement as HTMLInputElement).value.replace(/[^0-9]/g, "");

    if (val.length === 0) val = 0;
    val = parseInt(val).toString();

    if (val.length >= 6) val = val.slice(0, 5);
    (this.el.nativeElement as HTMLInputElement).value = "₹" + val;
  }

}
