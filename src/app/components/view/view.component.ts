import { Component, OnDestroy, OnInit, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
import { Common } from 'src/app/modal/Common';
import { User } from 'src/app/modals/user';
import { CartService } from 'src/app/services/cart.service';
import { LoginService } from 'src/app/services/login.service';
import { OrderService } from 'src/app/services/order.service';
import { AiService, AiMessageResponse, AiOrderSummary, AiAddressSummary } from 'src/app/services/ai.service';
import { Banner, Product } from 'src/app/utils/types';
import { Subscription } from 'rxjs';

export interface RestockItem {
  product: Product;
  urgency: 'high' | 'medium' | 'low';
  urgencyBadge: string;
  reason: string;
  lastOrderedDays?: number;
}

export interface DietaryGoal {
  id: string;
  label: string;
  tamilLabel: string;
  icon: string;
  badge: string;
  desc: string;
  keywords: string[];
}

export interface AiChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  time: string;
  products?: Array<Product>;
  orders?: Array<AiOrderSummary>;
  addresses?: Array<AiAddressSummary>;
}

@Component({
  selector: 'app-view',
  templateUrl: './view.component.html',
  styleUrls: ['./view.component.scss']
})
export class ViewComponent implements OnInit, OnDestroy {
  @ViewChild('chatScrollContainer') private chatScrollContainer!: ElementRef;
  user: User;

  userName: string = "there";
  greetingData: { greeting: string, icon: string } = { greeting: 'Hello', icon: 'wb_sunny' };

  banners: Array<Banner> = [];
  base_url: string = "/assets/home/banners/";
  recommended_products: Array<Product> = [];
  recent_products: Array<Product> = [];
  batter_products: Array<Product> = [];

  timestamp: number = Date.now();
  bannerDownloadFlg: boolean = true;
  cartBarVisibilityFlg: boolean = true;

  categories: Array<any> = [];

  // Active delivery tracker
  activeUpcomingOrder: any = null;
  walletBalance: number = 0;

  // --- 1. SMART AI CHAT SHOPPING ASSISTANT ---
  showAiChatModal: boolean = false;
  chatInputText: string = '';
  isAiChatProcessing: boolean = false;
  chatMessages: Array<AiChatMessage> = [];
  chatToastMsg: string = '';

  sampleChatPrompts = [
    { icon: '📦', label: 'My Orders', text: 'Show my recent orders and delivery status' },
    { icon: '📍', label: 'My Address', text: 'Show my saved delivery addresses' },
    { icon: '🍲', label: 'Sambar Kit', text: 'Ingredients for authentic Tamil Sambar' },
    { icon: '🥗', label: 'Healthy Salad', text: 'Fresh ingredients for low-calorie weight loss salad' },
    { icon: '🥑', label: 'Diabetic Diet', text: 'Best diabetic friendly low-glycemic vegetables' },
    { icon: '🛒', label: 'Quick Cart Add', text: 'Add 1kg Tomato and 500g Onion to cart' }
  ];

  // --- 2. AI HEALTH & DIETARY CURATIONS ---
  dietaryGoals: DietaryGoal[] = [
    {
      id: 'diabetic',
      label: 'Diabetic Friendly',
      tamilLabel: 'சர்க்கரை கட்டுப்பாடு',
      icon: 'favorite',
      badge: 'Low Glycemic Index',
      desc: 'Farm-fresh veggies & bitter greens that support steady blood sugar levels without spikes.',
      keywords: ['bitter', 'pavakkai', 'ladies finger', 'vendakkai', 'palak', 'methi', 'amla', 'cucumber', 'beans']
    },
    {
      id: 'protein',
      label: 'High Protein & Fitness',
      tamilLabel: 'புரத சத்து',
      icon: 'fitness_center',
      badge: 'Muscle & Strength',
      desc: 'Rich in natural plant & dairy protein: fresh milk, curd, sprouts, and dense greens.',
      keywords: ['milk', 'curd', 'sprout', 'palak', 'drumstick', 'murungai', 'paneer', 'egg']
    },
    {
      id: 'weight',
      label: 'Weight Care & Detox',
      tamilLabel: 'உடல் எடை குறைப்பு',
      icon: 'spa',
      badge: 'High Hydration & Fiber',
      desc: 'Zero-fat, water-rich vegetables and refreshing natural hydration for clean vitality.',
      keywords: ['bottle gourd', 'sorakkai', 'cucumber', 'papaya', 'carrot', 'tender coconut', 'radish', 'lemon']
    },
    {
      id: 'immunity',
      label: 'Immunity Booster',
      tamilLabel: 'நோய் எதிர்ப்பு சக்தி',
      icon: 'local_florist',
      badge: 'Vitamin C & Antioxidants',
      desc: 'Natural healing herbs, ginger, citrus, and raw cold-pressed nutrition.',
      keywords: ['ginger', 'inji', 'garlic', 'poondu', 'lemon', 'mint', 'turmeric', 'tender coconut', 'amla', 'tulsi']
    },
    {
      id: 'kids',
      label: 'Kids & Toddler Nutrition',
      tamilLabel: 'குழந்தைகள் நலம்',
      icon: 'child_care',
      badge: 'Wholesome Growth',
      desc: 'Stoneground preservative-free batters, calcium milk, and naturally sweet fruits.',
      keywords: ['milk', 'batter', 'banana', 'apple', 'carrot', 'curd', 'potato']
    }
  ];
  activeDietaryGoalId: string = 'diabetic';
  curatedDietaryProducts: Array<Product> = [];

