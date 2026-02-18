import { ipcMain } from 'electron'
import { getDb } from '../database'

export function registerCashDrawerIpc(): void {
  ipcMain.handle('cashDrawer:open', async () => {
    const db = getDb()
    const enabled = (db.prepare("SELECT value FROM settings WHERE key='cash_drawer_enabled'").get() as { value: string })?.value
    if (enabled !== 'true') return { success: false, message: 'Gaveta não configurada' }

    const port = (db.prepare("SELECT value FROM settings WHERE key='cash_drawer_port'").get() as { value: string })?.value || 'COM1'
    const baud = parseInt((db.prepare("SELECT value FROM settings WHERE key='cash_drawer_baud'").get() as { value: string })?.value || '9600')

    try {
      const { SerialPort } = await import('serialport')
      const sp = new SerialPort({ path: port, baudRate: baud, autoOpen: false })
      await new Promise<void>((res, rej) => sp.open(err => err ? rej(err) : res()))
      const cmd = Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA])
      await new Promise<void>((res, rej) => sp.write(cmd, err => err ? rej(err) : res()))
      await new Promise<void>((res, rej) => sp.close(err => err ? rej(err) : res()))
      return { success: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, message: msg }
    }
  })

  ipcMain.handle('cashDrawer:openViaEscpos', async () => {
    return { success: true, message: 'Aberto via impressora' }
  })

  ipcMain.handle('cashDrawer:listPorts', async () => {
    try {
      const { SerialPort } = await import('serialport')
      const ports = await SerialPort.list()
      return ports.map(p => p.path)
    } catch {
      return []
    }
  })
}
