import { ElementRef } from '@angular/core';
import { TextInputDirective } from './text-input.directive';

describe('TextInputDirective', () => {
  it('should create an instance', () => {
    const mockEl = new ElementRef(document.createElement('input'));
    const directive = new TextInputDirective(mockEl);
    expect(directive).toBeTruthy();
  });
});
