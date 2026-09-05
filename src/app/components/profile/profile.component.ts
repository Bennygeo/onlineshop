import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { User } from 'src/app/modals/user';
import { EmailMaskPipe } from 'src/app/pipes/email-mask.pipe';
import { CartService } from 'src/app/services/cart.service';
import { LoginService } from 'src/app/services/login.service';


@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit {

  profileForm: FormGroup;

  profileRes: Profile;
  emailWithoutMask: string;
  name: string;

  constructor(
    private formBuilder: FormBuilder,
    private cartS: CartService,
    public user: User,
    private loginS: LoginService,
    private emailMask: EmailMaskPipe) {
    this.cartS.headerChangeEvent.next("type3");
  }

  ngOnInit(): void {
    this.user = this.loginS.user;

    this.loginS.readUser().subscribe((res: any) => {
      if (res.length > 0) {
        this.loginS.user.mail = res[0].email;
        this.name = this.loginS.user.name = res[0].name;
        this.emailWithoutMask = this.user.mail;
        this.profileForm.patchValue({ name: res[0].name, mobile: res[0].mobile, email: res[0].email });
      }
    });

    this.profileForm = this.formBuilder.group({
      name: [this.user.name || "Thinkspot user", [Validators.required, Validators.minLength(3)]],
      email: [this.user.mail, [Validators.required, Validators.email]],
      mobile: [{
        value: this.user.mobile,
        disabled: true
      }]
    });

    this.profileForm.valueChanges.subscribe((res: Profile) => {
      res.email = res.email;
      this.profileRes = res;
    });

    let loadingEl = document.getElementById("loading");
    if (loadingEl)
      loadingEl.remove();
  }

  focusOut(evt: any): void {
    if (this.profileForm.valid) {
      if (this.emailWithoutMask !== this.profileForm.value.email || this.name !== this.profileForm.value.name) {
        this.loginS.updateUser({ mobile: this.loginS.user.mobile, email: this.profileForm.value.email, name: this.profileForm.value.name }).subscribe(res => {
          if (res === "UPDATED") {
            this.emailWithoutMask = this.profileForm.value.email;
            this.user.name = this.name = this.profileForm.value.name;
          }
        });
      }
    }
  }
}

type Profile = {
  name: string,
  email: string,
  mobile: number
}
