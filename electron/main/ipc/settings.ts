import { ipcMain } from 'electron'
import { getDb } from '../database'

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:getAll', () => {
    const rows = getDb().prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
    return Object.fromEntries(rows.map(r => [r.key, r.value]))
  })

  ipcMain.handle('settings:get', (_e, key: string) => {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
    return row?.value
  })

  ipcMain.handle('settings:set', (_e, key: string, value: string) => {
    getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
    return true
  })

  ipcMain.handle('settings:setMultiple', (_e, data: Record<string, string>) => {
    const db = getDb()
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    const update = db.transaction(() => {
      for (const [key, value] of Object.entries(data)) {
        stmt.run(key, value)
      }
    })
    update()
    return true
  })

  ipcMain.handle('settings:getPaymentMethods', () => {
    return getDb().prepare('SELECT * FROM payment_methods ORDER BY name').all()
  })

  ipcMain.handle('settings:createPaymentMethod', (_e, data: { name: string; type: string }) => {
    const result = getDb().prepare('INSERT INTO payment_methods (name, type) VALUES (@name, @type)').run(data)
    return { id: result.lastInsertRowid, ...data }
  })

  ipcMain.handle('settings:updatePaymentMethod', (_e, id: number, data: { name: string; type: string; active: boolean }) => {
    getDb().prepare('UPDATE payment_methods SET name=@name, type=@type, active=@active WHERE id=?').run({ ...data, active: data.active ? 1 : 0 }, id)
    return true
  })

  ipcMain.handle('settings:deletePaymentMethod', (_e, id: number) => {
    getDb().prepare('DELETE FROM payment_methods WHERE id = ?').run(id)
    return true
  })
}
