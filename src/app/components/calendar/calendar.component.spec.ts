import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CalendarComponent } from './calendar.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Utils } from 'src/app/utils/utils';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('CalendarComponent', () => {
  let component: CalendarComponent;
  let fixture: ComponentFixture<CalendarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [CalendarComponent],
      providers: [Utils],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CalendarComponent);
    component = fixture.componentInstance;
    component.productsOptions = {
      product: {
        name: 'Test Product',
        price: '100',
        original_price: '120',
        updated_weight: 1,
        unit_name: 'kg',
        img_url: '',
        badge: 'no',
        badge_txt: '',
        disable: false
      },
      products: [],
      productsCategoryWise: {},
      loadingFlg: false
    } as any;
    component.data = {
      product: component.productsOptions.product,
      subsOptions: component.subs_options,
      productsOptions: component.productsOptions
    };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
