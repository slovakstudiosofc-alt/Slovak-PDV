import { ipcMain } from 'electron'
import { getDb } from '../database'

export function registerSalesIpc(): void {
  ipcMain.handle('sales:list', (_e, filters?: { start?: string; end?: string; status?: string; customer_id?: number }) => {
    const db = getDb()
    let query = `
      SELECT s.*, c.name as customer_name, u.name as user_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE 1=1
    `
    const params: unknown[] = []
    if (filters?.start) { query += ' AND date(s.created_at) >= date(?)'; params.push(filters.start) }
    if (filters?.end) { query += ' AND date(s.created_at) <= date(?)'; params.push(filters.end) }
    if (filters?.status) { query += ' AND s.status = ?'; params.push(filters.status) }
    if (filters?.customer_id) { query += ' AND s.customer_id = ?'; params.push(filters.customer_id) }
    query += ' ORDER BY s.created_at DESC'
    return db.prepare(query).all(...params)
  })

  ipcMain.handle('sales:get', (_e, id: number) => {
    const db = getDb()
    const sale = db.prepare(`
      SELECT s.*, c.name as customer_name, u.name as user_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `).get(id) as Record<string, unknown>
    if (sale) {
      sale.items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id)
    }
    return sale
  })

  ipcMain.handle('sales:create', (_e, saleData: Record<string, unknown>, items: Record<string, unknown>[]) => {
    const db = getDb()
    const numStr = db.prepare("SELECT value FROM settings WHERE key = 'next_sale_number'").get() as { value: string }
    const prefix = (db.prepare("SELECT value FROM settings WHERE key = 'sale_code_prefix'").get() as { value: string })?.value || 'VND'
    const num = parseInt(numStr?.value || '1')
    const code = `${prefix}${String(num).padStart(6, '0')}`

    const insert = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO sales (code, customer_id, user_id, subtotal, discount, total,
          payment_method, payment_amount, change_amount, status, notes)
        VALUES (@code, @customer_id, @user_id, @subtotal, @discount, @total,
          @payment_method, @payment_amount, @change_amount, @status, @notes)
      `).run({ ...saleData, code })

      const saleId = result.lastInsertRowid
      const insertItem = db.prepare(`
        INSERT INTO sale_items (sale_id, product_id, product_name, product_code, quantity, unit_price, discount, total)
        VALUES (@sale_id, @product_id, @product_name, @product_code, @quantity, @unit_price, @discount, @total)
      `)

      const allowNegative = (db.prepare("SELECT value FROM settings WHERE key = 'allow_negative_stock'").get() as { value: string })?.value === 'true'
      for (const item of items) {
        insertItem.run({ ...item, sale_id: saleId })
        const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(item.product_id as number) as { stock: number }
        if (!allowNegative && product && product.stock < (item.quantity as number)) {
          throw new Error(`Estoque insuficiente para: ${item.product_name}`)
        }
        db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(item.quantity, item.product_id)
      }

      db.prepare("UPDATE settings SET value = ? WHERE key = 'next_sale_number'").run(String(num + 1))
      return saleId
    })

    const saleId = insert()
    return { id: saleId, code }
  })

  ipcMain.handle('sales:cancel', (_e, id: number, reason?: string) => {
    const db = getDb()
    db.transaction(() => {
      db.prepare("UPDATE sales SET status = 'cancelled', notes = ? WHERE id = ?").run(reason || 'Cancelada pelo operador', id)
      const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id) as { product_id: number; quantity: number }[]
      for (const item of items) {
        db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(item.quantity, item.product_id)
      }
    })()
    return true
  })

  ipcMain.handle('sales:getPaymentMethods', () => {
    return getDb().prepare('SELECT * FROM payment_methods WHERE active = 1 ORDER BY name').all()
  })

  ipcMain.handle('sales:getToday', () => {
    return getDb().prepare(`
      SELECT COUNT(*) as count, SUM(total) as total, SUM(discount) as discounts
      FROM sales WHERE date(created_at) = date('now','localtime') AND status = 'completed'
    `).get()
  })
}
