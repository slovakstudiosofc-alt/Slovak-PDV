export interface User {
  id: number
  name: string
  username: string
  role: 'admin' | 'manager' | 'cashier'
  active: boolean
  created_at: string
}

export interface Category {
  id: number
  name: string
  description?: string
  active: boolean
}

export interface Product {
  id: number
  code: string
  barcode?: string
  name: string
  description?: string
  category_id?: number
  category_name?: string
  supplier_id?: number
  price: number
  cost_price?: number
  stock: number
  min_stock?: number
  unit: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface Customer {
  id: number
  name: string
  cpf_cnpj?: string
  rg?: string
  phone?: string
  phone2?: string
  email?: string
  address?: string
  number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
  zip_code?: string
  birth_date?: string
  notes?: string
  credit_limit?: number
  active: boolean
  created_at: string
}

export interface SaleItem {
  id?: number
  sale_id?: number
  product_id: number
  product_name: string
  product_code: string
  quantity: number
  unit_price: number
  discount: number
  total: number
}

export interface Sale {
  id: number
  code: string
  customer_id?: number
  customer_name?: string
  user_id: number
  user_name?: string
  subtotal: number
  discount: number
  total: number
  payment_method: string
  payment_amount: number
  change_amount: number
  status: 'completed' | 'cancelled' | 'pending'
  notes?: string
  created_at: string
  items?: SaleItem[]
}

export interface ServiceOrderItem {
  id?: number
  service_order_id?: number
  product_id?: number
  description: string
  quantity: number
  unit_price: number
  total: number
  type: 'part' | 'labor' | 'other'
}

export interface ServiceOrder {
  id: number
  code: string
  customer_id?: number
  customer_name?: string
  user_id: number
  user_name?: string
  equipment: string
  brand?: string
  model?: string
  serial_number?: string
  accessories?: string
  problem_description: string
  diagnosis?: string
  solution?: string
  status: 'pending' | 'in_progress' | 'waiting_parts' | 'completed' | 'delivered' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  estimated_value?: number
  final_value?: number
  estimated_date?: string
  warranty_days?: number
  notes?: string
  created_at: string
  updated_at: string
  items?: ServiceOrderItem[]
}

export interface Supplier {
  id: number
  name: string
  cnpj?: string
  phone?: string
  email?: string
  address?: string
  contact_name?: string
  notes?: string
  active: boolean
  created_at: string
}

export interface PaymentMethod {
  id: number
  name: string
  type: 'cash' | 'credit_card' | 'debit_card' | 'pix' | 'check' | 'transfer' | 'other'
  active: boolean
}

export interface Settings {
  store_name: string
  store_cnpj: string
  store_address: string
  store_phone: string
  store_email: string
  currency: string
  currency_symbol: string
  receipt_footer: string
  printer_enabled: string
  printer_type: string
  printer_port: string
  printer_ip: string
  printer_network_port: string
  cash_drawer_enabled: string
  cash_drawer_port: string
  cash_drawer_baud: string
  low_stock_alert: string
  sale_code_prefix: string
  os_code_prefix: string
  allow_negative_stock: string
  require_customer: string
  auto_print_receipt: string
  tax_rate: string
  theme: string
}

export interface CartItem extends SaleItem {
  _key: string
}
