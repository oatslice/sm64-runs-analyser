/**
 * useStarTimer.js
 *
 * Central state for the Star Timer feature, persisted in localStorage.
 *
 * Collection shape:
 *   { id, name, stars: [{stage, star, strategy}], offsetSeconds: number|null, lssSegmentName: string|null }
 *
 * starKey = `${stage}||${star}||${strategy}`
 */
import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'sm64_star_timer'

export function makeStarKey(stage, star, strategy) {
  return `${stage}||${star}||${strategy}`
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { attempts: {}, collections: [] }
    return JSON.parse(raw)
  } catch { return { attempts: {}, collections: [] } }
}

function save(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch { /* quota */ }
}

// â”€â”€ CSV export/import helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const CSV_HEADER = 'stage,star,strategy,timestamp,success,time_seconds'

/**
 * Export all attempts to a CSV string, sorted by stage > star > strategy > timestamp.
 * Each row is one attempt.
 */
export function exportToCSV(attempts, collections) {
  const rows = []

  for (const [key, attemptList] of Object.entries(attempts)) {
    const [stage, star, strategy] = key.split('||')
    for (const attempt of attemptList) {
      rows.push({
        stage, star, strategy,
        timestamp:    attempt.timestamp,
        success:      attempt.success ? '1' : '0',
        time_seconds: attempt.timeSeconds != null ? String(attempt.timeSeconds) : '',
        _ts:          new Date(attempt.timestamp).getTime(),
      })
    }
  }

  // Sort: stage asc (numeric prefix sorts correctly), then star, strategy, then timestamp
  rows.sort((a, b) => {
    if (a.stage !== b.stage)       return a.stage.localeCompare(b.stage)
    if (a.star !== b.star)         return a.star.localeCompare(b.star)
    if (a.strategy !== b.strategy) return a.strategy.localeCompare(b.strategy)
    return a._ts - b._ts
  })

  const csvRows = rows.map(r => [
    csvEscape(r.stage),
    csvEscape(r.star),
    csvEscape(r.strategy),
    csvEscape(r.timestamp),
    r.success,
    r.time_seconds,
  ].join(','))

  return [CSV_HEADER, ...csvRows].join('\n')
}

function csvEscape(str) {
  if (str == null) return ''
  const s = String(str)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

/**
 * Parse a CSV string back into { attempts, collections }.
 * Returns { data, errors } where data is the parsed state and errors is a string[] of warnings.
 */
export function importFromCSV(csvText) {
  const lines  = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const errors = []
  const attempts = {}

  // Skip header line
  const dataLines = lines[0]?.trim().toLowerCase().startsWith('stage') ? lines.slice(1) : lines

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i].trim()
    if (!line) continue

    const cols = parseCSVRow(line)
    if (cols.length < 5) {
      errors.push(`Row ${i + 2}: too few columns (got ${cols.length}, expected 6) â€” skipped`)
      continue
    }

    const [stage, star, strategy, timestamp, successStr, timeSecondsStr] = cols
    if (!stage || !star || !strategy) {
      errors.push(`Row ${i + 2}: missing stage/star/strategy â€” skipped`)
      continue
    }

    const success     = successStr.trim() === '1' || successStr.trim().toLowerCase() === 'true'
    const timeSeconds = timeSecondsStr?.trim() ? parseFloat(timeSecondsStr) : null

    const attempt = {
      id:          crypto.randomUUID(),
      timestamp:   timestamp || new Date().toISOString(),
      success,
      timeSeconds: success && timeSeconds != null && !isNaN(timeSeconds) ? timeSeconds : null,
    }

    const key = makeStarKey(stage.trim(), star.trim(), strategy.trim())
    if (!attempts[key]) attempts[key] = []
    attempts[key].push(attempt)
  }

  return { data: { attempts, collections: [] }, errors }
}

function parseCSVRow(line) {
  const cols = []
  let i = 0
  while (i < line.length) {
    if (line[i] === '"') {
      // Quoted field
      let field = ''
      i++ // skip opening quote
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') { field += '"'; i += 2 }
        else if (line[i] === '"') { i++; break }
        else { field += line[i++] }
      }
      cols.push(field)
      if (line[i] === ',') i++
    } else {
      const end = line.indexOf(',', i)
      if (end === -1) { cols.push(line.slice(i)); break }
      cols.push(line.slice(i, end))
      i = end + 1
    }
  }
  return cols
}

