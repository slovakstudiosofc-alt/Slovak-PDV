import { ipcMain } from 'electron'
import { getDb } from '../database'
import bcrypt from 'bcryptjs'

export function registerUsersIpc(): void {
  ipcMain.handle('users:list', () => {
    return getDb().prepare('SELECT id, name, username, role, active, created_at FROM users ORDER BY name').all()
  })

  ipcMain.handle('users:get', (_e, id: number) => {
    return getDb().prepare('SELECT id, name, username, role, active, created_at FROM users WHERE id = ?').get(id)
  })

  ipcMain.handle('users:create', (_e, data: { name: string; username: string; password: string; role: string }) => {
    const db = getDb()
    const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(data.username)
    if (exists) throw new Error('Nome de usuário já está em uso')
    const hash = bcrypt.hashSync(data.password, 10)
    const result = db.prepare('INSERT INTO users (name, username, password, role) VALUES (@name, @username, @password, @role)')
      .run({ ...data, password: hash })
    return { id: result.lastInsertRowid }
  })

  ipcMain.handle('users:update', (_e, id: number, data: { name: string; username: string; role: string; active: boolean; password?: string }) => {
    const db = getDb()
    const exists = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(data.username, id)
    if (exists) throw new Error('Nome de usuário já está em uso')
    if (data.password) {
      const hash = bcrypt.hashSync(data.password, 10)
      db.prepare('UPDATE users SET name=@name, username=@username, role=@role, active=@active, password=@password, updated_at=datetime(\'now\',\'localtime\') WHERE id=?')
        .run({ ...data, active: data.active ? 1 : 0, password: hash }, id)
    } else {
      db.prepare('UPDATE users SET name=@name, username=@username, role=@role, active=@active, updated_at=datetime(\'now\',\'localtime\') WHERE id=?')
        .run({ name: data.name, username: data.username, role: data.role, active: data.active ? 1 : 0 }, id)
    }
    return true
  })

  ipcMain.handle('users:delete', (_e, id: number) => {
    const adminCount = getDb().prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin' AND active = 1").get() as { c: number }
    if (adminCount.c <= 1) {
      const target = getDb().prepare("SELECT role FROM users WHERE id = ?").get(id) as { role: string }
      if (target?.role === 'admin') throw new Error('Não é possível remover o único administrador')
    }
    getDb().prepare('UPDATE users SET active = 0 WHERE id = ?').run(id)
    return true
  })

  ipcMain.handle('users:login', (_e, username: string, password: string) => {
    const user = getDb().prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username) as { id: number; password: string; name: string; role: string; username: string } | undefined
    if (!user) return null
    const valid = bcrypt.compareSync(password, user.password)
    if (!valid) return null
    return { id: user.id, name: user.name, username: user.username, role: user.role }
  })

  ipcMain.handle('users:changePassword', (_e, id: number, oldPassword: string, newPassword: string) => {
    const user = getDb().prepare('SELECT password FROM users WHERE id = ?').get(id) as { password: string }
    if (!user || !bcrypt.compareSync(oldPassword, user.password)) {
      throw new Error('Senha atual incorreta')
    }
    const hash = bcrypt.hashSync(newPassword, 10)
    getDb().prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, id)
    return true
  })
}
