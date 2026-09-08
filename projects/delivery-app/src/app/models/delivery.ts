export interface DeliveryPartner {
  id: number | string;
  username: string;
  name: string;
  phone: string;
  zone: string;
  vehicle: string;
  status: string;
  activeOrders?: number;
}

export interface DeliveryItem {
  id: number | string;
  product_id: string;
  name: string;
  quantity: number;
  price: number;
  weight: number | string;
  unit_name: string;
  img_url: string;
  is_subscription: boolean;
  subscription_type: string;
  item_status: string;
  is_packed: boolean;
  scheduled_date: boolean;
}

export interface DeliveryOrder {
  order_id: string;
  id: string;
  mobile: string;
  customer_name: string;
  phone: string;
  address: any;
  address_text: string;
  total_amount: number;
  payment_type: string;
  status: string;
  delivery_category: 'packed' | 'delivered' | 'undelivered';
  delivery_date: string;
  assigned_to: string;
  delivery_inst: string;
  delivery_mode: string;
  delivered_at: string | null;
  undelivered_reason: string;
  items: DeliveryItem[];
  items_count: number;
  created_at: string;
  expanded?: boolean;
}
