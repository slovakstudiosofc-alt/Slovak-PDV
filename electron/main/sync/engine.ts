import { getDb } from '../database'
import { getPendingItems, markSynced, markFailed, SyncQueueItem } from './queue'

type RemoteDriver = 'mysql' | 'postgresql'

interface SyncConfig {
  driver: RemoteDriver
  host: string
  port: number
  database: string
  user: string
  password: string
  ssl: boolean
}

interface SyncResult {
  success: boolean
  synced: number
  failed: number
  message: string
}

// Dynamically load the correct DB driver
async function getRemoteConnection(cfg: SyncConfig) {
  if (cfg.driver === 'mysql') {
    const mysql = await import('mysql2/promise')
    const conn = await mysql.createConnection({
      host: cfg.host,
      port: cfg.port,
      database: cfg.database,
      user: cfg.user,
      password: cfg.password,
      ssl: cfg.ssl ? { rejectUnauthorized: false } : undefined,
      connectTimeout: 10000
    })
    return {
      query: async (sql: string, params: unknown[]) => {
        const [rows] = await conn.execute(sql, params)
        return rows
      },
      close: () => conn.end()
    }
  } else {
    const { Client } = await import('pg')
    const client = new Client({
      host: cfg.host,
      port: cfg.port,
      database: cfg.database,
      user: cfg.user,
      password: cfg.password,
      ssl: cfg.ssl ? { rejectUnauthorized: false } : undefined,
      connectionTimeoutMillis: 10000
    })
    await client.connect()
    let paramIdx = 0
    return {
      query: async (sql: string, params: unknown[]) => {
        // Convert ? placeholders to $1, $2, ... for PostgreSQL
        paramIdx = 0
        const pgSql = sql.replace(/\?/g, () => `$${++paramIdx}`)
        const res = await client.query(pgSql, params)
        return res.rows
      },
      close: () => client.end()
    }
  }
}

// Build upsert SQL for a given table and operation
function buildSql(driver: RemoteDriver, table: string, operation: string, data: Record<string, unknown>): { sql: string; params: unknown[] } {
  const cols = Object.keys(data).filter(k => k !== 'id' || operation === 'INSERT')
  const id = data.id as number

  if (operation === 'DELETE') {
    return { sql: `UPDATE ${table} SET active = 0 WHERE id = ?`, params: [id] }
  }

  if (operation === 'INSERT') {
    if (driver === 'mysql') {
      const colList = cols.join(', ')
      const placeholders = cols.map(() => '?').join(', ')
      const updateClause = cols.filter(c => c !== 'id').map(c => `${c} = VALUES(${c})`).join(', ')
      return {
        sql: `INSERT INTO ${table} (${colList}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateClause}`,
        params: cols.map(c => data[c] ?? null)
      }
    } else {
      const colList = cols.join(', ')
      const placeholders = cols.map(() => '?').join(', ')
      const updateCols = cols.filter(c => c !== 'id')
      const updateClause = updateCols.map(c => `${c} = EXCLUDED.${c}`).join(', ')
      return {
        sql: `INSERT INTO ${table} (${colList}) VALUES (${placeholders}) ON CONFLICT (id) DO UPDATE SET ${updateClause}`,
        params: cols.map(c => data[c] ?? null)
      }
    }
  }

  // UPDATE
  const setCols = cols.filter(c => c !== 'id')
  const setClause = setCols.map(c => `${c} = ?`).join(', ')
  return {
    sql: `UPDATE ${table} SET ${setClause} WHERE id = ?`,
    params: [...setCols.map(c => data[c] ?? null), id]
  }
}

export async function runSync(): Promise<SyncResult> {
  const db = getDb()
  const settings = db.prepare('SELECT key, value FROM settings WHERE key LIKE \'sync_%\'').all() as { key: string; value: string }[]
  const cfg: Record<string, string> = Object.fromEntries(settings.map(s => [s.key, s.value]))

  if (cfg.sync_enabled !== 'true') {
    return { success: false, synced: 0, failed: 0, message: 'Sync não habilitado' }
  }
  if (!cfg.sync_host || !cfg.sync_database || !cfg.sync_user) {
    return { success: false, synced: 0, failed: 0, message: 'Configuração incompleta' }
  }

  const syncCfg: SyncConfig = {
    driver: (cfg.sync_driver || 'mysql') as RemoteDriver,
    host: cfg.sync_host,
    port: parseInt(cfg.sync_port) || (cfg.sync_driver === 'postgresql' ? 5432 : 3306),
    database: cfg.sync_database,
    user: cfg.sync_user,
    password: cfg.sync_password || '',
    ssl: cfg.sync_ssl === 'true'
  }

  let remote: Awaited<ReturnType<typeof getRemoteConnection>> | null = null
  let synced = 0
  let failed = 0

  try {
    remote = await getRemoteConnection(syncCfg)
    const items = getPendingItems(db)

    for (const item of items) {
      try {
        const data = JSON.parse(item.data) as Record<string, unknown>
        const { sql, params } = buildSql(syncCfg.driver, item.table_name, item.operation, data)
        await remote.query(sql, params)
        markSynced(db, [item.id])
        synced++
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        markFailed(db, item.id, msg)
        failed++
      }
    }

    // Record sync log
    const status = failed === 0 ? 'success' : synced > 0 ? 'partial' : 'error'
    db.prepare('INSERT INTO sync_log (status, items_synced, items_failed, message) VALUES (?, ?, ?, ?)').run(status, synced, failed, `Sync concluído`)
    db.prepare("UPDATE settings SET value = datetime('now','localtime') WHERE key = 'sync_last_at'").run()

    return { success: true, synced, failed, message: `${synced} registros sincronizados${failed > 0 ? `, ${failed} falhas` : ''}` }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    db.prepare('INSERT INTO sync_log (status, items_synced, items_failed, message) VALUES (?, ?, ?, ?)').run('error', 0, 0, msg)
    return { success: false, synced: 0, failed: 0, message: msg }
  } finally {
    await remote?.close().catch(() => {})
  }
}

