import { NgModule } from '@angular/core';
import { RouterModule, Routes, mapToCanActivate } from '@angular/router';
import { ViewComponent } from '../components/view/view.component';
import { ProfileComponent } from '../components/profile/profile.component';
import { WalletComponent } from '../components/wallet/wallet.component';
import { SupportComponent } from '../components/support/support.component';
import { ReferComponent } from '../components/refer/refer.component';
import { AddressesComponent } from '../components/addresses/addresses.component';
import { AuthGuard } from '../modal/auth-guard';
import { OrdersComponent } from '../components/orders/orders.component';
import { PolicyComponent } from '../components/policy/policy.component';

const routes: Routes = [
  {
    path: 'view',
    component: ViewComponent
  },
  {
    path: 'orders',
    component: OrdersComponent,
    canActivate: mapToCanActivate([AuthGuard])
  },
  {
    path: 'profile',
    component: ProfileComponent,
    canActivate: mapToCanActivate([AuthGuard])
  },
  {
    path: 'wallet',
    component: WalletComponent,
    canActivate: mapToCanActivate([AuthGuard])
  },
  {
    path: 'support',
    component: SupportComponent,
    canActivate: mapToCanActivate([AuthGuard])
  },
  {
    path: 'referral',
    component: ReferComponent,
    canActivate: mapToCanActivate([AuthGuard])
  },
  {
    path: 'address',
    component: AddressesComponent,
    canActivate: mapToCanActivate([AuthGuard])
  },
  {
    path: 'policy',
    component: PolicyComponent,
    canActivate: mapToCanActivate([AuthGuard])
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class HomeRoutingModule { }

