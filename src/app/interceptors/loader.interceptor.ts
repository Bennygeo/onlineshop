import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor
} from '@angular/common/http';
import { Observable, finalize } from 'rxjs';
import { LoaderService } from '../services/loader.service';

@Injectable()
export class LoaderInterceptor implements HttpInterceptor {

  service_count: number = 0;

  exceptionUrls: Array<string> = ["orders.php", "product_orders.php"];
  constructor(private loaderS: LoaderService) { }

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {

    if (this.exceptionUrls.indexOf(request.url.split("/").slice(-1)[0]) === -1) {
      this.service_count++; // increment the count for each intercepted http request.
      // show spinner.
      this.loaderS.show();
    }

    return next.handle(request).pipe(

      finalize(() => {
        this.service_count--;
        if (this.service_count < 0) this.service_count = 0;
        // decrement when service is completed (success/failed both 
        // handled when finalize rxjs operator used)

        if (this.service_count === 0) {
          // hide spinner
          this.loaderS.hide();
        }
      })
    );
  }
}


