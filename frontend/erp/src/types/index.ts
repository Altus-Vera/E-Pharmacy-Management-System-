// ─── Enums ────────────────────────────────────────────────────────────────────

export type UserType =
  | "pharmacist"
  | "stock_manager"
  | "pharmacy_manager"
  | "system_administrator";

export type Gender = "male" | "female" | "other";

export type DosageForm = "syrup" | "tablet" | "capsule" | "vial" | "other";

export type MovementType =
  | "purchase"
  | "sale"
  | "adjustment"
  | "return_to_supplier"
  | "transfer_in"
  | "transfer_out";

export type PurchaseOrderStatus =
  | "draft"
  | "submitted"
  | "partially_received"
  | "received"
  | "cancelled";

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  name: string;
  nic: string;
  user_type: UserType;
  address: string | null;
  contact_number: string | null;
  username: string;
  remarks: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface LoginRequest {
  username: string;
  password: string;
}

// ─── Drug / Inventory ─────────────────────────────────────────────────────────

export interface DrugCategory {
  id: number;
  name: string;
  description: string | null;
}

export interface Drug {
  id: number;
  item_code: string;
  brand_name: string;
  generic_name: string;
  active_ingredient: string | null;
  description: string | null;
  strength: string | null;
  dosage_form: DosageForm;
  storage_requirements: string | null;
  batch_number: string | null;
  manufactured_date: string | null;
  expiry_date: string | null;
  unit_price: number;
  discount: number;
  quantity: number;
  pack_size: number | null;
  low_stock_threshold: number;
  reorder_level: number;
  is_prescription_only: boolean;
  is_otc: boolean;
  is_high_alert: boolean;
  is_narcotic: boolean;
  is_active: boolean;
  category_id: number | null;
  supplier_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface DrugCreate {
  item_code: string;
  brand_name: string;
  generic_name: string;
  active_ingredient?: string;
  description?: string;
  strength?: string;
  dosage_form: DosageForm;
  storage_requirements?: string;
  batch_number?: string;
  manufactured_date?: string;
  expiry_date?: string;
  unit_price: number;
  discount?: number;
  quantity: number;
  pack_size?: number;
  low_stock_threshold?: number;
  reorder_level?: number;
  is_prescription_only?: boolean;
  is_otc?: boolean;
  is_high_alert?: boolean;
  is_narcotic?: boolean;
  category_id?: number;
  supplier_id?: number;
}

// ─── Supplier ─────────────────────────────────────────────────────────────────

export interface Supplier {
  id: number;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupplierCreate {
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
}

// ─── Purchase Order ───────────────────────────────────────────────────────────

export interface PurchaseOrderItem {
  id: number;
  drug_id: number;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  is_free_goods: boolean;
}

export interface PurchaseOrder {
  id: number;
  order_number: string;
  supplier_id: number;
  status: PurchaseOrderStatus;
  notes: string | null;
  items: PurchaseOrderItem[];
  created_by_user_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItemCreate {
  drug_id: number;
  quantity_ordered: number;
  unit_cost: number;
  is_free_goods?: boolean;
}

export interface PurchaseOrderCreate {
  supplier_id: number;
  notes?: string;
  items: PurchaseOrderItemCreate[];
}

// ─── Stock Movement ───────────────────────────────────────────────────────────

export interface StockMovement {
  id: number;
  drug_id: number;
  movement_type: MovementType;
  quantity_change: number;
  quantity_after: number;
  reference_type: string | null;
  reference_id: number | null;
  notes: string | null;
  created_by_user_id: number | null;
  created_at: string;
}

// ─── Customer ─────────────────────────────────────────────────────────────────

export interface Customer {
  id: number;
  name: string;
  contact_number: string;
  email: string | null;
  address: string | null;
  dob: string | null;
  gender: Gender | null;
  loyalty_points: number;
  discount_rate: number;
  clinical_remarks: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerCreate {
  name: string;
  contact_number: string;
  email?: string;
  address?: string;
  dob?: string;
  gender?: Gender;
  discount_rate?: number;
  clinical_remarks?: string;
}

export interface CustomerInvoiceSummary {
  id: number;
  invoice_number: string;
  total_amount: number;
  payment_mode: string;
  status: string;
  created_at: string;
}

// ─── User management ──────────────────────────────────────────────────────────

export interface UserCreate {
  name: string;
  nic: string;
  user_type: UserType;
  username: string;
  password: string;
  address?: string;
  contact_number?: string;
  remarks?: string;
}
