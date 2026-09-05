import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SubsChildViewComponent } from './subs-child-view.component';

describe('SubsChildViewComponent', () => {
  let component: SubsChildViewComponent;
  let fixture: ComponentFixture<SubsChildViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubsChildViewComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SubsChildViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
