// Domain types mirroring the Supabase schema.
// Optional nested objects correspond to PostgREST foreign-key embeddings.

export type MemberRole = 'owner' | 'admin' | 'member' | 'viewer';
export type ProductStatus = 'draft' | 'active' | 'archived';
export type MovementType = 'in' | 'out' | 'adjustment' | 'transfer_in' | 'transfer_out';
export type PoStatus = 'draft' | 'ordered' | 'received' | 'cancelled';
export type AlertType = 'low_stock' | 'out_of_stock';
export type AlertStatus = 'active' | 'resolved' | 'dismissed';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  /** Platform operator — read access across all workspaces + /admin console. */
  is_super_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
  profile?: Profile;
}

export interface WorkspaceSettings {
  workspace_id: string;
  currency: string;
  timezone: string;
  low_stock_alerts_enabled: boolean;
  out_of_stock_alerts_enabled: boolean;
  po_counter: number;
  updated_at: string;
}

export interface Category {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  workspace_id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Warehouse {
  id: string;
  workspace_id: string;
  name: string;
  location: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string;
  workspace_id: string;
  product_id: string;
  url: string;
  is_primary: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  workspace_id: string;
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  category_id: string | null;
  supplier_id: string | null;
  cost_price: number;
  selling_price: number;
  minimum_stock: number;
  status: ProductStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // embeddings
  category?: Category | null;
  supplier?: Supplier | null;
  images?: ProductImage[];
  stock_levels?: StockLevel[];
}

export interface StockLevel {
  id: string;
  workspace_id: string;
  product_id: string;
  warehouse_id: string;
  quantity: number;
  updated_at: string;
  warehouse?: Warehouse;
  product?: Product;
}

export interface StockMovement {
  id: string;
  workspace_id: string;
  product_id: string;
  warehouse_id: string;
  type: MovementType;
  quantity: number;
  reference: string | null;
  notes: string | null;
  transfer_group: string | null;
  created_by: string | null;
  created_at: string;
  product?: Pick<Product, 'id' | 'name' | 'sku'>;
  warehouse?: Pick<Warehouse, 'id' | 'name'>;
  created_by_profile?: Pick<Profile, 'id' | 'full_name' | 'email'> | null;
}

export interface PurchaseOrderItem {
  id: string;
  workspace_id: string;
  purchase_order_id: string;
  product_id: string;
  quantity: number;
  unit_cost: number;
  received_quantity: number;
  product?: Pick<Product, 'id' | 'name' | 'sku'>;
}

export interface PurchaseOrder {
  id: string;
  workspace_id: string;
  supplier_id: string | null;
  warehouse_id: string;
  po_number: string;
  status: PoStatus;
  notes: string | null;
  expected_date: string | null;
  ordered_at: string | null;
  received_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // list queries embed id/name; the detail query embeds the full supplier
  supplier?: (Pick<Supplier, 'id' | 'name'> & Partial<Supplier>) | null;
  warehouse?: Pick<Warehouse, 'id' | 'name'>;
  items?: PurchaseOrderItem[];
}

export interface Alert {
  id: string;
  workspace_id: string;
  product_id: string;
  warehouse_id: string;
  type: AlertType;
  status: AlertStatus;
  message: string;
  created_at: string;
  resolved_at: string | null;
  product?: Pick<Product, 'id' | 'name' | 'sku'>;
  warehouse?: Pick<Warehouse, 'id' | 'name'>;
}

export interface ActivityLogDetails {
  name?: string;
  sku?: string;
  po_number?: string;
  status?: string;
  type?: string;
  quantity?: string;
  role?: string;
  member_user_id?: string;
}

export interface ActivityLog {
  id: string;
  workspace_id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: ActivityLogDetails;
  created_at: string;
  user?: Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url'> | null;
}

// ---------- Integrations ----------

export type WebhookSource = 'shopify' | 'woocommerce' | 'custom';
export type ExternalOrderStatus = 'processed' | 'partial' | 'failed' | 'duplicate';

export interface WebhookEndpoint {
  id: string;
  workspace_id: string;
  name: string;
  source: WebhookSource;
  warehouse_id: string;
  token: string;
  is_active: boolean;
  last_received_at: string | null;
  created_at: string;
  warehouse?: Pick<Warehouse, 'id' | 'name'>;
}

export interface ExternalOrder {
  id: string;
  workspace_id: string;
  endpoint_id: string | null;
  source: string;
  external_id: string;
  order_number: string;
  status: ExternalOrderStatus;
  items_total: number;
  items_matched: number;
  error: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  endpoint?: Pick<WebhookEndpoint, 'id' | 'name'> | null;
}

// ---------- Platform admin ----------

export interface AdminWorkspaceRow extends Workspace {
  owner: Pick<Profile, 'id' | 'full_name' | 'email'> | null;
  members: { count: number }[];
  products: { count: number }[];
}

export interface AdminStats {
  users: number;
  workspaces: number;
  products: number;
}

// ---------- Analytics RPC results ----------

export interface DashboardStats {
  total_products: number;
  total_units: number;
  stock_value: number;
  retail_value: number;
  low_stock_count: number;
  out_of_stock_count: number;
  open_purchase_orders: number;
}

export interface MovementSeriesPoint {
  day: string;
  stock_in: number;
  stock_out: number;
}

export interface CategoryStock {
  category: string;
  color: string;
  units: number;
  value: number;
}

export interface TopProduct {
  product_id: string;
  name: string;
  sku: string;
  units: number;
  value: number;
}
