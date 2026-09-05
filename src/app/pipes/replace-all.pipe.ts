import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'ReplaceAll'
})
export class ReplaceAll implements PipeTransform {

  transform(value: string, ...args: string[]): string {
    let new_str: string = "";
    for (let str of value)
      new_str += (str == args[0]) ? args[1] : str;

    //Remove all special characters
    new_str = new_str.replace(/[^\w\s]/gi, '');
    return new_str;
  }

}
