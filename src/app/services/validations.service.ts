import { Injectable } from '@angular/core';
import { AbstractControl, FormControl, ValidatorFn } from '@angular/forms';

@Injectable({
  providedIn: 'root'
})
export class ValidationsService {

  constructor() { }

  static checkLimit(min: number, max: number): ValidatorFn {
    return (c: AbstractControl): { [key: string]: boolean } | null => {
      if (c.value && (isNaN(c.value) || c.value < min || c.value > max)) {
        return { 'range': true };
      }
      return null;
    };
  }

  static emailValidatorFn(): ValidatorFn {
    return (c: FormControl) => {
      let isValid = /^[_a-zA-Z0-9]+(\.[_a-zA-Z0-9]+)*@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*(\.[a-zA-Z]{2,4})$/.test(c.value);
      if (isValid) {
        return null;
      } else {
        return {
          emailvalidator: {
            valid: false
          }
        };
      }
    }
  }

  static maxLinesValidator(limit: number): ValidatorFn {
    return (control: AbstractControl): { [key: string]: any } | null => {
      const exceeded = control.value.length && control.value.split('\n').length > limit;
      return exceeded ? { 'maxLines': { value: true } } : null;
    };
  }
}
