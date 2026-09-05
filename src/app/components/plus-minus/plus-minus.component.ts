import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { LoginService } from 'src/app/services/login.service';

@Component({
  selector: 'plus-minus',
  templateUrl: './plus-minus.component.html',
  styleUrls: ['./plus-minus.component.scss'],
})
export class PlusMinusComponent implements OnInit {

  @Output() onChange = new EventEmitter();

  @Input() inputVal: number;
  @Input() caption: string;
  @Input() stepVal: number;

  @Input() minVal: number = 0;
  @Input() maxVal: number = 10;

  @Input() disable: boolean = false;

  @Input() alignItem: string = "center";

  @Input() disabled: boolean = false;


  /*
  * case 1 : if minVal is 0 then 'Add' button will be visible instead of 0.
  * TYPE 2 : if minVal is 1 then minus button will be disabled at minVal.
  */
  @Input() type: string = "type1";
  @Input() label: string = "Buy";

  minusBtnFlg: boolean = true;
  plusBtnFlg: boolean = false;

  constructor(private loginS: LoginService) {
    this.caption = "";
  }

  ngOnInit() {
    this.minusBtnFlg = false;
    if (this.inputVal < this.minVal) {
      this.inputVal = this.minVal;
      this.minusBtnFlg = true;
    }

    if (this.disable) {
      this.minusBtnFlg = true;
      this.plusBtnFlg = true;
    }
  }

  /*
  * Plus button click handler
  */
  increment() {
    if (this.loginS.loginstatus()) {
      this.inputVal = Number(this.inputVal);
      if (this.inputVal < this.maxVal) this.inputVal += this.stepVal;

      this.onChange.emit(this.inputVal);
      this.minusBtnFlg = true;

      (this.inputVal == this.stepVal) ? this.minusBtnFlg = true : this.minusBtnFlg = false;

      if (this.inputVal > this.minVal) this.minusBtnFlg = false;

      if (this.inputVal == this.maxVal) this.plusBtnFlg = true;
    } else {
      this.loginS.loginPromptEvent.next(true);
    }
  }

  /*
  * Minus button click handler
  */
  decrement() {
    this.inputVal = Number(this.inputVal);
    try {
      if (this.inputVal > this.minVal || this.inputVal > this.stepVal) {
        this.inputVal -= this.stepVal;
      }
    } catch (e) { }

    this.onChange.emit(this.inputVal);
    (this.inputVal == this.stepVal) ? this.minusBtnFlg = true : this.minusBtnFlg = false;

    if (this.inputVal == this.minVal) this.minusBtnFlg = true;
    else this.minusBtnFlg = false;

    if (this.minVal && this.minVal == 0) {
      if (this.inputVal > 0) this.minusBtnFlg = false;
    }

    this.plusBtnFlg = false;

  }

  addButtonClickHandler() {
    this.increment();
  }
}


