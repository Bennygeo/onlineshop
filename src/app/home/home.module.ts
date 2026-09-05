import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { HomeRoutingModule } from './home-routing.module';
import { FooterComponent } from '../components/footer/footer.component';
import { ViewComponent } from '../components/view/view.component';
import { SharedModule } from '../shared/shared.module';
import { Utils } from '../utils/utils';
import { ProfileComponent } from '../components/profile/profile.component';
import { WalletComponent } from '../components/wallet/wallet.component';
import { WalletHistoryComponent } from '../components/wallet-history/wallet-history.component';
import { TextInputDirective } from '../directives/text-input.directive';
import { SupportComponent } from '../components/support/support.component';
import { ReferComponent } from '../components/refer/refer.component';
import { LocationService } from '../services/location.service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { OrdersComponent } from '../components/orders/orders.component';
import { SubscriptionViewComponent } from '../components/subscription-view/subscription-view.component';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { SubsChildViewComponent } from '../components/subs-child-view/subs-child-view.component';
import { EmailMaskPipe } from '../pipes/email-mask.pipe';


@NgModule({
  declarations: [
    FooterComponent,
    ViewComponent,
    ProfileComponent,
    WalletComponent,
    WalletHistoryComponent,
    TextInputDirective,
    SupportComponent,
    ReferComponent,
    OrdersComponent,
    SubscriptionViewComponent,
    SubsChildViewComponent,
    EmailMaskPipe
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    HomeRoutingModule,
    MatDatepickerModule,
    MatNativeDateModule,
    SharedModule
  ],
  exports: [
  ],
  providers: [
    Utils,
    LocationService,
    EmailMaskPipe
  ]
})
export class HomeModule { }
