import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SubsChildViewComponent } from './subs-child-view.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('SubsChildViewComponent', () => {
  let component: SubsChildViewComponent;
  let fixture: ComponentFixture<SubsChildViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [SubsChildViewComponent],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SubsChildViewComponent);
    component = fixture.componentInstance;
    component.data = { subscriptionType: 'daily', rangeDates: '[]', subscribedDates: '[]' };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
