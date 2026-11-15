// ─── Enums ────────────────────────────────────────────────────────────────────

export type UserType =
  | "pharmacist"
  | "stock_manager"
  | "pharmacy_manager"
  | "system_administrator";

export type Gender = "male" | "female" | "other";

export type DosageForm = "syrup" | "tablet" | "capsule" | "vial" | "other";

export type PaymentMode = "cash" | "card" | "qr" | "other";

export type InvoiceStatus = "completed" | "cancelled";

export type ReproduceType = "one_time" | "recurrent";

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

// ─── Doctor ───────────────────────────────────────────────────────────────────

export interface Doctor {
  id: number;
  name: string;
  slmc_reg_no: string | null;
  discount_rate: number;
  specialization: string | null;
  contact_number: string | null;
  email: string | null;
  hospital: string | null;
  created_at: string;
  updated_at: string;
}

export interface DoctorCreate {
  name: string;
  slmc_reg_no: string;
  specialization?: string;
  contact_number?: string;
  email?: string;
  hospital?: string;
}

// ─── Drug ─────────────────────────────────────────────────────────────────────

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

// ─── Prescription ─────────────────────────────────────────────────────────────

export interface Prescription {
  id: number;
  customer_id: number;
  doctor_id: number | null;
  issue_date: string;
  drug_details_text: string | null;
  reproduce_type: ReproduceType;
  valid_days: number | null;
  valid_months: number | null;
  scan_file_path: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PrescriptionCreate {
  customer_id: number;
  doctor_id?: number;
  issue_date: string;
  drug_details_text?: string;
  reproduce_type?: ReproduceType;
  valid_days?: number;
  valid_months?: number;
}

// ─── Invoice ──────────────────────────────────────────────────────────────────

export interface InvoiceItem {
  id: number;
  drug_id: number;
  quantity: number;
  unit_price: number;
  discount_rate: number;
  discount_amount: number;
  line_total: number;
  drug?: Drug | null;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  customer_id: number | null;
  doctor_id: number | null;
  prescription_id: number | null;
  subtotal: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  payment_mode: PaymentMode;
  status: InvoiceStatus;
  notes: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  served_by_user_id: number | null;
  customer?: Customer | null;
  items: InvoiceItem[];
  created_at: string;
  updated_at: string;
}

export interface InvoiceItemCreate {
  drug_id: number;
  quantity: number;
  unit_price: number;
  discount_rate: number;
  discount_amount: number;
  line_total: number;
}

export interface InvoiceCreate {
  customer_id?: number;
  doctor_id?: number;
  prescription_id?: number;
  items: InvoiceItemCreate[];
  subtotal: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  payment_mode: "cash" | "card" | "other";
  notes?: string;
  pharmacist_verified?: boolean;
  verifier_username?: string;
  verifier_password?: string;
}

export type SalesReturnReason = "damaged" | "expired" | "wrong_item" | "patient_refusal" | "other";

export interface SalesReturnCreate {
  invoice_id: number;
  drug_id: number;
  quantity: number;
  refund_amount: number;
  reason: SalesReturnReason;
  notes?: string;
}

// ─── Cart (POS local state) ───────────────────────────────────────────────────

export interface CartItem {
  drug: Drug;
  quantity: number;
  unit_price: number;
  discount_rate: number;
  line_total: number;
}
