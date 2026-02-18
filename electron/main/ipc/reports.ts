import { ipcMain } from 'electron'
import { getDb } from '../database'

export function registerReportsIpc(): void {
  ipcMain.handle('reports:salesSummary', (_e, start: string, end: string) => {
    const db = getDb()
    const summary = db.prepare(`
      SELECT
        COUNT(*) as total_sales,
        SUM(total) as total_revenue,
        SUM(discount) as total_discounts,
        AVG(total) as avg_ticket,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
      FROM sales
      WHERE date(created_at) BETWEEN date(?) AND date(?) AND status != 'cancelled'
    `).get(start, end)

    const byPayment = db.prepare(`
      SELECT payment_method, COUNT(*) as count, SUM(total) as total
      FROM sales
      WHERE date(created_at) BETWEEN date(?) AND date(?) AND status = 'completed'
      GROUP BY payment_method ORDER BY total DESC
    `).all(start, end)

    const byDay = db.prepare(`
      SELECT date(created_at) as day, COUNT(*) as count, SUM(total) as total
      FROM sales
      WHERE date(created_at) BETWEEN date(?) AND date(?) AND status = 'completed'
      GROUP BY date(created_at) ORDER BY day
    `).all(start, end)

    const topProducts = db.prepare(`
      SELECT si.product_name, SUM(si.quantity) as qty, SUM(si.total) as total
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE date(s.created_at) BETWEEN date(?) AND date(?) AND s.status = 'completed'
      GROUP BY si.product_id ORDER BY total DESC LIMIT 10
    `).all(start, end)

    return { summary, byPayment, byDay, topProducts }
  })

  ipcMain.handle('reports:stockReport', () => {
    return getDb().prepare(`
      SELECT p.*, c.name as category_name,
        (p.price * p.stock) as stock_value
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.active = 1
      ORDER BY p.name
    `).all()
  })

  ipcMain.handle('reports:cashFlow', (_e, start: string, end: string) => {
    const db = getDb()
    const inflow = db.prepare(`
      SELECT SUM(total) as total FROM sales
      WHERE date(created_at) BETWEEN date(?) AND date(?) AND status = 'completed'
    `).get(start, end)

    const byHour = db.prepare(`
      SELECT strftime('%H', created_at) as hour, COUNT(*) as count, SUM(total) as total
      FROM sales
      WHERE date(created_at) BETWEEN date(?) AND date(?) AND status = 'completed'
      GROUP BY hour ORDER BY hour
    `).all(start, end)

    return { inflow, byHour }
  })

  ipcMain.handle('reports:serviceOrdersSummary', (_e, start: string, end: string) => {
    const db = getDb()
    return db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(final_value) as total_revenue
      FROM service_orders
      WHERE date(created_at) BETWEEN date(?) AND date(?)
    `).get(start, end)
  })

  ipcMain.handle('reports:dashboard', () => {
    const db = getDb()
    const today = db.prepare(`
      SELECT COUNT(*) as sales_count, SUM(total) as sales_total
      FROM sales WHERE date(created_at) = date('now','localtime') AND status = 'completed'
    `).get()
    const month = db.prepare(`
      SELECT COUNT(*) as sales_count, SUM(total) as sales_total
      FROM sales WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now','localtime') AND status = 'completed'
    `).get()
    const lowStock = db.prepare('SELECT COUNT(*) as count FROM products WHERE active=1 AND stock <= min_stock AND min_stock > 0').get()
    const pendingOS = db.prepare("SELECT COUNT(*) as count FROM service_orders WHERE status IN ('pending','in_progress')").get()
    const last7days = db.prepare(`
      SELECT date(created_at) as day, SUM(total) as total FROM sales
      WHERE created_at >= datetime('now','-7 days','localtime') AND status = 'completed'
      GROUP BY day ORDER BY day
    `).all()
    return { today, month, lowStock, pendingOS, last7days }
  })
}
