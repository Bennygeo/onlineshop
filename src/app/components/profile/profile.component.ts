import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { User } from 'src/app/modals/user';
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

  isSaving: boolean = false;
  savedSuccessToast: boolean = false;

  constructor(
    private formBuilder: FormBuilder,
    private cartS: CartService,
    public user: User,
    private loginS: LoginService
  ) {
    this.cartS.headerChangeEvent.next("type2");
  }

  ngOnInit(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.user = this.loginS.user;

    this.profileForm = this.formBuilder.group({
      name: [this.user.name || "TomorrowNeeds User", [Validators.required, Validators.minLength(3)]],
      email: [this.user.mail || "", [Validators.required, Validators.email]],
      mobile: [{
        value: this.user.mobile,
        disabled: true
      }]
    });

    this.loginS.readUser().subscribe((res: any) => {
      if (res && res.length > 0) {
        this.loginS.user.mail = res[0].email;
        this.name = this.loginS.user.name = res[0].name;
        this.emailWithoutMask = res[0].email;
        this.profileForm.patchValue({ name: res[0].name, mobile: res[0].mobile, email: res[0].email });
      }
    });

    let loadingEl = document.getElementById("loading");
    if (loadingEl)
      loadingEl.remove();
  }

  saveProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    const updatePayload = {
      mobile: this.loginS.user.mobile,
      email: this.profileForm.value.email,
      name: this.profileForm.value.name
    };

    this.loginS.updateUser(updatePayload).subscribe({
      next: (res) => {
        this.isSaving = false;
        this.emailWithoutMask = this.profileForm.value.email;
        this.user.name = this.name = this.profileForm.value.name;
        this.savedSuccessToast = true;
        setTimeout(() => {
          this.savedSuccessToast = false;
        }, 2500);
      },
      error: () => {
        this.isSaving = false;
      }
    });
  }

  focusOut(evt: any): void {
    if (this.profileForm.valid) {
      if (this.emailWithoutMask !== this.profileForm.value.email || this.name !== this.profileForm.value.name) {
        this.saveProfile();
      }
    }
  }

  logoutAction(): void {
    this.loginS.logoutEvent.next();
    this.cartS.router.navigate(['/']);
  }
}

type Profile = {
  name: string,
  email: string,
  mobile: number
}
