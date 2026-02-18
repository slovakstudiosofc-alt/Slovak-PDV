import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'cashier' CHECK(role IN ('admin','manager','cashier')),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      cnpj TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      contact_name TEXT,
      notes TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      barcode TEXT,
      name TEXT NOT NULL,
      description TEXT,
      category_id INTEGER REFERENCES categories(id),
      supplier_id INTEGER REFERENCES suppliers(id),
      price REAL NOT NULL DEFAULT 0,
      cost_price REAL DEFAULT 0,
      stock REAL NOT NULL DEFAULT 0,
      min_stock REAL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'UN',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      cpf_cnpj TEXT,
      rg TEXT,
      phone TEXT,
      phone2 TEXT,
      email TEXT,
      address TEXT,
      number TEXT,
      complement TEXT,
      neighborhood TEXT,
      city TEXT,
      state TEXT,
      zip_code TEXT,
      birth_date TEXT,
      notes TEXT,
      credit_limit REAL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS payment_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'other' CHECK(type IN ('cash','credit_card','debit_card','pix','check','transfer','other')),
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      customer_id INTEGER REFERENCES customers(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      subtotal REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      payment_amount REAL NOT NULL DEFAULT 0,
      change_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('completed','cancelled','pending')),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      product_name TEXT NOT NULL,
      product_code TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS service_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      customer_id INTEGER REFERENCES customers(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      equipment TEXT NOT NULL,
      brand TEXT,
      model TEXT,
      serial_number TEXT,
      accessories TEXT,
      problem_description TEXT NOT NULL,
      diagnosis TEXT,
      solution TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','waiting_parts','completed','delivered','cancelled')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high','urgent')),
      estimated_value REAL,
      final_value REAL,
      estimated_date TEXT,
      warranty_days INTEGER DEFAULT 90,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS service_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_order_id INTEGER NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id),
      description TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      type TEXT NOT NULL DEFAULT 'part' CHECK(type IN ('part','labor','other'))
    );

    CREATE TABLE IF NOT EXISTS cash_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      type TEXT NOT NULL CHECK(type IN ('open','close','in','out')),
      amount REAL NOT NULL DEFAULT 0,
      balance REAL NOT NULL DEFAULT 0,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      operation TEXT NOT NULL CHECK(operation IN ('INSERT','UPDATE','DELETE')),
      record_id INTEGER NOT NULL,
      data TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0,
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL CHECK(status IN ('success','error','partial')),
      items_synced INTEGER NOT NULL DEFAULT 0,
      items_failed INTEGER NOT NULL DEFAULT 0,
      message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_sync_queue_pending ON sync_queue(synced, id);
  `)

  const hasAdmin = db.prepare("SELECT id FROM users WHERE username = 'admin'").get()
  if (!hasAdmin) {
    const hash = bcrypt.hashSync('admin123', 10)
    db.prepare(`
      INSERT INTO users (name, username, password, role) VALUES ('Administrador', 'admin', ?, 'admin')
    `).run(hash)
  }

  const defaultSettings: Record<string, string> = {
    store_name: 'Minha Loja',
    store_cnpj: '',
    store_address: '',
    store_phone: '',
    store_email: '',
    currency: 'BRL',
    currency_symbol: 'R$',
    receipt_footer: 'Obrigado pela preferência!',
    printer_enabled: 'false',
    printer_type: 'usb',
    printer_port: '',
    printer_ip: '',
    printer_network_port: '9100',
    cash_drawer_enabled: 'false',
    cash_drawer_port: 'COM1',
    cash_drawer_baud: '9600',
    low_stock_alert: 'true',
    sale_code_prefix: 'VND',
    os_code_prefix: 'OS',
    next_sale_number: '1',
    next_os_number: '1',
    tax_rate: '0',
    allow_negative_stock: 'false',
    require_customer: 'false',
    auto_print_receipt: 'false',
    theme: 'dark',
    // Remote DB sync
    sync_enabled: 'false',
    sync_driver: 'mysql',
    sync_host: '',
    sync_port: '',
    sync_database: '',
    sync_user: '',
    sync_password: '',
    sync_ssl: 'false',
    sync_interval_minutes: '5',
    sync_last_at: ''
  }

  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
  for (const [key, value] of Object.entries(defaultSettings)) {
    insertSetting.run(key, value)
  }

  const defaultPayments = [
    { name: 'Dinheiro', type: 'cash' },
    { name: 'Cartão de Crédito', type: 'credit_card' },
    { name: 'Cartão de Débito', type: 'debit_card' },
    { name: 'PIX', type: 'pix' },
    { name: 'Transferência', type: 'transfer' },
    { name: 'Cheque', type: 'check' }
  ]
  const insertPayment = db.prepare('INSERT OR IGNORE INTO payment_methods (name, type) VALUES (?, ?)')
  for (const p of defaultPayments) {
    const exists = db.prepare('SELECT id FROM payment_methods WHERE name = ?').get(p.name)
    if (!exists) insertPayment.run(p.name, p.type)
  }
}
