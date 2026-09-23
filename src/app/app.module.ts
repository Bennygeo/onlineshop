import { NgModule, ErrorHandler } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { HashLocationStrategy, LocationStrategy } from '@angular/common';
import { LoginService } from './services/login.service';
import { HeaderComponent } from './components/header/header.component';
import { LoaderInterceptor } from './interceptors/loader.interceptor';
import { ErrorInterceptor } from './interceptors/error.interceptor';
import { GlobalErrorHandler } from './services/global-error-handler';
import { LoggingService } from './services/logging.service';
import { LoaderComponent } from './components/loader/loader.component';
import { Payment } from './modal/payment';
import { SharedModule } from './shared/shared.module';
import { OrderService } from './services/order.service';

@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    LoaderComponent,
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    SharedModule
  ],
  exports: [
  ],
  providers: [
    { provide: LocationStrategy, useClass: HashLocationStrategy },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: LoaderInterceptor,
      multi: true,
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: ErrorInterceptor,
      multi: true,
    },
    {
      provide: ErrorHandler,
      useClass: GlobalErrorHandler
    },
    LoggingService,
    LoginService,
    Payment,
    OrderService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
