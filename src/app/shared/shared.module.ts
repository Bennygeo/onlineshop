import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlusMinusComponent } from '../components/plus-minus/plus-minus.component';
import { LoginComponent } from '../components/login/login.component';
import { AddressComponent } from '../components/address/address.component';
import { AddressesComponent } from '../components/addresses/addresses.component';
import { MatRadioModule } from '@angular/material/radio';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { User } from '../modals/user';
import { Utils } from '../utils/utils';

@NgModule({
  declarations: [
    PlusMinusComponent,
    LoginComponent,
    AddressComponent,
    AddressesComponent,
  ],
  exports: [
    PlusMinusComponent,
    LoginComponent,
    AddressComponent,
    AddressesComponent
    
  ],
  imports: [
    CommonModule,
    MatRadioModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  providers: [
    User,
    Utils,
    { provide: 'Window', useValue: window }
  ]
})
export class SharedModule { }
