import { ipcMain } from 'electron'
import { getDb } from '../database'
import { runSync, testConnection, initRemoteSchema, startAutoSync, stopAutoSync } from '../sync/engine'

export function registerSyncIpc(): void {
  ipcMain.handle('sync:run', async () => {
    return runSync()
  })

  ipcMain.handle('sync:test', async (_e, cfg: {
    driver: string; host: string; port: string; database: string; user: string; password: string; ssl: boolean
  }) => {
    return testConnection({
      driver: cfg.driver as 'mysql' | 'postgresql',
      host: cfg.host,
      port: parseInt(cfg.port) || 3306,
      database: cfg.database,
      user: cfg.user,
      password: cfg.password,
      ssl: cfg.ssl
    })
  })

  ipcMain.handle('sync:initSchema', async (_e, cfg: {
    driver: string; host: string; port: string; database: string; user: string; password: string; ssl: boolean
  }) => {
    return initRemoteSchema({
      driver: cfg.driver as 'mysql' | 'postgresql',
      host: cfg.host,
      port: parseInt(cfg.port) || 3306,
      database: cfg.database,
      user: cfg.user,
      password: cfg.password,
      ssl: cfg.ssl
    })
  })

  ipcMain.handle('sync:getStatus', () => {
    const db = getDb()
    const pending = (db.prepare('SELECT COUNT(*) as c FROM sync_queue WHERE synced = 0').get() as { c: number }).c
    const lastSync = (db.prepare("SELECT value FROM settings WHERE key = 'sync_last_at'").get() as { value: string } | undefined)?.value || null
    const enabled = (db.prepare("SELECT value FROM settings WHERE key = 'sync_enabled'").get() as { value: string } | undefined)?.value === 'true'
    const recentLogs = db.prepare('SELECT * FROM sync_log ORDER BY id DESC LIMIT 10').all()
    return { pending, lastSync, enabled, recentLogs }
  })

  ipcMain.handle('sync:clearQueue', () => {
    getDb().prepare('DELETE FROM sync_queue WHERE synced = 1').run()
    return true
  })

  ipcMain.handle('sync:startAuto', (_e, intervalMinutes: number) => {
    startAutoSync(intervalMinutes)
    return true
  })

  ipcMain.handle('sync:stopAuto', () => {
    stopAutoSync()
    return true
  })
}