export function useStarTimer() {
  const [data, setData] = useState(load)
  useEffect(() => { save(data) }, [data])

  // â”€â”€ Attempts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const addAttempt = useCallback((stage, star, strategy, timeSeconds, success) => {
    const key = makeStarKey(stage, star, strategy)
    const attempt = {
      id: crypto.randomUUID(), timestamp: new Date().toISOString(),
      success: Boolean(success), timeSeconds: success ? Number(timeSeconds) : null,
    }
    setData(p => ({ ...p, attempts: { ...p.attempts, [key]: [...(p.attempts[key] ?? []), attempt] } }))
  }, [])

  const deleteAttempt = useCallback((stage, star, strategy, id) => {
    const key = makeStarKey(stage, star, strategy)
    setData(p => ({ ...p, attempts: { ...p.attempts, [key]: (p.attempts[key] ?? []).filter(a => a.id !== id) } }))
  }, [])

  const editAttempt = useCallback((stage, star, strategy, id, updates) => {
    const key = makeStarKey(stage, star, strategy)
    setData(p => ({
      ...p, attempts: { ...p.attempts, [key]: (p.attempts[key] ?? []).map(a => a.id === id ? { ...a, ...updates } : a) },
    }))
  }, [])

  const getAttempts = useCallback((stage, star, strategy) =>
    data.attempts[makeStarKey(stage, star, strategy)] ?? [], [data.attempts])

  const getSuccessTimes = useCallback((stage, star, strategy) =>
    (data.attempts[makeStarKey(stage, star, strategy)] ?? [])
      .filter(a => a.success && a.timeSeconds != null).map(a => a.timeSeconds),
  [data.attempts])

  // â”€â”€ Collections â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const createCollection = useCallback((name, stars = [], offsetSeconds = null, lssSegmentName = null) => {
    const col = { id: crypto.randomUUID(), name, stars, offsetSeconds, lssSegmentName }
    setData(p => ({ ...p, collections: [...p.collections, col] }))
    return col.id
  }, [])

  const deleteCollection = useCallback((id) =>
    setData(p => ({ ...p, collections: p.collections.filter(c => c.id !== id) })), [])

  const renameCollection = useCallback((id, name) =>
    setData(p => ({ ...p, collections: p.collections.map(c => c.id === id ? { ...c, name } : c) })), [])

  const setCollectionOffset = useCallback((id, offsetSeconds, lssSegmentName) =>
    setData(p => ({
      ...p, collections: p.collections.map(c =>
        c.id === id ? { ...c, offsetSeconds: offsetSeconds ?? null, lssSegmentName: lssSegmentName ?? null } : c
      ),
    })), [])

  const addStarToCollection = useCallback((colId, stage, star, strategy) =>
    setData(p => ({
      ...p, collections: p.collections.map(c => {
        if (c.id !== colId) return c
        if (c.stars.some(s => s.stage === stage && s.star === star && s.strategy === strategy)) return c
        return { ...c, stars: [...c.stars, { stage, star, strategy }] }
      }),
    })), [])

  const removeStarFromCollection = useCallback((colId, stage, star, strategy) =>
    setData(p => ({
      ...p, collections: p.collections.map(c =>
        c.id !== colId ? c : {
          ...c, stars: c.stars.filter(s => !(s.stage === stage && s.star === star && s.strategy === strategy))
        }
      ),
    })), [])

  const getCollectionTimes = useCallback((colId) => {
    const col = data.collections.find(c => c.id === colId)
    if (!col) return []
    return col.stars.map(({ stage, star, strategy }) => ({
      stage, star, strategy, times: getSuccessTimes(stage, star, strategy),
    }))
  }, [data.collections, getSuccessTimes])

  const clearAll = useCallback(() => setData({ attempts: {}, collections: [] }), [])

  /**
   * Merge imported attempts into existing data.
   * mode: 'merge' (add alongside existing) | 'replace' (replace attempts only, keep collections)
   */
  const importData = useCallback((importedAttempts, mode = 'merge') => {
    setData(prev => {
      if (mode === 'replace') {
        return { ...prev, attempts: importedAttempts }
      }
      // merge: append imported attempts to existing ones
      const merged = { ...prev.attempts }
      for (const [key, list] of Object.entries(importedAttempts)) {
        merged[key] = [...(merged[key] ?? []), ...list]
      }
      return { ...prev, attempts: merged }
    })
  }, [])

  return {
    attempts: data.attempts, collections: data.collections,
    addAttempt, deleteAttempt, editAttempt, getAttempts, getSuccessTimes,
    createCollection, deleteCollection, renameCollection, setCollectionOffset,
    addStarToCollection, removeStarFromCollection, getCollectionTimes,
    clearAll, makeStarKey, importData,
  }
}
