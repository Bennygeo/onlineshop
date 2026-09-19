import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { SearchComponent } from './search.component';
import { Utils } from 'src/app/utils/utils';
import { AiService } from 'src/app/services/ai.service';
import { of } from 'rxjs';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('SearchComponent', () => {
  let component: SearchComponent;
  let fixture: ComponentFixture<SearchComponent>;
  let aiService: AiService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule, FormsModule],
      declarations: [ SearchComponent ],
      providers: [ Utils, AiService ],
      schemas: [NO_ERRORS_SCHEMA]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SearchComponent);
    component = fixture.componentInstance;
    aiService = TestBed.inject(AiService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should trigger AI assistant search and render response', () => {
    const mockAiRes = {
      status: 'success',
      reply: 'Here are Sambar ingredients',
      source: 'gemini-3.6-flash',
      suggested_products: [{ id: 'p1', name: 'Tomato', price: 40, unit: '500g' }]
    };
    spyOn(aiService, 'askAssistant').and.returnValue(of(mockAiRes));

    component.askAi('Sambar Kit');

    expect(component.showAiCard).toBe(true);
    expect(component.aiLoading).toBe(false);
    expect(component.aiResponse?.reply).toContain('Sambar ingredients');
  });
});