export async function testConnection(cfg: SyncConfig): Promise<{ success: boolean; message: string }> {
  let remote: Awaited<ReturnType<typeof getRemoteConnection>> | null = null
  try {
    remote = await getRemoteConnection(cfg)
    await remote.query('SELECT 1', [])
    return { success: true, message: 'Conexão estabelecida com sucesso!' }
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : String(err) }
  } finally {
    await remote?.close().catch(() => {})
  }
}

// Remote DB schema creation (mirrors local SQLite schema in MySQL/PostgreSQL)
export async function initRemoteSchema(cfg: SyncConfig): Promise<{ success: boolean; message: string }> {
  let remote: Awaited<ReturnType<typeof getRemoteConnection>> | null = null
  try {
    remote = await getRemoteConnection(cfg)
    const isMySQL = cfg.driver === 'mysql'
    const AUTO = isMySQL ? 'INT AUTO_INCREMENT PRIMARY KEY' : 'SERIAL PRIMARY KEY'
    const TEXT = isMySQL ? 'TEXT' : 'TEXT'
    const REAL = isMySQL ? 'DOUBLE' : 'DOUBLE PRECISION'
    const tables = [
      `CREATE TABLE IF NOT EXISTS users (id ${AUTO}, name ${TEXT}, username ${TEXT}, password ${TEXT}, role ${TEXT}, active INT DEFAULT 1, created_at ${TEXT}, updated_at ${TEXT})`,
      `CREATE TABLE IF NOT EXISTS categories (id ${AUTO}, name ${TEXT}, description ${TEXT}, active INT DEFAULT 1, created_at ${TEXT})`,
      `CREATE TABLE IF NOT EXISTS suppliers (id ${AUTO}, name ${TEXT}, cnpj ${TEXT}, phone ${TEXT}, email ${TEXT}, address ${TEXT}, contact_name ${TEXT}, notes ${TEXT}, active INT DEFAULT 1, created_at ${TEXT})`,
      `CREATE TABLE IF NOT EXISTS products (id ${AUTO}, code ${TEXT}, barcode ${TEXT}, name ${TEXT}, description ${TEXT}, category_id INT, supplier_id INT, price ${REAL} DEFAULT 0, cost_price ${REAL} DEFAULT 0, stock ${REAL} DEFAULT 0, min_stock ${REAL} DEFAULT 0, unit ${TEXT}, active INT DEFAULT 1, created_at ${TEXT}, updated_at ${TEXT})`,
      `CREATE TABLE IF NOT EXISTS customers (id ${AUTO}, name ${TEXT}, cpf_cnpj ${TEXT}, rg ${TEXT}, phone ${TEXT}, phone2 ${TEXT}, email ${TEXT}, address ${TEXT}, number ${TEXT}, complement ${TEXT}, neighborhood ${TEXT}, city ${TEXT}, state ${TEXT}, zip_code ${TEXT}, birth_date ${TEXT}, notes ${TEXT}, credit_limit ${REAL} DEFAULT 0, active INT DEFAULT 1, created_at ${TEXT}, updated_at ${TEXT})`,
      `CREATE TABLE IF NOT EXISTS sales (id ${AUTO}, code ${TEXT}, customer_id INT, user_id INT, subtotal ${REAL}, discount ${REAL}, total ${REAL}, payment_method ${TEXT}, payment_amount ${REAL}, change_amount ${REAL}, status ${TEXT}, notes ${TEXT}, created_at ${TEXT})`,
      `CREATE TABLE IF NOT EXISTS sale_items (id ${AUTO}, sale_id INT, product_id INT, product_name ${TEXT}, product_code ${TEXT}, quantity ${REAL}, unit_price ${REAL}, discount ${REAL}, total ${REAL})`,
      `CREATE TABLE IF NOT EXISTS service_orders (id ${AUTO}, code ${TEXT}, customer_id INT, user_id INT, equipment ${TEXT}, brand ${TEXT}, model ${TEXT}, serial_number ${TEXT}, accessories ${TEXT}, problem_description ${TEXT}, diagnosis ${TEXT}, solution ${TEXT}, status ${TEXT}, priority ${TEXT}, estimated_value ${REAL}, final_value ${REAL}, estimated_date ${TEXT}, warranty_days INT, notes ${TEXT}, created_at ${TEXT}, updated_at ${TEXT})`,
      `CREATE TABLE IF NOT EXISTS service_order_items (id ${AUTO}, service_order_id INT, product_id INT, description ${TEXT}, quantity ${REAL}, unit_price ${REAL}, total ${REAL}, type ${TEXT})`
    ]
    for (const sql of tables) {
      await remote.query(sql, [])
    }
    return { success: true, message: 'Schema criado/verificado com sucesso!' }
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : String(err) }
  } finally {
    await remote?.close().catch(() => {})
  }
}

let syncTimer: ReturnType<typeof setInterval> | null = null

export function startAutoSync(intervalMinutes = 5): void {
  stopAutoSync()
  syncTimer = setInterval(() => { runSync().catch(() => {}) }, intervalMinutes * 60 * 1000)
}

export function stopAutoSync(): void {
  if (syncTimer) { clearInterval(syncTimer); syncTimer = null }
}
