import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { DescriptionOptions, Product, ProductOptions, menuOptions } from '../utils/types';
import { CartService } from './cart.service';
import { Utils } from '../utils/utils';

@Injectable({
  providedIn: "root"
})
export class ProductService {

  constructor(
    private cartService: CartService,
    private _utils: Utils
  ) { }

  //To update description from product component to product-list component
  descUpdateEvent: Subject<DescriptionOptions> = new Subject<DescriptionOptions>();

  //To update cart item remove notification to cart-list component 
  cartRemoveEvent: Subject<Product> = new Subject<Product>();

  menus: menuOptions = {
    list: this.cartService.categoryPriorityIndex,
    defaultMenu: "Vegetables",
    subCategoryList: [],
    subCategoryListID: []
  }

  productsOptions: ProductOptions = {
    products: [],
    productsCategoryWise: {},
    loadingFlg: true
  };


  /**
  * Vertical menu position
  */
  menu_position(): void {
    if (this.menus.activeMenu) {
      try {
        let _pos_top = this._utils.getElement("#" + this.menus.activeMenu).offsetTop + this._utils.getElement('.sub_menu')['scrollTop'];
        let _diff_to_minus = 0;
        if (_pos_top > 200) {
          _diff_to_minus = _pos_top - ((window.innerHeight - 50) / 2 - this._utils.getElement("#" + this.menus.activeMenu).offsetHeight / 2);
        }
        _diff_to_minus = _diff_to_minus - this._utils.getElement(".sub_menu").scrollTop;

        this._utils.getElement(".sub_menu").scrollTo({
          top: Math.max(0, _diff_to_minus),
          behavior: 'smooth'
        });

      } catch (e) { }
    }
  }
}
