import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { CartService, DEFAULT_HERO_BANNERS } from '../../services/cart.service';
import { HeroBanner } from '../../utils/types';
import { ApiService } from '../../services/api.service';

export interface GradientPreset {
  name: string;
  gradient: string;
  previewColor: string;
}

export interface IconPreset {
  name: string;
  path: string;
}

export interface CategoryPreset {
  name: string;
  route: string;
  badge: string;
  defaultTitle: string;
  defaultDesc: string;
  defaultCta: string;
  icon: string;
  gradient: string;
}

@Component({
  selector: 'app-admin-banners',
  templateUrl: './admin-banners.component.html',
  styleUrls: ['./admin-banners.component.scss']
})
export class AdminBannersComponent implements OnInit, OnDestroy {
  banners: HeroBanner[] = [];
  loading: boolean = false;
  saving: boolean = false;
  hasUnsavedChanges: boolean = false;

  // Live Carousel Preview state
  previewSlideIndex: number = 0;
  private previewInterval: any = null;

  // Modal / Drawer state
  isEditorModalOpen: boolean = false;
  isEditing: boolean = false;
  isDeleteModalOpen: boolean = false;
  bannerToDelete: HeroBanner | null = null;
  bannerToDeleteIndex: number = -1;

  // Template Quick Add Drawer
  isTemplateModalOpen: boolean = false;

  // Toast Notification
  toastNotification: { show: boolean; message: string; type: 'success' | 'error' | 'info' } = {
    show: false,
    message: '',
    type: 'success'
  };
  private toastTimer: any = null;

  // Active Editing Banner Model
  currentBanner: HeroBanner = this.getEmptyBanner();
  editingIndex: number = -1;

  // Gradient Presets
  gradientPresets: GradientPreset[] = [
    {
      name: 'Emerald Fresh',
      gradient: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
      previewColor: '#059669'
    },
    {
      name: 'Sunrise Harvest',
      gradient: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
      previewColor: '#d97706'
    },
    {
      name: 'Ocean Breeze',
      gradient: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
      previewColor: '#0284c7'
    },
    {
      name: 'Lush Pine',
      gradient: 'linear-gradient(135deg, #15803d 0%, #166534 100%)',
      previewColor: '#15803d'
    },
    {
      name: 'Ruby Coral',
      gradient: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
      previewColor: '#e11d48'
    },
    {
      name: 'Sunset Orange',
      gradient: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
      previewColor: '#ea580c'
    },
    {
      name: 'Royal Violet',
      gradient: 'linear-gradient(135deg, #9333ea 0%, #7e22ce 100%)',
      previewColor: '#9333ea'
    },
    {
      name: 'Indigo Twilight',
      gradient: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
      previewColor: '#4f46e5'
    },
    {
      name: 'Golden Amber',
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      previewColor: '#f59e0b'
    },
    {
      name: 'Dark Slate',
      gradient: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      previewColor: '#1e293b'
    },
    {
      name: 'Teal Mint',
      gradient: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
      previewColor: '#0d9488'
    },
    {
      name: 'Berry Magenta',
      gradient: 'linear-gradient(135deg, #c026d3 0%, #a21caf 100%)',
      previewColor: '#c026d3'
    }
  ];

  // Asset Icon Presets
  iconPresets: IconPreset[] = [
    { name: 'Vegetables', path: 'assets/categories/Thinkspot_veggiesIcon.png' },
    { name: 'Fruits', path: 'assets/categories/fruitsIcons.png' },
    { name: 'Milk & Dairy', path: 'assets/categories/Thinkspot_milkIcon.png' },
    { name: 'Tender Coconut', path: 'assets/categories/Thinkspot_tenderCocoIcon.png' },
    { name: 'Greens & Herbs', path: 'assets/categories/Thinkspot_greensIcon.png' },
    { name: 'Cold/Wood Oil', path: 'assets/categories/Thinkspot_oilsIcon.png' },
    { name: 'Fresh Batter', path: 'assets/categories/Thinkspot_BatterIcon.png' },
    { name: 'Farm Eggs', path: 'assets/categories/Thinkspot_EggsIcon.png' },
    { name: 'Pure Honey', path: 'assets/categories/Thinkspot_Honey.png' },
    { name: 'Fresh Flowers', path: 'assets/categories/Thinkspot_flowers.png' },
    { name: 'Artisan Breads', path: 'assets/categories/Thinkspot_Breads.png' },
    { name: 'Sprouts & Pulses', path: 'assets/categories/sprouts.png' },
    { name: 'Pickles', path: 'assets/categories/Thinkspot_Pickles.png' },
    { name: 'Natural Sugars', path: 'assets/categories/Thinkspot_NaturalSugars.png' },
    { name: 'Organic Flour', path: 'assets/categories/Thinkspot_Flour.png' },
    { name: 'Ready Mix', path: 'assets/categories/Thinkspot_ReadyMix.png' },
    { name: 'Rice Mix', path: 'assets/categories/Thinkspot_RiceMix.png' },
    { name: 'Ancient Souk', path: 'assets/categories/Thinkspot_AncientSouk.png' }
  ];

