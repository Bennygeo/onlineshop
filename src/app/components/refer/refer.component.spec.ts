import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReferComponent } from './refer.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

describe('ReferComponent', () => {
  let component: ReferComponent;
  let fixture: ComponentFixture<ReferComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [ReferComponent]
    });
    fixture = TestBed.createComponent(ReferComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
