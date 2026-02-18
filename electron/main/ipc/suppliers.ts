import { ipcMain } from 'electron'
import { getDb } from '../database'

export function registerSuppliersIpc(): void {
  ipcMain.handle('suppliers:list', (_e, search?: string) => {
    const db = getDb()
    if (search) {
      return db.prepare('SELECT * FROM suppliers WHERE active=1 AND (name LIKE ? OR cnpj LIKE ?) ORDER BY name').all(`%${search}%`, `%${search}%`)
    }
    return db.prepare('SELECT * FROM suppliers WHERE active=1 ORDER BY name').all()
  })

  ipcMain.handle('suppliers:create', (_e, data: Record<string, unknown>) => {
    const result = getDb().prepare(`
      INSERT INTO suppliers (name, cnpj, phone, email, address, contact_name, notes)
      VALUES (@name, @cnpj, @phone, @email, @address, @contact_name, @notes)
    `).run(data)
    return { id: result.lastInsertRowid, ...data }
  })

  ipcMain.handle('suppliers:update', (_e, id: number, data: Record<string, unknown>) => {
    getDb().prepare(`
      UPDATE suppliers SET name=@name, cnpj=@cnpj, phone=@phone, email=@email,
        address=@address, contact_name=@contact_name, notes=@notes WHERE id=?
    `).run({ ...data }, id)
    return true
  })

  ipcMain.handle('suppliers:delete', (_e, id: number) => {
    getDb().prepare('UPDATE suppliers SET active=0 WHERE id=?').run(id)
    return true
  })
}
