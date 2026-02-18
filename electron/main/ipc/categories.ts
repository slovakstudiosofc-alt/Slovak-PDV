import { ipcMain } from 'electron'
import { getDb } from '../database'

export function registerCategoriesIpc(): void {
  ipcMain.handle('categories:list', (_e, activeOnly = false) => {
    const db = getDb()
    if (activeOnly) {
      return db.prepare('SELECT * FROM categories WHERE active = 1 ORDER BY name').all()
    }
    return db.prepare('SELECT * FROM categories ORDER BY name').all()
  })

  ipcMain.handle('categories:create', (_e, data: { name: string; description?: string }) => {
    const db = getDb()
    const result = db.prepare('INSERT INTO categories (name, description) VALUES (@name, @description)').run(data)
    return { id: result.lastInsertRowid, ...data }
  })

  ipcMain.handle('categories:update', (_e, id: number, data: { name: string; description?: string; active?: boolean }) => {
    getDb().prepare('UPDATE categories SET name = @name, description = @description, active = @active WHERE id = ?').run({ ...data, active: data.active ? 1 : 0 }, id)
    return true
  })

  ipcMain.handle('categories:delete', (_e, id: number) => {
    const inUse = getDb().prepare('SELECT id FROM products WHERE category_id = ? LIMIT 1').get(id)
    if (inUse) throw new Error('Categoria está em uso por produtos')
    getDb().prepare('DELETE FROM categories WHERE id = ?').run(id)
    return true
  })
}
