import { ipcMain } from 'electron'
import { getDb } from '../database'

export function registerServiceOrdersIpc(): void {
  ipcMain.handle('serviceOrders:list', (_e, filters?: { status?: string; search?: string; start?: string; end?: string }) => {
    const db = getDb()
    let query = `
      SELECT so.*, c.name as customer_name, u.name as user_name
      FROM service_orders so
      LEFT JOIN customers c ON so.customer_id = c.id
      LEFT JOIN users u ON so.user_id = u.id
      WHERE 1=1
    `
    const params: unknown[] = []
    if (filters?.status) { query += ' AND so.status = ?'; params.push(filters.status) }
    if (filters?.search) {
      query += ' AND (so.code LIKE ? OR so.equipment LIKE ? OR c.name LIKE ?)'
      params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`)
    }
    if (filters?.start) { query += ' AND date(so.created_at) >= date(?)'; params.push(filters.start) }
    if (filters?.end) { query += ' AND date(so.created_at) <= date(?)'; params.push(filters.end) }
    query += ' ORDER BY so.created_at DESC'
    return db.prepare(query).all(...params)
  })

  ipcMain.handle('serviceOrders:get', (_e, id: number) => {
    const db = getDb()
    const so = db.prepare(`
      SELECT so.*, c.name as customer_name, u.name as user_name
      FROM service_orders so
      LEFT JOIN customers c ON so.customer_id = c.id
      LEFT JOIN users u ON so.user_id = u.id
      WHERE so.id = ?
    `).get(id) as Record<string, unknown>
    if (so) {
      so.items = db.prepare('SELECT * FROM service_order_items WHERE service_order_id = ?').all(id)
    }
    return so
  })

  ipcMain.handle('serviceOrders:create', (_e, data: Record<string, unknown>, items: Record<string, unknown>[]) => {
    const db = getDb()
    const numStr = db.prepare("SELECT value FROM settings WHERE key = 'next_os_number'").get() as { value: string }
    const prefix = (db.prepare("SELECT value FROM settings WHERE key = 'os_code_prefix'").get() as { value: string })?.value || 'OS'
    const num = parseInt(numStr?.value || '1')
    const code = `${prefix}${String(num).padStart(6, '0')}`

    const insert = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO service_orders (code, customer_id, user_id, equipment, brand, model,
          serial_number, accessories, problem_description, diagnosis, solution, status,
          priority, estimated_value, final_value, estimated_date, warranty_days, notes)
        VALUES (@code, @customer_id, @user_id, @equipment, @brand, @model,
          @serial_number, @accessories, @problem_description, @diagnosis, @solution, @status,
          @priority, @estimated_value, @final_value, @estimated_date, @warranty_days, @notes)
      `).run({ ...data, code })

      const soId = result.lastInsertRowid
      if (items?.length) {
        const insertItem = db.prepare(`
          INSERT INTO service_order_items (service_order_id, product_id, description, quantity, unit_price, total, type)
          VALUES (@service_order_id, @product_id, @description, @quantity, @unit_price, @total, @type)
        `)
        for (const item of items) {
          insertItem.run({ ...item, service_order_id: soId })
        }
      }
      db.prepare("UPDATE settings SET value = ? WHERE key = 'next_os_number'").run(String(num + 1))
      return soId
    })

    const soId = insert()
    return { id: soId, code }
  })

  ipcMain.handle('serviceOrders:update', (_e, id: number, data: Record<string, unknown>, items: Record<string, unknown>[]) => {
    const db = getDb()
    db.transaction(() => {
      db.prepare(`
        UPDATE service_orders SET equipment=@equipment, brand=@brand, model=@model,
          serial_number=@serial_number, accessories=@accessories, problem_description=@problem_description,
          diagnosis=@diagnosis, solution=@solution, status=@status, priority=@priority,
          estimated_value=@estimated_value, final_value=@final_value, estimated_date=@estimated_date,
          warranty_days=@warranty_days, notes=@notes, customer_id=@customer_id,
          updated_at=datetime('now','localtime')
        WHERE id=?
      `).run({ ...data }, id)

      if (items !== undefined) {
        db.prepare('DELETE FROM service_order_items WHERE service_order_id = ?').run(id)
        const insertItem = db.prepare(`
          INSERT INTO service_order_items (service_order_id, product_id, description, quantity, unit_price, total, type)
          VALUES (@service_order_id, @product_id, @description, @quantity, @unit_price, @total, @type)
        `)
        for (const item of items) {
          insertItem.run({ ...item, service_order_id: id })
        }
      }
    })()
    return true
  })

  ipcMain.handle('serviceOrders:updateStatus', (_e, id: number, status: string) => {
    getDb().prepare("UPDATE service_orders SET status=?, updated_at=datetime('now','localtime') WHERE id=?").run(status, id)
    return true
  })

  ipcMain.handle('serviceOrders:delete', (_e, id: number) => {
    getDb().prepare('DELETE FROM service_orders WHERE id = ?').run(id)
    return true
  })
}
