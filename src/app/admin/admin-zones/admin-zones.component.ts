import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { AdminAuthService } from '../services/admin-auth.service';

export interface ServiceablePincode {
  id: number;
  pincode: string;
  zone: string;
  area_name: string;
  is_active: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

@Component({
  selector: 'app-admin-zones',
  templateUrl: './admin-zones.component.html',
  styleUrls: ['./admin-zones.component.scss']
})
export class AdminZonesComponent implements OnInit {
  pincodes: ServiceablePincode[] = [];
  filteredPincodes: ServiceablePincode[] = [];
  loading: boolean = false;
  submitting: boolean = false;

  // Search & Filter
  searchQuery: string = '';
  selectedFilter: 'ALL' | 'ACTIVE' | 'INACTIVE' | 'ZONE1' | 'ZONE2' = 'ALL';

  // New Pincode Form Model
  newPincode = {
    pincode: '',
    zone: 'zone1',
    area_name: '',
    notes: '',
    is_active: 1
  };

  // Toast / Feedback message
  toastMessage: string = '';
  toastType: 'success' | 'error' | 'info' = 'success';
  showToast: boolean = false;
  toastTimeout: any;

  // Delete modal confirmation
  showDeleteConfirm: boolean = false;
  itemToDelete: ServiceablePincode | null = null;

  constructor(
    private apiService: ApiService,
    private adminAuthService: AdminAuthService
  ) {}

  ngOnInit(): void {
    this.loadPincodes();
  }

  loadPincodes(): void {
    this.loading = true;
    this.apiService.getApi('admin/manage_zones.php?action=list').subscribe({
      next: (res: any) => {
        this.loading = false;
        if (res && res.success && Array.isArray(res.data)) {
          this.pincodes = res.data;
        } else if (Array.isArray(res)) {
          this.pincodes = res;
        } else {
          this.pincodes = [];
        }
        this.applyFilter();
      },
      error: (err: any) => {
        this.loading = false;
        this.displayToast('Failed to load pincodes: ' + (err.message || 'Unknown error'), 'error');
      }
    });
  }

  applyFilter(): void {
    let result = [...this.pincodes];

    // Status / Zone Tab Filter
    if (this.selectedFilter === 'ACTIVE') {
      result = result.filter(p => Number(p.is_active) === 1);
    } else if (this.selectedFilter === 'INACTIVE') {
      result = result.filter(p => Number(p.is_active) === 0);
    } else if (this.selectedFilter === 'ZONE1') {
      result = result.filter(p => p.zone.toLowerCase() === 'zone1');
    } else if (this.selectedFilter === 'ZONE2') {
      result = result.filter(p => p.zone.toLowerCase() === 'zone2');
    }

    // Search query
    if (this.searchQuery && this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      result = result.filter(p => 
        (p.pincode && p.pincode.toLowerCase().includes(q)) ||
        (p.area_name && p.area_name.toLowerCase().includes(q)) ||
        (p.zone && p.zone.toLowerCase().includes(q)) ||
        (p.notes && p.notes.toLowerCase().includes(q))
      );
    }

    this.filteredPincodes = result;
  }

  onFilterChange(tab: 'ALL' | 'ACTIVE' | 'INACTIVE' | 'ZONE1' | 'ZONE2'): void {
    this.selectedFilter = tab;
    this.applyFilter();
  }

  onSearchChange(): void {
    this.applyFilter();
  }

  addPincode(): void {
    const pin = (this.newPincode.pincode || '').trim();
    if (!pin) {
      this.displayToast('Please enter a valid 6-digit pincode', 'error');
      return;
    }

    if (!/^\d{6}$/.test(pin)) {
      this.displayToast('Pincode must be exactly 6 digits', 'error');
      return;
    }

    this.submitting = true;
    const payload = {
      action: 'add',
      pincode: pin,
      zone: this.newPincode.zone || 'zone1',
      area_name: this.newPincode.area_name.trim(),
      notes: this.newPincode.notes.trim(),
      is_active: this.newPincode.is_active ? 1 : 0
    };

    this.apiService.postApi('admin/manage_zones.php', payload).subscribe({
      next: (res: any) => {
        this.submitting = false;
        if (res && res.success) {
          this.displayToast(res.message || `Pincode ${pin} added successfully!`, 'success');
          // Reset form
          this.newPincode = {
            pincode: '',
            zone: 'zone1',
            area_name: '',
            notes: '',
            is_active: 1
          };
          this.loadPincodes();
        } else {
          this.displayToast(res?.message || 'Failed to add pincode', 'error');
        }
      },
      error: (err: any) => {
        this.submitting = false;
        this.displayToast(err.message || 'Error occurred while adding pincode', 'error');
      }
    });
  }

  toggleActive(p: ServiceablePincode): void {
    const nextStatus = Number(p.is_active) === 1 ? 0 : 1;
    this.apiService.postApi('admin/manage_zones.php', {
      action: 'toggle',
      id: p.id,
      is_active: nextStatus
    }).subscribe({
      next: (res: any) => {
        if (res && res.success) {
          p.is_active = nextStatus;
          this.displayToast(`Pincode ${p.pincode} is now ${nextStatus === 1 ? 'Active' : 'Inactive'}`, 'success');
          this.applyFilter();
        } else {
          this.displayToast(res?.message || 'Could not update status', 'error');
        }
      },
      error: (err: any) => {
        this.displayToast(err.message || 'Error toggling pincode status', 'error');
      }
    });
  }

  promptDelete(p: ServiceablePincode): void {
    this.itemToDelete = p;
    this.showDeleteConfirm = true;
  }

  cancelDelete(): void {
    this.showDeleteConfirm = false;
    this.itemToDelete = null;
  }

  confirmDelete(): void {
    if (!this.itemToDelete) return;

    const pin = this.itemToDelete.pincode;
    const id = this.itemToDelete.id;

    this.apiService.postApi('admin/manage_zones.php', {
      action: 'delete',
      id: id,
      pincode: pin
    }).subscribe({
      next: (res: any) => {
        this.showDeleteConfirm = false;
        this.itemToDelete = null;
        if (res && res.success) {
          this.displayToast(`Pincode ${pin} removed successfully`, 'success');
          this.loadPincodes();
        } else {
          this.displayToast(res?.message || 'Failed to delete pincode', 'error');
        }
      },
      error: (err: any) => {
        this.showDeleteConfirm = false;
        this.itemToDelete = null;
        this.displayToast(err.message || 'Error deleting pincode', 'error');
      }
    });
  }

  displayToast(msg: string, type: 'success' | 'error' | 'info' = 'success'): void {
    this.toastMessage = msg;
    this.toastType = type;
    this.showToast = true;
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    this.toastTimeout = setTimeout(() => {
      this.showToast = false;
    }, 3500);
  }

  // Summary counts
  get totalCount(): number {
    return this.pincodes.length;
  }

  get activeCount(): number {
    return this.pincodes.filter(p => Number(p.is_active) === 1).length;
  }

  get zone1Count(): number {
    return this.pincodes.filter(p => p.zone.toLowerCase() === 'zone1').length;
  }

  get zone2Count(): number {
    return this.pincodes.filter(p => p.zone.toLowerCase() === 'zone2').length;
  }
}
