import { Component } from '@angular/core';

@Component({
  selector: 'app-web',
  standalone: true,
  imports: [],
  templateUrl: './web.component.html',
  styleUrl: './web.component.scss'
})
export class WebComponent {

  constructor() {
    let loadingEl = document.getElementById("loading");
    if (loadingEl)
      loadingEl.remove();
  }

}
