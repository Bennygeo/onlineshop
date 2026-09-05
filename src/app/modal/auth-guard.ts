import { Injectable } from "@angular/core";
import { LoginService } from "../services/login.service";

@Injectable({ providedIn: 'root' })
export class AuthGuard {

    constructor(private loginS: LoginService) { }

    canActivate() {
        return this.loginS.loginstatus();
    }
}
