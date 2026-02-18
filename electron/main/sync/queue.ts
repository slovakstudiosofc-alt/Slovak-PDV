import Database from 'better-sqlite3'

export type SyncOperation = 'INSERT' | 'UPDATE' | 'DELETE'

export function addToSyncQueue(
  db: Database.Database,
  table: string,
  operation: SyncOperation,
  recordId: number,
  data: Record<string, unknown>
): void {
  try {
    db.prepare(`
      INSERT INTO sync_queue (table_name, operation, record_id, data, created_at)
      VALUES (?, ?, ?, ?, datetime('now','localtime'))
    `).run(table, operation, recordId, JSON.stringify(data))
  } catch {
    // sync queue is best-effort, never block main operations
  }
}

export function getPendingItems(db: Database.Database): SyncQueueItem[] {
  return db.prepare(`
    SELECT * FROM sync_queue WHERE synced = 0 ORDER BY id ASC LIMIT 500
  `).all() as SyncQueueItem[]
}

export function markSynced(db: Database.Database, ids: number[]): void {
  if (ids.length === 0) return
  const placeholders = ids.map(() => '?').join(',')
  db.prepare(`
    UPDATE sync_queue SET synced = 1, synced_at = datetime('now','localtime')
    WHERE id IN (${placeholders})
  `).run(...ids)
}

export function markFailed(db: Database.Database, id: number, error: string): void {
  db.prepare(`
    UPDATE sync_queue SET retry_count = retry_count + 1, last_error = ?
    WHERE id = ?
  `).run(error, id)
}

export interface SyncQueueItem {
  id: number
  table_name: string
  operation: SyncOperation
  record_id: number
  data: string
  synced: number
  retry_count: number
  last_error: string | null
  created_at: string
  synced_at: string | null
}
