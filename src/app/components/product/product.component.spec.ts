import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DatePipe } from '@angular/common';
import { ProductComponent } from './product.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Utils } from 'src/app/utils/utils';
import { Subject } from 'rxjs';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('ProductComponent', () => {
  let component: ProductComponent;
  let fixture: ComponentFixture<ProductComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [ ProductComponent ],
      providers: [ Utils, DatePipe ],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ProductComponent);
    component = fixture.componentInstance;
    component.product = {
      id: 'p1',
      name: 'Test Product',
      price: '100',
      changeInProduct: new Subject<any>(),
      subs_options: {
        units: 0,
        multiDaySelected: [],
        rangeSelected: []
      }
    } as any;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
