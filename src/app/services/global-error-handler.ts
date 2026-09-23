import { ErrorHandler, Injectable, Injector } from '@angular/core';
import { LoggingService } from './logging.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {

  constructor(private injector: Injector) {}

  handleError(error: any): void {
    try {
      const logger = this.injector.get(LoggingService);

      let message = 'Uncaught Application Error';
      let stack: string | undefined;

      if (error instanceof Error) {
        message = error.message;
        stack = error.stack;
      } else if (typeof error === 'string') {
        message = error;
      } else if (error?.rejection instanceof Error) {
        // Unhandled Promise rejection
        message = `Unhandled Promise Rejection: ${error.rejection.message}`;
        stack = error.rejection.stack;
      } else if (error?.status && error?.statusText) {
        // Http error that leaked through
        message = `Unhandled HTTP Error: ${error.status} ${error.statusText}`;
      } else {
        message = JSON.stringify(error);
      }

      logger.error(message, { message, stack }, 'GlobalErrorHandler');
    } catch (handlerEx) {
      console.error('Fatal failure inside GlobalErrorHandler:', handlerEx);
    }
  }
}