  // --- 3. AI KITCHEN RESTOCK PREDICTOR ---
  restockPredictions: Array<RestockItem> = [];
  restockToast: string = '';

  private subs: Subscription = new Subscription();

  // 5 Featured Slides: Vegetables, Fruits, Greens, Flowers, Oils
  heroSlides = [
    {
      id: 'veg',
      title: 'Farm Fresh Vegetables',
      desc: '100% Organic & handpicked daily from local farms',
      badge: 'Farm Fresh',
      category: 'Vegetables',
      routerLink: '/products/category/Vegetables',
      bgGradient: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
      imgUrl: 'assets/categories/Thinkspot_veggiesIcon.png',
      btnText: 'Shop Vegetables'
    },
    {
      id: 'fruits',
      title: 'Juicy & Fresh Fruits',
      desc: 'Naturally ripened, nutrient-rich seasonal fruits',
      badge: 'Fresh Harvest',
      category: 'Fruits',
      routerLink: '/products/category/Fruits',
      bgGradient: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
      imgUrl: 'assets/categories/fruitsIcons.png',
      btnText: 'Shop Fruits'
    },
    {
      id: 'greens',
      title: 'Nutritious Fresh Greens',
      desc: 'Crisp, healthy & rich in essential vitamins',
      badge: 'Healthy Greens',
      category: 'Greens',
      routerLink: '/products/category/Greens',
      bgGradient: 'linear-gradient(135deg, #15803d 0%, #166534 100%)',
      imgUrl: 'assets/categories/Thinkspot_greensIcon.png',
      btnText: 'Shop Greens'
    },
    {
      id: 'flowers',
      title: 'Aromatic & Fresh Flowers',
      desc: 'Pooja flowers, garlands and floral arrangements',
      badge: 'Fresh Blooms',
      category: 'Flowers',
      routerLink: '/products/category/Flowers',
      bgGradient: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
      imgUrl: 'assets/categories/Thinkspot_flowers.png',
      btnText: 'Shop Flowers'
    },
    {
      id: 'oils',
      title: 'Pure Woodpressed Oils',
      desc: 'Traditional cold-pressed oils packed with natural nutrients',
      badge: 'Cold Pressed',
      category: 'Oils',
      routerLink: '/products/category/Oils',
      bgGradient: 'linear-gradient(135deg, #b45309 0%, #92400e 100%)',
      imgUrl: 'assets/categories/oil.png',
      btnText: 'Shop Oils'
    }
  ];

  // Quick Perks
  groceryPerks = [
    { icon: 'bolt', title: '8-11 AM Delivery', desc: 'Fresh at doorstep' },
    { icon: 'payments', title: 'COD', desc: 'Pay at door' },
    { icon: 'two_wheeler', title: 'Free Delivery', desc: 'Within 1 km' },
    { icon: 'airline_seat_flat', title: 'FYI', desc: `Every ${this.cartS.storeSettings?.weekly_off_day} we closed.` },
  ];

  activeSlideIndex: number = 0;
  private autoSlideInterval: any;

  get weeklyOffDay(): string {
    return this.cartS.storeSettings?.weekly_off_day || 'None';
  }

  get isWeeklyOffActive(): boolean {
    const off = this.weeklyOffDay;
    return Boolean(off && off !== 'None' && off.trim() !== '');
  }

