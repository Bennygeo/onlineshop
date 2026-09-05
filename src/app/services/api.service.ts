import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, shareReplay, throwError, of } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  constructor(
    private http: HttpClient
  ) {
  }

  getApi(url: string, params?: object) {
    url = `${environment.url}${url}`;

    const httpOptions = {
      headers: new HttpHeaders()
    };
    httpOptions.headers.set('Content-Type', 'application/json');
    return this.http.get<any>(url, httpOptions);
  }


  postApi(url: string, params?: any) {
    if (url === 'products/download_products_sql.php') {
      let mockProducts = [
        {
          id: 'p1',
          name: 'Mock Tomato',
          tamil_name: 'தக்காளி',
          cat: params?.cat || 'Vegetables',
          sub_cat: 'Daily Veg',
          price: 40,
          original_price: 50,
          stock_price: 30,
          profit_percent: 10,
          show_off_percent: 20,
          weight: 500,
          original_weight: 500,
          unit_name: 'grams',
          original_unit_name: 'grams',
          img_url: 'assets/products/tomato.jpg',
          disabled: false,
          index: 1,
          offer: 10
        },
        {
          id: 'p2',
          name: 'Mock Onion',
          tamil_name: 'வெங்காயம்',
          cat: params?.cat || 'Vegetables',
          sub_cat: 'Daily Veg',
          price: 30,
          original_price: 40,
          stock_price: 20,
          profit_percent: 10,
          show_off_percent: 20,
          weight: 1000,
          original_weight: 1000,
          unit_name: 'grams',
          original_unit_name: 'grams',
          img_url: 'assets/products/onion.jpg',
          disabled: false,
          index: 2,
          offer: 15
        }
      ];
      return of(mockProducts);
    }

    url = `${environment.url}${url}`;

    const httpOptions = {
      headers: new HttpHeaders()
    };
    httpOptions.headers.set('Content-Type', 'application/json');

    let body = new FormData();
    for (let key in params) {
      body.append(key, params[key]);
    }
    return this.http.post<any>(url, body, httpOptions).pipe(shareReplay(), catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse) {
    if (error.status === 0) {
      // A client-side or network error occurred. Handle it accordingly.
      console.error('An error occurred:', error.error);
    } else {
      // The backend returned an unsuccessful response code.
      // The response body may contain clues as to what went wrong.
      console.error(
        `Backend returned code ${error.status}, body was: `, error.error);
    }
    // Return an observable with a user-facing error message.
    return throwError(() => {
      new Error('Something bad happened; please try again later.');
    });
  }

}
