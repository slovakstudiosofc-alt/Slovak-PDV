import { ipcMain } from 'electron'
import { getDb } from '../database'

export function registerCustomersIpc(): void {
  ipcMain.handle('customers:list', (_e, search?: string) => {
    const db = getDb()
    if (search) {
      return db.prepare(`
        SELECT * FROM customers WHERE active = 1 AND
        (name LIKE ? OR cpf_cnpj LIKE ? OR phone LIKE ? OR email LIKE ?)
        ORDER BY name
      `).all(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`)
    }
    return db.prepare('SELECT * FROM customers WHERE active = 1 ORDER BY name').all()
  })

  ipcMain.handle('customers:get', (_e, id: number) => {
    return getDb().prepare('SELECT * FROM customers WHERE id = ?').get(id)
  })

  ipcMain.handle('customers:create', (_e, data: Record<string, unknown>) => {
    const db = getDb()
    const result = db.prepare(`
      INSERT INTO customers (name, cpf_cnpj, rg, phone, phone2, email, address, number,
        complement, neighborhood, city, state, zip_code, birth_date, notes, credit_limit)
      VALUES (@name, @cpf_cnpj, @rg, @phone, @phone2, @email, @address, @number,
        @complement, @neighborhood, @city, @state, @zip_code, @birth_date, @notes, @credit_limit)
    `).run(data)
    return { id: result.lastInsertRowid, ...data }
  })

  ipcMain.handle('customers:update', (_e, id: number, data: Record<string, unknown>) => {
    getDb().prepare(`
      UPDATE customers SET name=@name, cpf_cnpj=@cpf_cnpj, rg=@rg, phone=@phone,
        phone2=@phone2, email=@email, address=@address, number=@number,
        complement=@complement, neighborhood=@neighborhood, city=@city, state=@state,
        zip_code=@zip_code, birth_date=@birth_date, notes=@notes, credit_limit=@credit_limit,
        updated_at=datetime('now','localtime')
      WHERE id = ?
    `).run({ ...data }, id)
    return true
  })

  ipcMain.handle('customers:delete', (_e, id: number) => {
    getDb().prepare('UPDATE customers SET active = 0 WHERE id = ?').run(id)
    return true
  })

  ipcMain.handle('customers:getSalesHistory', (_e, customerId: number) => {
    return getDb().prepare(`
      SELECT s.*, u.name as user_name FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.customer_id = ? ORDER BY s.created_at DESC
    `).all(customerId)
  })
}
