import { ipcMain } from 'electron'
import { getDb } from '../database'
import { addToSyncQueue } from '../sync/queue'

type ProductData = {
  code: string
  barcode?: string | null
  name: string
  description?: string | null
  category_id?: number | null
  supplier_id?: number | null
  price: number
  cost_price?: number
  stock?: number
  min_stock?: number
  unit?: string
  active?: number | boolean
}

function normalize(data: Record<string, unknown>): Record<string, unknown> {
  return {
    code: data.code ?? '',
    barcode: data.barcode ?? null,
    name: data.name ?? '',
    description: data.description ?? null,
    category_id: data.category_id ?? null,
    supplier_id: data.supplier_id ?? null,
    price: Number(data.price) || 0,
    cost_price: Number(data.cost_price) || 0,
    stock: Number(data.stock) || 0,
    min_stock: Number(data.min_stock) || 0,
    unit: data.unit ?? 'UN',
    active: data.active !== undefined ? (data.active ? 1 : 0) : 1
  }
}

export function registerProductsIpc(): void {
  ipcMain.handle('products:list', (_e, filters?: { search?: string; category_id?: number; active?: boolean }) => {
    const db = getDb()
    let query = `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `
    const params: unknown[] = []
    if (filters?.search) {
      query += ` AND (p.name LIKE ? OR p.code LIKE ? OR p.barcode LIKE ?)`
      params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`)
    }
    if (filters?.category_id) {
      query += ` AND p.category_id = ?`
      params.push(filters.category_id)
    }
    if (filters?.active !== undefined) {
      query += ` AND p.active = ?`
      params.push(filters.active ? 1 : 0)
    }
    query += ` ORDER BY p.name`
    return db.prepare(query).all(...params)
  })

  ipcMain.handle('products:get', (_e, id: number) => {
    return getDb().prepare('SELECT * FROM products WHERE id = ?').get(id)
  })

  ipcMain.handle('products:getByBarcode', (_e, barcode: string) => {
    return getDb().prepare('SELECT * FROM products WHERE barcode = ? AND active = 1').get(barcode)
  })

  ipcMain.handle('products:getByCode', (_e, code: string) => {
    return getDb().prepare('SELECT * FROM products WHERE code = ? AND active = 1').get(code)
  })

  ipcMain.handle('products:create', (_e, data: Record<string, unknown>) => {
    const db = getDb()
    const params = normalize(data)
    const result = db.prepare(`
      INSERT INTO products (code, barcode, name, description, category_id, supplier_id, price, cost_price, stock, min_stock, unit, active)
      VALUES (@code, @barcode, @name, @description, @category_id, @supplier_id, @price, @cost_price, @stock, @min_stock, @unit, @active)
    `).run(params)
    const id = result.lastInsertRowid
    addToSyncQueue(db, 'products', 'INSERT', Number(id), { ...params, id })
    return { id, ...params }
  })

  ipcMain.handle('products:update', (_e, id: number, data: Record<string, unknown>) => {
    const db = getDb()
    const params = normalize(data)
    db.prepare(`
      UPDATE products SET
        code = @code, barcode = @barcode, name = @name, description = @description,
        category_id = @category_id, supplier_id = @supplier_id, price = @price,
        cost_price = @cost_price, stock = @stock, min_stock = @min_stock,
        unit = @unit, active = @active, updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(params, id)
    addToSyncQueue(db, 'products', 'UPDATE', id, { ...params, id })
    return true
  })

  ipcMain.handle('products:delete', (_e, id: number) => {
    const db = getDb()
    db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(id)
    addToSyncQueue(db, 'products', 'DELETE', id, { id })
    return true
  })

  ipcMain.handle('products:updateStock', (_e, id: number, quantity: number) => {
    getDb().prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(quantity, id)
    return true
  })

  ipcMain.handle('products:getLowStock', () => {
    return getDb().prepare(`
      SELECT p.*, c.name as category_name FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.active = 1 AND p.stock <= p.min_stock AND p.min_stock > 0
      ORDER BY p.stock ASC
    `).all()
  })
}
