import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface AiSuggestedProduct {
  id: string;
  name: string;
  price: number;
  unit: string;
  tamil_name?: string;
  original_price?: number;
  weight?: number;
  unit_name?: string;
  img_url?: string;
  cat?: string;
  sub_cat?: string;
}

export interface AiOrderItem {
  name: string;
  quantity: number;
  price: number;
  unit_name?: string;
}

export interface AiOrderSummary {
  order_id: string;
  status: string;
  total_amount: number;
  delivery_date?: string;
  delivery_slot_label?: string;
  created_at?: string;
  payment_type?: string;
  items?: Array<AiOrderItem>;
}

export interface AiAddressSummary {
  id: string | number;
  title?: string;
  name?: string;
  address: string;
  pincode: string;
  landmark?: string;
  is_default?: number | boolean;
  default?: number | boolean;
  active?: number | boolean;
}

export interface AiMessageResponse {
  status: string;
  reply: string;
  source: string;
  suggested_products?: Array<AiSuggestedProduct>;
  user_orders?: Array<AiOrderSummary>;
  user_addresses?: Array<AiAddressSummary>;
}

@Injectable({
  providedIn: 'root'
})
export class AiService {
  constructor(private api: ApiService) {}

  /**
   * Send user query / recipe request to TomorrowNeeds AI
   * Falls back to offline recipes if backend API is unreachable
   */
  askAssistant(message: string, mobile?: string): Observable<AiMessageResponse> {
    const payload = {
      message: message,
      mobile: mobile || ''
    };

    return this.api.postApi('ai/chat.php', payload, true).pipe(
      catchError((err) => {
        return of({
          status: 'fallback',
          reply: 'I am currently unable to reach the AI server. Please try again or browse our fresh categories!',
          source: 'client-fallback',
          suggested_products: []
        });
      })
    );
  }
}