  get previousDayToWeeklyOff(): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const off = this.weeklyOffDay;
    const idx = days.indexOf(off);
    if (idx === -1) return '';
    const prevIdx = (idx - 1 + 7) % 7;
    return days[prevIdx];
  }

  get nextOperatingDayAfterOff(): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const off = this.weeklyOffDay;
    const idx = days.indexOf(off);
    if (idx === -1) return '';
    const nextIdx = (idx + 1) % 7;
    return days[nextIdx];
  }

  get isTomorrowWeeklyOff(): boolean {
    if (!this.isWeeklyOffActive) return false;
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const ist = this.cartS.getIstParts();
    const tomorrowIndex = (ist.day + 1) % 7;
    const tomorrowName = days[tomorrowIndex].toLowerCase();
    const offName = this.weeklyOffDay.toLowerCase().trim();
    return (tomorrowName === offName || tomorrowName.startsWith(offName) || offName.startsWith(tomorrowName));
  }

  get todayDayName(): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const ist = this.cartS.getIstParts();
    return days[ist.day];
  }

  // --- Off-Day First Login / Visit Popup ---
  showOffDayPopup: boolean = false;
  offDayPopupProgress: number = 100;
  private popupProgressInterval: any = null;

  checkAndTriggerOffDayPopup() {
    if (!this.isTomorrowWeeklyOff) {
      return;
    }

    if (this.showOffDayPopup) {
      return;
    }

    setTimeout(() => {
      if (this.isTomorrowWeeklyOff) {
        this.showOffDayPopup = true;
        this.startPopupAutoDismiss(7000);
        this.cdr.detectChanges();
      }
    }, 400);
  }

  startPopupAutoDismiss(durationMs: number = 7000) {
    if (this.popupProgressInterval) {
      clearInterval(this.popupProgressInterval);
    }
    const startTime = Date.now();
    this.popupProgressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remainingPct = Math.max(0, 100 - (elapsed / durationMs) * 100);
      this.offDayPopupProgress = remainingPct;
      this.cdr.detectChanges();
      if (remainingPct <= 0) {
        this.closeOffDayPopup();
      }
    }, 50);
  }

  closeOffDayPopup() {
    this.showOffDayPopup = false;
    if (this.popupProgressInterval) {
      clearInterval(this.popupProgressInterval);
      this.popupProgressInterval = null;
    }
    this.cdr.detectChanges();
  }

  constructor(
    public cartS: CartService,
    public loginS: LoginService,
    public orderService: OrderService,
    private aiS: AiService,
    private cdr: ChangeDetectorRef
  ) {
    this.cartS.headerChangeEvent.next("type1");

    this.cartS.loadCategories().subscribe({
      next: (cats: any[]) => {
        if (cats && cats.length > 0) {
          this.categories = cats.map(c => ({
            name: c.name,
            imgUrl: c.imgUrl || "assets/categories/Thinkspot_veggiesIcon.png",
            routerLink: "/products/category/" + c.cat
          }));
        }
      }
    });

    this.updateGreeting();

    this.subs.add(
      this.loginS.loginChangeEvent.subscribe((res: string) => {
        if (res === Common.loginStatus.LOGIN) {
          this.user = this.loginS.user;
          this.userName = this.user.address?.name || "there";
          this.loginS.readWallet();
          this.orderService.getOrders();
          this.loadRecentPurchases();
        } else if (res === Common.loginStatus.LOGOUT) {
          this.user = this.loginS.user;
          this.userName = "there";
          this.activeUpcomingOrder = null;
          this.recent_products = [];
          this.recentPurchasesLoadedMobile = '';
          this.walletBalance = 0;
          this.calculateRestockPredictions();
        }
      })
    );

    this.subs.add(
      this.loginS.walletUpdateEvent.subscribe(() => {
        this.walletBalance = this.loginS.user?.wallet || 0;
      })
    );

    this.subs.add(
      this.orderService.ordersEvent.subscribe((orders: Array<any>) => {
        if (orders && Array.isArray(orders)) {
          const upcoming = orders.filter(
            (o) => o.status === 'PLACED' || o.status === 'PACKED' || o.status === 'OUT_FOR_DELIVERY'
          );
          if (upcoming.length > 0) {
            this.activeUpcomingOrder = upcoming[0];
            this.activeUpcomingOrder.delivery_date = this.safeDate(this.activeUpcomingOrder.delivery_date);
          } else {
            this.activeUpcomingOrder = null;
          }
        }
      })
    );

    // Read hero promo banners
    this.subs.add(
      this.cartS.getHeroBanners().subscribe((banners: any[]) => {
        if (banners && banners.length > 0) {
          const activeSlides = banners.filter(b => b.active !== false);
          this.heroSlides = activeSlides.length > 0 ? activeSlides : banners;
          if (this.activeSlideIndex >= this.heroSlides.length) {
            this.activeSlideIndex = 0;
          }
        }
      })
    );

    // Read banners
    this.cartS.readBanners("products/download_table_sql.php", { 'table_name': 'banners' }).subscribe((banners: any) => {
      this.bannerDownloadFlg = false;
      this.banners = [];
      if (Array.isArray(banners)) {
        banners.forEach(element => {
          this.banners.push({
            index: element.index,
            routeUrl: element.route_url,
            bgClr: element.bg_clr,
            title: element.title,
            desc: element.description
          });
        });
        this.banners.sort((a: Banner, b: Banner) => (a.index - b.index));
      }
    });

    this.subs.add(
      this.cartS.zoneChangeEvent.subscribe({
        next: (zone: string) => {
          if (zone) {
            const tableName = this.cartS.zoneTablePicker(zone);
            this.cartS.readRecommendedProducts(tableName).subscribe((data: any) => {
              this.recommended_products = data || [];
              this.syncProductUnits(this.recommended_products);
              this.filterDietaryProducts(this.activeDietaryGoalId);
              this.calculateRestockPredictions();
            });
            this.loadBatterProducts(tableName);
          }
        }
      })
    );

    this.subs.add(
      this.cartS.notifyCartEvent.subscribe(() => {
        this.syncAllProductUnits();
      })
    );

    this.subs.add(
      this.loginS.addressChangeEvent.subscribe(() => {
        this.user = this.loginS.user;
        this.userName = this.user?.address?.name || "there";
      })
    );

    this.subs.add(
      this.cartS.cartUpdateEvent.subscribe(() => {
        this.cartBarVisibilityFlg = (this.cartS.cartDetails.totalItems > 0);
        this.syncAllProductUnits();
      })
    );

    this.subs.add(
      this.cartS.notifyCartEvent.subscribe(() => {
        this.cartBarVisibilityFlg = (this.cartS.cartDetails.totalItems > 0);
        this.syncAllProductUnits();
      })
    );

    this.subs.add(
      this.cartS.storeSettingsUpdateEvent.subscribe(() => {
        this.checkAndTriggerOffDayPopup();
      })
    );
  }

  private isRecentPurchasesLoading: boolean = false;
  recentPurchasesLoadedMobile: string = '';

  loadRecentPurchases(force: boolean = false) {
    const mobile = this.loginS.user?.mobile;
    if (!mobile) {
      this.recent_products = [];
      this.recentPurchasesLoadedMobile = '';
      this.calculateRestockPredictions();
      return;
    }
    if (!force && (this.isRecentPurchasesLoading || this.recentPurchasesLoadedMobile === mobile)) {
      return;
    }
    this.isRecentPurchasesLoading = true;
    this.cartS.readRecentPurchases(mobile, force).subscribe({
      next: (data: any) => {
        this.isRecentPurchasesLoading = false;
        this.recentPurchasesLoadedMobile = mobile;
        if (Array.isArray(data) && data.length > 0) {
          this.recent_products = data;
          this.syncProductUnits(this.recent_products);
        } else {
          this.recent_products = [];
        }
        this.calculateRestockPredictions();
      },
      error: () => {
        this.isRecentPurchasesLoading = false;
        this.recentPurchasesLoadedMobile = mobile;
        this.recent_products = [];
        this.calculateRestockPredictions();
      }
    });
  }

  loadBatterProducts(tableName?: string) {
    this.cartS.readBatterProducts(tableName).subscribe({
      next: (data: any) => {
        if (Array.isArray(data) && data.length > 0) {
          this.batter_products = data;
          this.syncProductUnits(this.batter_products);
          this.calculateRestockPredictions();
        } else {
          this.batter_products = [];
        }
      },
      error: () => {
        this.batter_products = [];
      }
    });
  }

  syncAllProductUnits() {
    this.syncProductUnits(this.recommended_products);
    this.syncProductUnits(this.recent_products);
    this.syncProductUnits(this.batter_products);
    this.syncProductUnits(this.curatedDietaryProducts);
    if (this.chatMessages && this.chatMessages.length > 0) {
      for (let msg of this.chatMessages) {
        if (msg.products && msg.products.length > 0) {
          this.syncProductUnits(msg.products);
        }
      }
    }
    if (this.restockPredictions && this.restockPredictions.length > 0) {
      this.syncProductUnits(this.restockPredictions.map(r => r.product));
    }
  }

  syncProductUnits(productList: Array<Product>) {
    if (!productList || !Array.isArray(productList)) return;
    for (let pro of productList) {
      if (!pro) continue;
      pro.disabled = String(pro.disabled) === 'true';
      if (!pro['unit_price'] || isNaN(Number(pro['unit_price'])) || Number(pro['unit_price']) <= 0) {
        pro['unit_price'] = Number(pro.price || 0);
      }
      if (!pro['unit_original_price']) {
        pro['unit_original_price'] = Number(pro.original_price || pro['unit_price'] || 0);
      }
      if (!pro['base_weight']) {
        pro['base_weight'] = pro.weight || 500;
      }
      if (!pro['base_unit_name']) {
        pro['base_unit_name'] = pro.unit_name || 'grams';
      }

      const cartItem = this.cartS.cartProducts[pro.id];
      if (cartItem && cartItem["units"] > 0) {
        pro.units = cartItem["units"];
        pro.price = (cartItem["price"] !== undefined && cartItem["price"] !== null) ? cartItem["price"] : Math.round(Number(pro['unit_price']) * pro.units);
        pro.original_price = (cartItem["original_price"] !== undefined && cartItem["original_price"] !== null) ? cartItem["original_price"] : Math.round(Number(pro['unit_original_price']) * pro.units);
        pro.updated_weight = (cartItem["updated_weight"] !== undefined && cartItem["updated_weight"] !== null) ? cartItem["updated_weight"] : (Number(pro['base_weight']) * pro.units);
        pro.unit_name = cartItem["unit_name"] || pro.unit_name;
      } else {
        pro.units = 0;
        pro.price = Number(pro['unit_price']);
        pro.original_price = Number(pro['unit_original_price']);
        pro.updated_weight = pro['base_weight'];
        pro.unit_name = pro['base_unit_name'];
      }
    }
  }

  // --- 1. SMART AI CHAT SHOPPING ASSISTANT LOGIC ---

  openChatModal(initialQuery?: string) {
    this.showAiChatModal = true;
    if (!this.chatMessages || this.chatMessages.length === 0) {
      this.initWelcomeMessage();
    }
    if (initialQuery && initialQuery.trim()) {
      setTimeout(() => {
        this.sendChatMessage(initialQuery);
      }, 250);
    }
    this.scrollToBottom();
  }

  closeChatModal() {
    this.showAiChatModal = false;
  }

  initWelcomeMessage() {
    this.chatMessages = [
      {
        id: 'msg_welcome',
        sender: 'assistant',
        text: `👋 **Welcome to TomorrowNeeds AI Assistant!**\n\nHow can I help you today?\n• 📦 **My Orders & Tracking** — View past & live deliveries\n• 📍 **Saved Delivery Addresses** — View your saved locations\n• 🍲 **Authentic Recipes & Kits** — Sambar, Veg Kurma, Salad, Dosa\n• 🥗 **Personalized Diets** — Diabetic-care, High Protein, Detox\n• 🛒 **Quick Cart Order** — e.g. *"Add 1kg Tomato and 500g Onion"*\n\nAsk any question or tap a suggestion below to get started!`,
        time: this.getCurrentTimeString()
      }
    ];
  }

  clearChatHistory() {
    this.initWelcomeMessage();
    this.showChatToast('Chat history cleared');
  }

  goToOrdersPage() {
    this.closeChatModal();
    this.cartS.router.navigate(['/home/orders']);
  }

  goToProfilePage() {
    this.closeChatModal();
    this.cartS.router.navigate(['/home/profile']);
  }

  getCurrentTimeString(): string {
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  }

  parseChatCommand(text: string): { isAddCommand: boolean; isAddAll: boolean; quantity: number; targetItem: string } {
    const raw = text.toLowerCase().trim();

    // Check for "add all" intent
    const isAddAll = /\b(add all|add them all|add everything|put all|all to cart|ellathaiyum|all add)\b/i.test(raw);
    if (isAddAll) {
      return { isAddCommand: true, isAddAll: true, quantity: 1, targetItem: '' };
    }

    // Check for "add" / cart addition keyword intent
    const hasAddKeyword = /\b(add|buy|put|podu|serka|cart|order|venum|thevai)\b/i.test(raw);
    if (!hasAddKeyword) {
      return { isAddCommand: false, isAddAll: false, quantity: 1, targetItem: '' };
    }

    // Extract quantity (e.g. "add 2 apples" -> 2, "add 1kg" -> 1)
    let quantity = 1;
    const numMatch = raw.match(/\b(\d+)\s*(kg|kilo|packet|pack|litre|litres|grams|gram|units|unit|nos)?\b/);
    if (numMatch && numMatch[1]) {
      const parsedNum = parseInt(numMatch[1], 10);
      if (parsedNum > 0 && parsedNum <= 20) {
        quantity = parsedNum;
      }
    }

    // Extract clean target item name
    const target = raw
      .replace(/\b(please|kindly|can you|could you|i want to|i need to|i want|i need)\b/gi, '')
      .replace(/\b(add|buy|put|podu|serka|cart|order|into cart|in cart|to cart|to my cart|in my cart|pannu|venum|thevai|kudu)\b/gi, '')
      .replace(/\b(\d+)\s*(kg|kilo|packet|pack|litre|litres|grams|gram|units|unit|nos)?\b/gi, '')
      .trim();

    return {
      isAddCommand: true,
      isAddAll: false,
      quantity,
      targetItem: target
    };
  }

  findMatchingProduct(target: string, products: Product[]): Product | null {
    if (!target || !products || products.length === 0) return null;
    const cleanTarget = target.toLowerCase().trim();
    const exact = products.find(p => p.name.toLowerCase().includes(cleanTarget) || (p['tamil_name'] && p['tamil_name'].toLowerCase().includes(cleanTarget)));
    if (exact) return exact;

    const words = cleanTarget.split(/\s+/).filter(w => w.length > 2);
    for (let word of words) {
      const match = products.find(p => p.name.toLowerCase().includes(word) || (p['tamil_name'] && p['tamil_name'].toLowerCase().includes(word)));
      if (match) return match;
    }
    return null;
  }

  sendChatMessage(queryText?: string) {
    const text = (queryText || this.chatInputText || '').trim();
    if (!text || this.isAiChatProcessing) return;

    this.chatInputText = '';

    // Append user message
    const userMsg: AiChatMessage = {
      id: 'usr_' + Date.now(),
      sender: 'user',
      text: text,
      time: this.getCurrentTimeString()
    };
    this.chatMessages.push(userMsg);
    this.scrollToBottom();

    const cmd = this.parseChatCommand(text);

    this.isAiChatProcessing = true;
    this.scrollToBottom();

    let userMobile = '';
    if (this.loginS.user?.mobile && this.loginS.user.mobile !== 'xxxxxxxxxx') {
      userMobile = this.loginS.user.mobile;
    } else {
      const stored = localStorage.getItem('tnk_local_user') || sessionStorage.getItem('tnk_local_user') || '';
      if (stored && stored !== 'xxxxxxxxxx') {
        userMobile = stored;
      }
    }

    this.aiS.askAssistant(text, userMobile).subscribe({
      next: (res: AiMessageResponse) => {
        this.isAiChatProcessing = false;
        let replyText = res.reply || 'Here are the fresh farm items matching your request!';
        let matchedProducts: Array<Product> = [];

        // Address fallback from local LoginService state if needed
        let addresses = (res.user_addresses && res.user_addresses.length > 0) ? res.user_addresses : undefined;
        const isAddrQuery = /\b(address|addresses|location|where.*deliver)\b/i.test(text);
        if (!addresses && isAddrQuery) {
          if (this.loginS.user?.addresses && this.loginS.user.addresses.length > 0) {
            addresses = this.loginS.user.addresses.map((a: any, idx: number) => ({
              id: a.id || idx,
              title: a.title || a.landmark || 'Delivery Address',
              name: a.name || this.loginS.user?.name || '',
              address: a.address || '',
              pincode: a.pincode || this.loginS.user?.pincode || '',
              landmark: a.landmark || '',
              is_default: a.default || a.is_default || a.active || 0,
              default: a.default || a.is_default || a.active || 0,
              active: a.active || 0
            }));
            if (replyText.includes('No Saved Addresses Found') || replyText.includes('Saved Addresses Access')) {
              replyText = `📍 **Your Saved Delivery Addresses:**\n\n` +
                addresses.map(a => `• **${a.title}**${(a.is_default ? ' ⭐ *(Default)*' : '')}\n  - **Address:** ${a.address}\n  - **Pincode:** ${a.pincode}`).join('\n\n') +
                `\n\n👉 *Morning doorstep deliveries will be dispatched to your default address.*`;
            }
          } else if (this.loginS.user?.address && this.loginS.user.address.address) {
            const singleAddr: any = this.loginS.user.address;
            addresses = [{
              id: singleAddr.id || 1,
              title: singleAddr.title || singleAddr.landmark || 'Home',
              name: singleAddr.name || this.loginS.user?.name || '',
              address: singleAddr.address || '',
              pincode: singleAddr.pincode || this.loginS.user?.pincode || '',
              landmark: singleAddr.landmark || '',
              is_default: 1,
              default: 1,
              active: 1
            }];
            if (replyText.includes('No Saved Addresses Found') || replyText.includes('Saved Addresses Access')) {
              replyText = `📍 **Your Saved Delivery Address:**\n\n• **${addresses[0].title}** ⭐ *(Default)*\n  - **Address:** ${addresses[0].address}\n  - **Pincode:** ${addresses[0].pincode}\n\n👉 *Morning doorstep deliveries will be dispatched to your default address.*`;
            }
          }
        }

        // Orders fallback from local OrderService state if needed
        let orders = (res.user_orders && res.user_orders.length > 0) ? res.user_orders : undefined;
        const isOrdQuery = /\b(order|orders|track|status)\b/i.test(text);
        const localOrders = this.orderService.ordersEvent?.value;
        if (!orders && isOrdQuery && Array.isArray(localOrders) && localOrders.length > 0) {
          orders = localOrders.slice(0, 5).map((o: any) => ({
            order_id: o.order_id,
            status: o.status || 'PLACED',
            total_amount: Number(o.total_amount || 0),
            delivery_date: o.delivery_date,
            delivery_slot_label: o.delivery_slot_label || 'Anytime Delivery',
            created_at: o.created_at,
            items: (o.items || []).map((it: any) => ({
              name: it.product_name || it.name || 'Item',
              quantity: Number(it.quantity || 1),
              price: Number(it.price || 0)
            }))
          }));
          if (replyText.includes('No Recent Orders Found') || replyText.includes('Order History Access')) {
            replyText = `📦 **Your Recent Orders:**\n\n` +
              orders.map(o => `• **Order #${o.order_id}** — **${o.status}** (₹${o.total_amount})`).join('\n') +
              `\n\n👉 *You can view full details or re-order anytime from the Orders tab!*`;
          }
        }

        if (res.suggested_products && res.suggested_products.length > 0) {
          matchedProducts = res.suggested_products.map((p: any) => ({
            ...p,
            id: String(p.id),
            units: this.cartS.cartProducts[p.id]?.units || 0
          }));
          this.syncProductUnits(matchedProducts);

          // Instant Auto-Add if user explicitly gave an Add command
          if (cmd.isAddCommand) {
            if (cmd.isAddAll) {
              this.addAllChatProductsToCart(matchedProducts);
              replyText = `🛒 **Added all ${matchedProducts.length} items to your cart!**\n\n` + replyText;
            } else {
              const matchedProd = this.findMatchingProduct(cmd.targetItem, matchedProducts) || matchedProducts[0];
              if (matchedProd && !matchedProd.disabled) {
                const targetUnits = (matchedProd.units || 0) + cmd.quantity;
                this.plusMinusValue(targetUnits, matchedProd);
                this.showChatToast(`🛒 Added ${cmd.quantity}x ${matchedProd.name} to Cart!`);
                replyText = `🛒 **Added ${cmd.quantity}x ${matchedProd.name} to your cart!**\n\n` + replyText;
              }
            }
          }
        }

        const assistantMsg: AiChatMessage = {
          id: 'ai_' + Date.now(),
          sender: 'assistant',
          text: replyText,
          time: this.getCurrentTimeString(),
          products: matchedProducts,
          orders: orders,
          addresses: addresses
        };
        this.chatMessages.push(assistantMsg);
        this.syncAllProductUnits();
        this.scrollToBottom();
        this.cdr.detectChanges();
      },
      error: () => {
        this.isAiChatProcessing = false;
        this.chatMessages.push({
          id: 'ai_' + Date.now(),
          sender: 'assistant',
          text: "I'm having a little trouble reaching our AI assistant server right now, but feel free to browse all fresh vegetables and daily farm essentials!",
          time: this.getCurrentTimeString()
        });
        this.scrollToBottom();
        this.cdr.detectChanges();
      }
    });
  }

  addAllChatProductsToCart(products?: Array<Product>) {
    const list = products || [];
    if (!list || list.length === 0) return;
    for (let p of list) {
      if (!p.disabled) {
        const targetUnits = (p.units || 0) > 0 ? p.units : 1;
        this.plusMinusValue(targetUnits, p);
      }
    }
    this.showChatToast(`Added all ${list.length} items to cart!`);
  }

  showChatToast(msg: string) {
    this.chatToastMsg = msg;
    setTimeout(() => {
      this.chatToastMsg = '';
      this.cdr.detectChanges();
    }, 3000);
  }

  showToast(msg: string) {
    this.showChatToast(msg);
  }

  formatChatMessage(text: string): string {
    if (!text) return '';
    let formatted = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Bold **text**
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic *text*
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Bullet points
    formatted = formatted.replace(/(^|\n)[•\-\*]\s+(.*)/g, '$1<div class="chat-bullet-item"><span class="bullet-dot">•</span><span>$2</span></div>');
    // Newlines
    formatted = formatted.replace(/\n/g, '<br>');
    return formatted;
  }

  scrollToBottom() {
    setTimeout(() => {
      try {
        if (this.chatScrollContainer && this.chatScrollContainer.nativeElement) {
          this.chatScrollContainer.nativeElement.scrollTop = this.chatScrollContainer.nativeElement.scrollHeight;
        }
      } catch (e) { }
    }, 80);
  }

  // --- 2. AI HEALTH & DIETARY CURATIONS LOGIC (100% Free Smart Deterministic Intelligence) ---

  selectDietaryGoal(goalId: string) {
    this.activeDietaryGoalId = goalId;
    this.filterDietaryProducts(goalId);
  }

  getActiveGoal(): DietaryGoal {
    return this.dietaryGoals.find(g => g.id === this.activeDietaryGoalId) || this.dietaryGoals[0];
  }

  filterDietaryProducts(goalId: string) {
    const goal = this.dietaryGoals.find(g => g.id === goalId) || this.dietaryGoals[0];
    const sourcePool = [...(this.recommended_products || []), ...(this.batter_products || [])];

    if (sourcePool.length === 0) {
      this.curatedDietaryProducts = [];
      return;
    }

    const filtered = sourcePool.filter(p => {
      const name = (p.name || '').toLowerCase();
      const cat = (p.cat || '').toLowerCase();
      const tamil = (p.tamil_name || '').toLowerCase();
      return goal.keywords.some(k => name.includes(k) || cat.includes(k) || tamil.includes(k));
    });

    // Remove duplicates
    const uniqueMap = new Map<string, Product>();
    filtered.forEach(item => {
      if (!uniqueMap.has(item.id)) {
        uniqueMap.set(item.id, item);
      }
    });

    // Fallback: if very few matched, fill from top recommendations
    if (uniqueMap.size < 3) {
      sourcePool.slice(0, 6).forEach(item => {
        if (!uniqueMap.has(item.id)) {
          uniqueMap.set(item.id, item);
        }
      });
    }

    this.curatedDietaryProducts = Array.from(uniqueMap.values()).slice(0, 8);
    this.syncProductUnits(this.curatedDietaryProducts);
  }

  getDietaryTag(product: Product): string {
    const name = (product.name || '').toLowerCase();
    if (name.includes('bitter') || name.includes('pavakkai') || name.includes('vendakkai') || name.includes('ladies')) return 'Low Glycemic';
    if (name.includes('palak') || name.includes('keerai') || name.includes('methi')) return 'Iron & Fiber';
    if (name.includes('milk') || name.includes('curd') || name.includes('paneer')) return 'Natural Protein';
    if (name.includes('coconut') || name.includes('sorakkai') || name.includes('cucumber')) return 'Electrolytes';
    if (name.includes('ginger') || name.includes('garlic') || name.includes('lemon') || name.includes('amla')) return 'Immunity+';
    if (name.includes('batter')) return 'Stone Ground';
    return '100% Farm Pure';
  }

  // --- 3. AI KITCHEN RESTOCK PREDICTOR LOGIC (Heuristic Replenishment Velocity) ---

  calculateRestockPredictions() {
    const pool = this.recent_products.length > 0
      ? this.recent_products
      : [...(this.recommended_products || []), ...(this.batter_products || [])];

    if (!pool || pool.length === 0) {
      this.restockPredictions = [];
      return;
    }

    const predictions: RestockItem[] = [];
    const usedIds = new Set<string>();

    for (let prod of pool) {
      if (!prod || usedIds.has(prod.id)) continue;
      usedIds.add(prod.id);

      const name = (prod.name || '').toLowerCase();
      let urgency: 'high' | 'medium' | 'low' = 'medium';
      let urgencyBadge = '🟡 Restock Soon';
      let reason = 'Essential kitchen staple';

      if (name.includes('milk') || name.includes('curd') || name.includes('batter')) {
        urgency = 'high';
        urgencyBadge = '🔴 Need Today';
        reason = 'Daily fresh morning staple (2-day consumption cycle)';
      } else if (name.includes('tomato') || name.includes('onion') || name.includes('potato') || name.includes('chilli')) {
        urgency = 'high';
        urgencyBadge = '🟠 Low Stock';
        reason = 'High-frequency daily cooking base (runs out fast)';
      } else if (name.includes('coriander') || name.includes('keerai') || name.includes('greens') || name.includes('curry')) {
        urgency = 'high';
        urgencyBadge = '🔴 Fresh Harvest';
        reason = 'Best consumed fresh within 48 hours';
      } else if (name.includes('coconut') || name.includes('ginger') || name.includes('garlic')) {
        urgency = 'medium';
        urgencyBadge = '🟡 Restock Soon';
        reason = 'Weekly seasoning & hydration essential';
      } else {
        urgency = 'low';
        urgencyBadge = '🟢 Replenish';
        reason = 'Nutritious farm addition to your pantry';
      }

      predictions.push({
        product: prod,
        urgency,
        urgencyBadge,
        reason
      });

      if (predictions.length >= 6) break;
    }

    // Sort: high urgency first
    predictions.sort((a, b) => {
      const rank = { high: 3, medium: 2, low: 1 };
      return rank[b.urgency] - rank[a.urgency];
    });

    this.restockPredictions = predictions;
    this.syncProductUnits(this.restockPredictions.map(r => r.product));
  }

  restockAllPredictedItems() {
    if (!this.restockPredictions || this.restockPredictions.length === 0) return;
    let addedCount = 0;
    for (let item of this.restockPredictions) {
      if (!item.product.disabled && (item.product.in_stock !== false)) {
        this.plusMinusValue(1, item.product);
        addedCount++;
      }
    }
    this.restockToast = `⚡ Added ${addedCount} predicted essentials to your cart!`;
    setTimeout(() => {
      this.restockToast = '';
      this.cdr.detectChanges();
    }, 3500);
  }

  updateGreeting() {
    const ist = this.cartS.getIstParts();
    const hour = ist.hours;
    if (hour >= 4 && hour < 12) {
      this.greetingData = { greeting: 'Good morning', icon: 'wb_sunny' };
    } else if (hour >= 12 && hour < 17) {
      this.greetingData = { greeting: 'Good afternoon', icon: 'light_mode' };
    } else if (hour >= 17 && hour < 22) {
      this.greetingData = { greeting: 'Good evening', icon: 'wb_twilight' };
    } else {
      this.greetingData = { greeting: 'Good night', icon: 'bedtime' };
    }
  }

  safeDate(rawDate: any): Date {
    if (!rawDate || rawDate === "undefined" || rawDate === "null" || rawDate === "0000-00-00 00:00:00" || rawDate === "0000-00-00") {
      let d = new Date(this.cartS.serverTime);
      d.setDate(d.getDate() + 1);
      return d;
    }
    if (rawDate instanceof Date) return isNaN(rawDate.getTime()) ? new Date(this.cartS.serverTime) : rawDate;
    const d = new Date(rawDate);
    return isNaN(d.getTime()) ? new Date(this.cartS.serverTime) : d;
  }

  formatShortId(orderId: string): string {
    if (!orderId) return '';
    const parts = String(orderId).split('_');
    if (parts.length >= 3) return '#' + parts[parts.length - 1];
    if (orderId.length > 8) return '#' + orderId.slice(-5);
    return '#' + orderId;
  }

  isTomorrow(d: any): boolean {
    if (!d) return false;
    const ist = this.cartS.getIstParts();
    const tomorrow = new Date(ist.year, ist.month, ist.date + 1);
    const checkDate = (d instanceof Date) ? d : new Date(d);
    if (isNaN(checkDate.getTime())) return false;
    return checkDate.getDate() === tomorrow.getDate() && checkDate.getMonth() === tomorrow.getMonth() && checkDate.getFullYear() === tomorrow.getFullYear();
  }

  isProductInStock(product: Product): boolean {
    if (!product || product.disabled) return false;
    if (product.is_unlimited === true || Number(product.is_unlimited) === 1 || String(product.is_unlimited) === '1') return true;
    if (product.in_stock === false || Number(product.in_stock) === 0 || String(product.in_stock) === '0') return false;
    return (product.stock_qty === undefined || product.stock_qty === null || Number(product.stock_qty) > 0);
  }

  getMaxStock(product: Product): number {
    if (!product) return 99;
    if (product.is_unlimited === true || Number(product.is_unlimited) === 1 || String(product.is_unlimited) === '1') return 99;
    if (product.stock_qty !== undefined && product.stock_qty !== null && Number(product.stock_qty) > 0) {
      return Number(product.stock_qty);
    }
    return 99;
  }

  getAddressShortText(): string {
    if (this.loginS.user?.address) {
      const a = this.loginS.user.address;
      return a.address || a.title || a.pincode || 'Select Location';
    }
    return 'Select Location';
  }

  openAddressSelector() {
    this.loginS.headerAddressSelectionEvent.next(true);
  }

  goToWallet() {
    this.cartS.router.navigate(['/home/wallet']);
  }

  goToOrders() {
    this.cartS.router.navigate(['/home/orders']);
  }

  goToSearch() {
    this.cartS.router.navigate(['/products/search']);
  }

  goToCategory(catName: string) {
    this.cartS.router.navigate(['/products/category/' + catName]);
  }

  viewProductDetail(product: Product): void {
    if (product && product.id) {
      this.cartS.router.navigate(['/products/details/' + product.id]);
    }
  }

  sellAllAction() {
    this.cartS.router.navigate(['/products/category/Vegetables']);
  }

  ngOnInit(): void {
    this.userName = this.loginS.user?.address?.name || "there";
    this.walletBalance = this.loginS.user?.wallet || 0;
    this.recommended_products = this.cartS.recommendedProducts || [];
    this.syncAllProductUnits();
    this.startAutoSlide();
    this.checkAndTriggerOffDayPopup();

    if (this.loginS.user?.mobile) {
      this.loadRecentPurchases();
    }
    this.loadBatterProducts(this.cartS.zoneTablePicker(this.loginS.user?.zone || 'zone1'));
  }

  startAutoSlide() {
    this.stopAutoSlide();
    this.autoSlideInterval = setInterval(() => {
      this.activeSlideIndex = (this.activeSlideIndex + 1) % this.heroSlides.length;
    }, 4000);
  }

  stopAutoSlide() {
    if (this.autoSlideInterval) {
      clearInterval(this.autoSlideInterval);
    }
  }

  goToSlide(index: number) {
    this.activeSlideIndex = index;
    this.startAutoSlide();
  }

  nextSlide(event?: Event) {
    if (event) event.stopPropagation();
    this.activeSlideIndex = (this.activeSlideIndex + 1) % this.heroSlides.length;
    this.startAutoSlide();
  }

  prevSlide(event?: Event) {
    if (event) event.stopPropagation();
    this.activeSlideIndex = (this.activeSlideIndex - 1 + this.heroSlides.length) % this.heroSlides.length;
    this.startAutoSlide();
  }

  onBannerClick(slide: any) {
    this.cartS.router.navigate([slide.routerLink]);
  }

  plusMinusValue(val: number, product: Product) {
    this.cartS.cartUpdateEvent.next({ cart: this.cartS.cartProducts, product: product, unit: val });
  }

  ngOnDestroy(): void {
    this.stopAutoSlide();
    this.closeOffDayPopup();
    this.subs.unsubscribe();
  }
}

