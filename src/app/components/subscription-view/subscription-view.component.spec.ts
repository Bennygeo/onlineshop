import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DatePipe } from '@angular/common';
import { SubscriptionViewComponent } from './subscription-view.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { User } from 'src/app/modals/user';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('SubscriptionViewComponent', () => {
  let component: SubscriptionViewComponent;
  let fixture: ComponentFixture<SubscriptionViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule, NoopAnimationsModule],
      declarations: [SubscriptionViewComponent],
      providers: [
        { provide: User, useClass: User },
        DatePipe
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SubscriptionViewComponent);
    component = fixture.componentInstance;
    component.subsData = { 'ORD_1': [] };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
