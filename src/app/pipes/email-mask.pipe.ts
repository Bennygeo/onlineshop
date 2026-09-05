import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'emailMask'
})
export class EmailMaskPipe implements PipeTransform {

  transform(value: string, showMask: boolean): string {
    if (showMask) {
      let target = value.split("@")[0];
      
      return target[0] + "***" + target[target.length - 1] + "@"+value.split("@")[1];
    } else {
      return value;
    }
  }
}
