import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AiService } from './ai.service';
import { ApiService } from './api.service';
import { StorageService } from './storage.service';
import { LoginService } from './login.service';
import { of } from 'rxjs';

describe('AiService', () => {
  let service: AiService;
  let apiService: ApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      providers: [AiService, ApiService, StorageService, LoginService]
    });
    service = TestBed.inject(AiService);
    apiService = TestBed.inject(ApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should send query and return AI response', (done) => {
    const mockResponse = {
      status: 'success',
      reply: 'Here are the ingredients for Sambar',
      source: 'gemini-2.0-flash',
      suggested_products: [{ id: 'p1', name: 'Tomatoes', price: 40, unit: '500 grams' }]
    };

    spyOn(apiService, 'postApi').and.returnValue(of(mockResponse));

    service.askAssistant('sambar recipe', '9876543210').subscribe(res => {
      expect(res.status).toBe('success');
      expect(res.reply).toContain('ingredients for Sambar');
      expect(res.suggested_products?.length).toBe(1);
      done();
    });
  });
});