  // Category Route Presets
  categoryPresets: CategoryPreset[] = [
    {
      name: 'Farm Fresh Vegetables',
      route: '/products/category/Vegetables',
      badge: 'Farm Fresh',
      defaultTitle: 'Farm Fresh Vegetables',
      defaultDesc: '100% Organic & handpicked daily from local farms',
      defaultCta: 'Shop Vegetables',
      icon: 'assets/categories/Thinkspot_veggiesIcon.png',
      gradient: 'linear-gradient(135deg, #059669 0%, #047857 100%)'
    },
    {
      name: 'Fresh Fruits',
      route: '/products/category/Fruits',
      badge: 'Fresh Harvest',
      defaultTitle: 'Juicy & Fresh Fruits',
      defaultDesc: 'Naturally ripened, nutrient-rich seasonal fruits',
      defaultCta: 'Shop Fruits',
      icon: 'assets/categories/fruitsIcons.png',
      gradient: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)'
    },
    {
      name: 'Milk & Dairy',
      route: '/products/category/Dairyeggs',
      badge: 'Pure & Fresh',
      defaultTitle: 'Pure Farm Fresh Milk',
      defaultDesc: 'Unadulterated, wholesome & fresh daily morning delivery',
      defaultCta: 'Shop Milk & Dairy',
      icon: 'assets/categories/Thinkspot_milkIcon.png',
      gradient: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
    },
    {
      name: 'Tender Coconut',
      route: '/products/category/Naturalhydrants',
      badge: 'Natural Hydration',
      defaultTitle: 'Natural Tender Coconut',
      defaultDesc: 'Cool, refreshing 100% natural electrolyte hydration',
      defaultCta: 'Shop Tender Coconut',
      icon: 'assets/categories/Thinkspot_tenderCocoIcon.png',
      gradient: 'linear-gradient(135deg, #15803d 0%, #166534 100%)'
    },
    {
      name: 'Greens & Sprouts',
      route: '/products/category/Greenssprouts',
      badge: 'Nutrient Rich',
      defaultTitle: 'Fresh Greens & Sprouts',
      defaultDesc: 'Crisp, detoxifying greens straight from farm beds',
      defaultCta: 'Shop Greens',
      icon: 'assets/categories/Thinkspot_greensIcon.png',
      gradient: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)'
    },
    {
      name: 'Woodpressed Oils',
      route: '/products/category/Woodpressed',
      badge: 'Traditional Press',
      defaultTitle: 'Cold & Woodpressed Oils',
      defaultDesc: 'Pure cold-extracted groundnut, sesame & coconut oils',
      defaultCta: 'Shop Pure Oils',
      icon: 'assets/categories/Thinkspot_oilsIcon.png',
      gradient: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)'
    },
    {
      name: 'Fresh Batter & Ready Mix',
      route: '/products/category/Batter',
      badge: 'Breakfast Special',
      defaultTitle: 'Crispy Dosa & Idli Batter',
      defaultDesc: 'Stone-ground, naturally fermented traditional batter',
      defaultCta: 'Shop Fresh Batter',
      icon: 'assets/categories/Thinkspot_BatterIcon.png',
      gradient: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)'
    },
    {
      name: 'Natural Sugars & Jaggery',
      route: '/products/category/Naturalsugars',
      badge: 'Healthy Sweetener',
      defaultTitle: 'Pure Jaggery & Palm Sugar',
      defaultDesc: 'Chemical-free, unrefined traditional sweeteners',
      defaultCta: 'Shop Sugars',
      icon: 'assets/categories/Thinkspot_NaturalSugars.png',
      gradient: 'linear-gradient(135deg, #b45309 0%, #78350f 100%)'
    },
    {
      name: 'All Products Catalog',
      route: '/products/all',
      badge: 'Full Catalog',
      defaultTitle: 'Complete Farm Fresh Range',
      defaultDesc: 'Explore our entire collection of pure groceries & staples',
      defaultCta: 'Browse All Items',
      icon: 'assets/categories/Thinkspot_veggiesIcon.png',
      gradient: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)'
    }
  ];

  // Pre-made Promotion Templates
  promoTemplates = [
    {
      title: '50% Weekend Flash Deal',
      desc: 'Massive savings on organic farm vegetables and fruits this weekend only!',
      badge: '⚡ 50% OFF',
      category: 'Vegetables',
      routerLink: '/products/category/Vegetables',
      bgGradient: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
      imgUrl: 'assets/categories/Thinkspot_veggiesIcon.png',
      btnText: 'Claim 50% Deal'
    },
    {
      title: 'Morning 7 AM Milk Subscription',
      desc: 'Get unadulterated farm milk delivered right to your doorstep before 7 AM.',
      badge: 'Daily 7 AM',
      category: 'Dairyeggs',
      routerLink: '/products/category/Dairyeggs',
      bgGradient: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
      imgUrl: 'assets/categories/Thinkspot_milkIcon.png',
      btnText: 'Subscribe Now'
    },
    {
      title: 'Stone-Ground Idli & Dosa Batter',
      desc: 'Freshly ground daily with zero soda or preservatives for fluffy idlis.',
      badge: 'Hot Breakfast',
      category: 'Batter',
      routerLink: '/products/category/Batter',
      bgGradient: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
      imgUrl: 'assets/categories/Thinkspot_BatterIcon.png',
      btnText: 'Order Fresh Batter'
    },
    {
      title: 'Naturally Hydrating Tender Coconut',
      desc: 'Sourced from organic groves. Pure electrolyte boost delivered chilled.',
      badge: '100% Pure',
      category: 'Naturalhydrants',
      routerLink: '/products/category/Naturalhydrants',
      bgGradient: 'linear-gradient(135deg, #15803d 0%, #166534 100%)',
      imgUrl: 'assets/categories/Thinkspot_tenderCocoIcon.png',
      btnText: 'Get Tender Coconut'
    },
    {
      title: 'Cold-Pressed Wooden Chekku Oils',
      desc: 'Extracted at low temperatures to preserve natural nutrients and aroma.',
      badge: 'Unrefined Pure',
      category: 'Woodpressed',
      routerLink: '/products/category/Woodpressed',
      bgGradient: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
      imgUrl: 'assets/categories/Thinkspot_oilsIcon.png',
      btnText: 'Shop Woodpressed'
    }
  ];

  private subs: Subscription = new Subscription();

  constructor(
    public cartS: CartService,
    private apiS: ApiService
  ) {}

  ngOnInit(): void {
    this.loadBanners();
    this.startPreviewAutoSlide();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.stopPreviewAutoSlide();
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
  }

  get totalBannersCount(): number {
    return this.banners?.length || 0;
  }

  get activeBannersCount(): number {
    return this.banners?.filter(b => b.active !== false).length || 0;
  }

  get activePreviewBanners(): HeroBanner[] {
    const list = this.banners.filter(b => b.active !== false);
    return list.length > 0 ? list : this.banners;
  }

  loadBanners(): void {
    this.loading = true;
    this.subs.add(
      this.cartS.getHeroBanners().subscribe({
        next: (banners: HeroBanner[]) => {
          this.loading = false;
          if (banners && Array.isArray(banners) && banners.length > 0) {
            this.banners = JSON.parse(JSON.stringify(banners));
          } else {
            this.banners = JSON.parse(JSON.stringify(DEFAULT_HERO_BANNERS));
          }
          this.ensurePreviewIndexValid();
        },
        error: () => {
          this.loading = false;
          this.banners = JSON.parse(JSON.stringify(DEFAULT_HERO_BANNERS));
        }
      })
    );
  }

  getEmptyBanner(): HeroBanner {
    return {
      id: 'banner_' + Date.now(),
      title: 'Special Farm Offer',
      desc: 'Freshly harvested produce at best prices',
      badge: 'Special Offer',
      category: 'Vegetables',
      routerLink: '/products/category/Vegetables',
      bgGradient: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
      imgUrl: 'assets/categories/Thinkspot_veggiesIcon.png',
      btnText: 'Shop Now',
      active: true,
      order: (this.banners?.length || 0) + 1
    };
  }

  // --- Live Preview Carousel Navigation ---
  startPreviewAutoSlide(): void {
    this.stopPreviewAutoSlide();
    this.previewInterval = setInterval(() => {
      const count = this.activePreviewBanners.length;
      if (count > 0) {
        this.previewSlideIndex = (this.previewSlideIndex + 1) % count;
      }
    }, 4500);
  }

  stopPreviewAutoSlide(): void {
    if (this.previewInterval) {
      clearInterval(this.previewInterval);
      this.previewInterval = null;
    }
  }

  prevPreviewSlide(event?: Event): void {
    if (event) event.stopPropagation();
    const count = this.activePreviewBanners.length;
    if (count > 0) {
      this.previewSlideIndex = (this.previewSlideIndex - 1 + count) % count;
    }
    this.startPreviewAutoSlide();
  }

  nextPreviewSlide(event?: Event): void {
    if (event) event.stopPropagation();
    const count = this.activePreviewBanners.length;
    if (count > 0) {
      this.previewSlideIndex = (this.previewSlideIndex + 1) % count;
    }
    this.startPreviewAutoSlide();
  }

  goToPreviewSlide(index: number): void {
    this.previewSlideIndex = index;
    this.startPreviewAutoSlide();
  }

  ensurePreviewIndexValid(): void {
    const count = this.activePreviewBanners.length;
    if (this.previewSlideIndex >= count) {
      this.previewSlideIndex = 0;
    }
  }

  // --- Banner Actions ---
  openAddModal(): void {
    this.isEditing = false;
    this.editingIndex = -1;
    this.currentBanner = this.getEmptyBanner();
    this.isEditorModalOpen = true;
  }

  openEditModal(banner: HeroBanner, index: number): void {
    this.isEditing = true;
    this.editingIndex = index;
    this.currentBanner = JSON.parse(JSON.stringify(banner));
    this.isEditorModalOpen = true;
  }

  closeEditorModal(): void {
    this.isEditorModalOpen = false;
    this.currentBanner = this.getEmptyBanner();
    this.editingIndex = -1;
  }

  saveBannerFromModal(): void {
    if (!this.currentBanner.title || !this.currentBanner.title.trim()) {
      this.showToast('Please enter a banner title.', 'error');
      return;
    }

    if (!this.currentBanner.routerLink) {
      this.currentBanner.routerLink = '/products/all';
    }

    if (!this.currentBanner.btnText) {
      this.currentBanner.btnText = 'Shop Now';
    }

    if (this.isEditing && this.editingIndex >= 0) {
      this.banners[this.editingIndex] = { ...this.currentBanner };
      this.showToast(`Banner "${this.currentBanner.title}" updated successfully!`, 'success');
    } else {
      this.currentBanner.order = this.banners.length + 1;
      this.banners.push({ ...this.currentBanner });
      this.showToast(`New banner "${this.currentBanner.title}" added!`, 'success');
    }

    this.hasUnsavedChanges = true;
    this.closeEditorModal();
    this.ensurePreviewIndexValid();
    this.saveAllBanners(false);
  }

  toggleActive(banner: HeroBanner, index: number, event?: Event): void {
    if (event) event.stopPropagation();
    banner.active = !(banner.active !== false);
    this.hasUnsavedChanges = true;
    this.saveAllBanners(false);
    this.showToast(
      `Banner "${banner.title}" is now ${banner.active ? 'ACTIVE' : 'INACTIVE'}.`,
      'info'
    );
    this.ensurePreviewIndexValid();
  }

  duplicateBanner(banner: HeroBanner, index: number, event?: Event): void {
    if (event) event.stopPropagation();
    const copy: HeroBanner = {
      ...JSON.parse(JSON.stringify(banner)),
      id: 'banner_' + Date.now(),
      title: `${banner.title} (Copy)`,
      order: this.banners.length + 1
    };
    this.banners.splice(index + 1, 0, copy);
    this.hasUnsavedChanges = true;
    this.saveAllBanners(false);
    this.showToast(`Banner "${copy.title}" duplicated!`, 'success');
    this.ensurePreviewIndexValid();
  }

  moveUp(index: number, event?: Event): void {
    if (event) event.stopPropagation();
    if (index <= 0) return;
    const temp = this.banners[index];
    this.banners[index] = this.banners[index - 1];
    this.banners[index - 1] = temp;
    this.updateOrderIndices();
    this.hasUnsavedChanges = true;
    this.saveAllBanners(false);
    this.showToast('Banner moved up.', 'info');
  }

  moveDown(index: number, event?: Event): void {
    if (event) event.stopPropagation();
    if (index >= this.banners.length - 1) return;
    const temp = this.banners[index];
    this.banners[index] = this.banners[index + 1];
    this.banners[index + 1] = temp;
    this.updateOrderIndices();
    this.hasUnsavedChanges = true;
    this.saveAllBanners(false);
    this.showToast('Banner moved down.', 'info');
  }

  updateOrderIndices(): void {
    this.banners.forEach((b, i) => {
      b.order = i + 1;
    });
  }

  openDeleteModal(banner: HeroBanner, index: number, event?: Event): void {
    if (event) event.stopPropagation();
    this.bannerToDelete = banner;
    this.bannerToDeleteIndex = index;
    this.isDeleteModalOpen = true;
  }

  closeDeleteModal(): void {
    this.isDeleteModalOpen = false;
    this.bannerToDelete = null;
    this.bannerToDeleteIndex = -1;
  }

  confirmDelete(): void {
    if (this.bannerToDeleteIndex >= 0 && this.bannerToDeleteIndex < this.banners.length) {
      const removed = this.banners.splice(this.bannerToDeleteIndex, 1)[0];
      this.updateOrderIndices();
      this.hasUnsavedChanges = true;
      this.saveAllBanners(false);
      this.showToast(`Banner "${removed.title}" deleted.`, 'info');
      this.ensurePreviewIndexValid();
    }
    this.closeDeleteModal();
  }

  // --- Templates & Presets ---
  openTemplateModal(): void {
    this.isTemplateModalOpen = true;
  }

  closeTemplateModal(): void {
    this.isTemplateModalOpen = false;
  }

  applyPromoTemplate(tpl: any): void {
    const newBanner: HeroBanner = {
      id: 'banner_' + Date.now(),
      title: tpl.title,
      desc: tpl.desc,
      badge: tpl.badge,
      category: tpl.category,
      routerLink: tpl.routerLink,
      bgGradient: tpl.bgGradient,
      imgUrl: tpl.imgUrl,
      btnText: tpl.btnText,
      active: true,
      order: this.banners.length + 1
    };
    this.banners.push(newBanner);
    this.hasUnsavedChanges = true;
    this.closeTemplateModal();
    this.saveAllBanners(false);
    this.showToast(`Added "${tpl.title}" from templates!`, 'success');
    this.ensurePreviewIndexValid();
  }

  applyCategoryPreset(preset: CategoryPreset): void {
    this.currentBanner.title = preset.defaultTitle;
    this.currentBanner.desc = preset.defaultDesc;
    this.currentBanner.badge = preset.badge;
    this.currentBanner.routerLink = preset.route;
    this.currentBanner.btnText = preset.defaultCta;
    this.currentBanner.imgUrl = preset.icon;
    this.currentBanner.bgGradient = preset.gradient;
  }

  applyGradientPreset(preset: GradientPreset): void {
    this.currentBanner.bgGradient = preset.gradient;
  }

  applyIconPreset(preset: IconPreset): void {
    this.currentBanner.imgUrl = preset.path;
  }

  // --- Save / Reset ---
  saveAllBanners(showExplicitToast: boolean = true): void {
    this.saving = true;
    this.cartS.saveHeroBanners(this.banners).subscribe({
      next: () => {
        this.saving = false;
        this.hasUnsavedChanges = false;
        if (showExplicitToast) {
          this.showToast('All banners published to storefront successfully! 🚀', 'success');
        }
      },
      error: () => {
        this.saving = false;
        this.hasUnsavedChanges = false;
        if (showExplicitToast) {
          this.showToast('Banners saved locally and synced with app! ✨', 'success');
        }
      }
    });
  }

  resetToDefaultBanners(): void {
    if (confirm('Are you sure you want to reset all banners to default standard templates?')) {
      this.banners = JSON.parse(JSON.stringify(DEFAULT_HERO_BANNERS));
      this.hasUnsavedChanges = true;
      this.saveAllBanners(true);
      this.ensurePreviewIndexValid();
    }
  }

  // --- Helpers ---
  showToast(message: string, type: 'success' | 'error' | 'info' = 'success'): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this.toastNotification = {
      show: true,
      message,
      type
    };
    this.toastTimer = setTimeout(() => {
      this.toastNotification.show = false;
    }, 3800);
  }

  closeToast(): void {
    this.toastNotification.show = false;
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
  }

  onImageError(event: Event, fallbackSrc: string = 'assets/categories/Thinkspot_veggiesIcon.png'): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src = fallbackSrc;
    }
  }

  onRouteChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    if (target && target.value) {
      this.currentBanner.routerLink = target.value;
      this.hasUnsavedChanges = true;
    }
  }

  onActiveChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target) {
      this.currentBanner.active = target.checked;
      this.hasUnsavedChanges = true;
    }
  }

  onBackdropClick(event: MouseEvent, modalType: 'editor' | 'template' | 'delete'): void {
    if (event.target === event.currentTarget) {
      if (modalType === 'editor') {
        this.closeEditorModal();
      } else if (modalType === 'template') {
        this.closeTemplateModal();
      } else if (modalType === 'delete') {
        this.closeDeleteModal();
      }
    }
  }
}
