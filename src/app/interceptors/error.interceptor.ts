import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { LoggingService } from '../services/logging.service';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {

  constructor(private logger: LoggingService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        // Skip telemetry logger endpoint itself to prevent cascade
        if (!request.url.includes('log_client_error.php')) {
          this.logger.logHttpError(
            request.url,
            error.status || 0,
            error.statusText || 'Unknown Error',
            error.error
          );
        }
        return throwError(() => error);
      })
    );
  }
}
