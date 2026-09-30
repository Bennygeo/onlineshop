import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, shareReplay, throwError, of, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  constructor(
    private http: HttpClient
  ) {
  }

  getApi(url: string, params?: object, skipLoader: boolean = false): Observable<any> {
    url = `${environment.url}${url}`;

    let headers = new HttpHeaders();
    if (skipLoader) {
      headers = headers.set('X-Skip-Loader', 'true');
    }

    return this.http.get<any>(url, { headers, params: params as any });
  }


  postApi(url: string, params?: any, skipLoader: boolean = false): Observable<any> {
    url = `${environment.url}${url}`;

    let headers = new HttpHeaders();
    if (skipLoader) {
      headers = headers.set('X-Skip-Loader', 'true');
    }

    let body = new FormData();
    for (let key in params) {
      const val = params[key];
      if (typeof val === 'object' && val !== null && !(val instanceof Blob) && !(val instanceof File)) {
        body.append(key, JSON.stringify(val));
      } else if (val !== undefined && val !== null) {
        body.append(key, val);
      }
    }
    return this.http.post<any>(url, body, { headers }).pipe(shareReplay(), catchError(this.handleError));
  }

  /** Multipart file upload — pass a pre-built FormData object */
  uploadFile(url: string, formData: FormData, skipLoader: boolean = false): Observable<any> {
    url = `${environment.url}${url}`;
    let headers = new HttpHeaders();
    if (skipLoader) {
      headers = headers.set('X-Skip-Loader', 'true');
    }
    // Do NOT set Content-Type header — the browser sets it with the boundary automatically
    return this.http.post<any>(url, formData, { headers }).pipe(catchError(this.handleError));
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
    return throwError(() => new Error(error.error?.error || error.message || 'Something bad happened; please try again later.'));
  }

}
