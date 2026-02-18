import { ipcMain } from 'electron'
import { getDb } from '../database'

interface PrinterSettings {
  printer_type: string
  printer_port: string
  printer_ip: string
  printer_network_port: string
  store_name: string
  store_cnpj: string
  store_address: string
  store_phone: string
  receipt_footer: string
  currency_symbol: string
}

function getSettings(db: ReturnType<typeof getDb>): PrinterSettings {
  const rows = db.prepare("SELECT key, value FROM settings WHERE key IN ('printer_type','printer_port','printer_ip','printer_network_port','store_name','store_cnpj','store_address','store_phone','receipt_footer','currency_symbol')").all() as { key: string; value: string }[]
  return Object.fromEntries(rows.map(r => [r.key, r.value])) as unknown as PrinterSettings
}

async function getPrinterDevice(settings: PrinterSettings) {
  const escpos = await import('escpos')
  let device
  if (settings.printer_type === 'usb') {
    const USB = (await import('escpos-usb')).default
    device = new USB()
  } else if (settings.printer_type === 'network') {
    const Network = (await import('escpos-network')).default
    device = new Network(settings.printer_ip, parseInt(settings.printer_network_port) || 9100)
  } else {
    const Serial = (await import('escpos-serialport')).default
    const { SerialPort } = await import('serialport')
    device = new Serial(settings.printer_port, { SerialPort })
  }
  return { escpos, device }
}

export function registerPrinterIpc(): void {
  ipcMain.handle('printer:test', async () => {
    const db = getDb()
    const enabled = (db.prepare("SELECT value FROM settings WHERE key='printer_enabled'").get() as { value: string })?.value
    if (enabled !== 'true') return { success: false, message: 'Impressora não habilitada' }
    try {
      const settings = getSettings(db)
      const { escpos, device } = await getPrinterDevice(settings)
      await new Promise<void>((res, rej) => device.open((err: Error) => err ? rej(err) : res()))
      const printer = new escpos.Printer(device)
      printer
        .font('a').align('ct').style('bu').size(1, 1)
        .text('TESTE DE IMPRESSÃO')
        .text('Slovak PDV')
        .text(new Date().toLocaleString('pt-BR'))
        .feed(3).cut()
      await new Promise<void>(res => printer.close(() => res()))
      return { success: true }
    } catch (err: unknown) {
      return { success: false, message: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('printer:printReceipt', async (_e, receiptData: {
    code: string
    date: string
    customer?: string
    items: { name: string; quantity: number; unit_price: number; total: number }[]
    subtotal: number
    discount: number
    total: number
    payment_method: string
    payment_amount: number
    change_amount: number
    user: string
  }) => {
    const db = getDb()
    const enabled = (db.prepare("SELECT value FROM settings WHERE key='printer_enabled'").get() as { value: string })?.value
    if (enabled !== 'true') return { success: false, message: 'Impressora não habilitada' }

    try {
      const settings = getSettings(db)
      const sym = settings.currency_symbol || 'R$'
      const fmt = (v: number) => `${sym} ${v.toFixed(2)}`
      const { escpos, device } = await getPrinterDevice(settings)
      await new Promise<void>((res, rej) => device.open((err: Error) => err ? rej(err) : res()))
      const printer = new escpos.Printer(device)

      printer.font('a').align('ct').style('bu').size(1, 1).text(settings.store_name || 'MINHA LOJA')
      printer.style('normal').size(0, 0)
      if (settings.store_cnpj) printer.text(`CNPJ: ${settings.store_cnpj}`)
      if (settings.store_address) printer.text(settings.store_address)
      if (settings.store_phone) printer.text(`Tel: ${settings.store_phone}`)
      printer.drawLine()
      printer.align('lt')
      printer.text(`CUPOM: ${receiptData.code}`)
      printer.text(`DATA: ${receiptData.date}`)
      if (receiptData.customer) printer.text(`CLIENTE: ${receiptData.customer}`)
      printer.text(`OPERADOR: ${receiptData.user}`)
      printer.drawLine()

      for (const item of receiptData.items) {
        const line = `${item.quantity}x ${item.name}`
        printer.text(line)
        printer.align('rt').text(fmt(item.total))
        printer.align('lt')
      }

      printer.drawLine()
      printer.align('rt')
      printer.text(`SUBTOTAL: ${fmt(receiptData.subtotal)}`)
      if (receiptData.discount > 0) printer.text(`DESCONTO: -${fmt(receiptData.discount)}`)
      printer.style('bu').text(`TOTAL: ${fmt(receiptData.total)}`)
      printer.style('normal').text(`${receiptData.payment_method.toUpperCase()}: ${fmt(receiptData.payment_amount)}`)
      if (receiptData.change_amount > 0) printer.text(`TROCO: ${fmt(receiptData.change_amount)}`)

      printer.align('ct')
      printer.drawLine()
      if (settings.receipt_footer) printer.text(settings.receipt_footer)
      printer.feed(4).cut()

      await new Promise<void>(res => printer.close(() => res()))
      return { success: true }
    } catch (err: unknown) {
      return { success: false, message: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('printer:printServiceOrder', async (_e, so: Record<string, unknown>) => {
    const db = getDb()
    const enabled = (db.prepare("SELECT value FROM settings WHERE key='printer_enabled'").get() as { value: string })?.value
    if (enabled !== 'true') return { success: false, message: 'Impressora não habilitada' }

    try {
      const settings = getSettings(db)
      const { escpos, device } = await getPrinterDevice(settings)
      await new Promise<void>((res, rej) => device.open((err: Error) => err ? rej(err) : res()))
      const printer = new escpos.Printer(device)

      printer.font('a').align('ct').style('bu').size(1, 1).text(settings.store_name || 'MINHA LOJA')
      printer.style('normal').size(0, 0)
      printer.drawLine()
      printer.style('bu').text(`ORDEM DE SERVIÇO: ${so.code}`)
      printer.style('normal')
      printer.align('lt')
      printer.text(`DATA: ${so.created_at}`)
      printer.text(`CLIENTE: ${so.customer_name || 'Sem cliente'}`)
      printer.text(`EQUIPAMENTO: ${so.equipment}`)
      if (so.brand) printer.text(`MARCA/MODELO: ${so.brand} ${so.model || ''}`)
      if (so.serial_number) printer.text(`N/S: ${so.serial_number}`)
      printer.drawLine()
      printer.text(`PROBLEMA: ${so.problem_description}`)
      if (so.diagnosis) { printer.drawLine(); printer.text(`DIAGNÓSTICO: ${so.diagnosis}`) }
      printer.drawLine()
      printer.text(`STATUS: ${String(so.status).toUpperCase()}`)
      if (so.estimated_value) printer.text(`VALOR ESTIMADO: R$ ${Number(so.estimated_value).toFixed(2)}`)
      printer.drawLine()
      printer.align('ct').text('Assinatura: _________________________').feed(4).cut()

      await new Promise<void>(res => printer.close(() => res()))
      return { success: true }
    } catch (err: unknown) {
      return { success: false, message: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('printer:listUsbDevices', async () => {
    try {
      const USB = (await import('escpos-usb')).default
      const devices = USB.findPrinter()
      return devices.map((d: Record<string, unknown>) => ({ vendorId: d.vendorId, productId: d.productId }))
    } catch {
      return []
    }
  })
}
