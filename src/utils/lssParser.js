/**
 * lssParser.js
 *
 * Reset rate: survival formula â€” (prev_reached - reached_i) / prev_reached
 *   "reached_i" = count of positive-id <Time> entries in segment i's history
 *   prev_reached starts at AttemptCount.
 *
 * Segment times: only count attempt IDs that have NOT self-closed on any
 *   earlier segment, to avoid anomalous carry-over times from aborted runs.
 *   Each segment stores { times: number[], attemptIds: number[] } in parallel
 *   so that run-level filters (by total duration) can gate by ID.
 *
 * Attempt durations: computed from started/ended wall-clock attributes on
 *   <Attempt> elements in <AttemptHistory>. This captures ALL attempts
 *   including resets, unlike RealTime which only appears on completed runs.
 *   Returned as attemptDurationById: Map<number, number> (id -> seconds).
 */

export function parseLSSTime(str) {
  if (!str) return null
  const match = str.trim().match(/^(\d+):(\d{2}):(\d{2})\.(\d+)$/)
  if (!match) return null
  const [, h, m, s, frac] = match
  return parseInt(h,10)*3600 + parseInt(m,10)*60 + parseInt(s,10) + parseFloat('0.'+frac)
}

function parseLSSWallClock(str) {
  // LiveSplit format: "MM/DD/YYYY HH:MM:SS"
  if (!str) return null
  const match = str.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/)
  if (!match) return null
  const [, mo, day, yr, hr, min, sec] = match
  return new Date(
    parseInt(yr,10), parseInt(mo,10)-1, parseInt(day,10),
    parseInt(hr,10), parseInt(min,10), parseInt(sec,10)
  ).getTime() / 1000  // unix epoch seconds
}

function getText(el, tagName) {
  if (!el) return null
  const child = el.querySelector(tagName) || el.querySelector(tagName.toLowerCase())
  return child?.textContent?.trim() || null
}

export function parseLSS(fileText) {
  const xml = fileText.replace(/^\uFEFF/, '')
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'text/xml')
  const parseError = doc.querySelector('parsererror')
  if (parseError) throw new Error('XML parse error: ' + parseError.textContent.slice(0,200))

  const root = doc.documentElement
  const gameName     = getText(root,'GameName')     || 'Unknown Game'
  const categoryName = getText(root,'CategoryName') || 'Unknown Category'
  const attemptCount = parseInt(getText(root,'AttemptCount') || '0', 10)

  // â”€â”€ Attempt durations from AttemptHistory (started/ended wall-clock) â”€â”€
  // This is the correct approach: RealTime children only exist on completed
  // runs and would exclude resets. started/ended captures every attempt.
  const attemptHistoryEl = root.querySelector('AttemptHistory')
  const attemptDurationById = new Map()  // id -> seconds
  if (attemptHistoryEl) {
    for (const attempt of attemptHistoryEl.querySelectorAll('Attempt')) {
      const id      = parseInt(attempt.getAttribute('id') ?? '0', 10)
      const started = parseLSSWallClock(attempt.getAttribute('started'))
      const ended   = parseLSSWallClock(attempt.getAttribute('ended'))
      if (id > 0 && started != null && ended != null && ended > started) {
        attemptDurationById.set(id, ended - started)
      }
    }
  }

  const segmentEls = Array.from(root.querySelectorAll('Segments > Segment'))

  // â”€â”€ Per-segment PB from cumulative SplitTimes â”€â”€
  const cumulativePBTimes = segmentEls.map(seg => {
    const splitTimesEl = seg.querySelector('SplitTimes')
    if (!splitTimesEl) return null
    const pbEl = Array.from(splitTimesEl.querySelectorAll('SplitTime'))
      .find(el => el.getAttribute('name') === 'Personal Best')
    if (!pbEl) return null
    const rt = pbEl.querySelector('RealTime')
    return parseLSSTime(rt?.textContent?.trim())
  })
  const perSegmentPBTimes = cumulativePBTimes.map((cumulative, i) => {
    if (cumulative === null) return null
    const prev = cumulativePBTimes.slice(0,i).findLast(t => t !== null) ?? 0
    return cumulative - prev
  })

  // â”€â”€ Count positive-id entries per segment for survival reset rate â”€â”€
  const reachedCounts = segmentEls.map(seg => {
    const hist = seg.querySelector('SegmentHistory')
    if (!hist) return 0
    return Array.from(hist.querySelectorAll('Time'))
      .filter(t => parseInt(t.getAttribute('id') ?? '0', 10) > 0)
      .length
  })

  // â”€â”€ Build segment objects â”€â”€
  // Track IDs that reset on an earlier segment to exclude carry-over times.
  // Store attemptIds in parallel with times so callers can filter by total
  // run duration via attemptDurationById.
  const cumulativeResetIds = new Set()
  let prevReached = attemptCount

  const segments = segmentEls.map((seg, i) => {
    const nameEl = seg.querySelector('n') || seg.querySelector('Name')
    const name = nameEl?.textContent?.trim() || ('Segment ' + (i+1))

    const bestSegEl = seg.querySelector('BestSegmentTime')
    const bestSegRt = bestSegEl?.querySelector('RealTime')
    const bestSegment = parseLSSTime(bestSegRt?.textContent?.trim())

    const historyEl = seg.querySelector('SegmentHistory')
    const timeEls = historyEl ? Array.from(historyEl.querySelectorAll('Time')) : []

    const times = []
    const attemptIds = []  // parallel to times
    let onSegmentResets = 0
    const thisSegResetIds = new Set()

    for (const timeEl of timeEls) {
      const id = parseInt(timeEl.getAttribute('id') ?? '0', 10)
      if (id <= 0) continue
      const rt = timeEl.querySelector('RealTime')
      if (!rt) {
        onSegmentResets++
        thisSegResetIds.add(id)
      } else if (!cumulativeResetIds.has(id)) {
        const t = parseLSSTime(rt.textContent?.trim())
        if (t !== null && t > 0) {
          times.push(t)
          attemptIds.push(id)
        }
      }
    }

    for (const id of thisSegResetIds) cumulativeResetIds.add(id)

    const reachedI = reachedCounts[i]
    const resetRate = prevReached > 0 ? (prevReached - reachedI) / prevReached : 0
    prevReached = reachedI

    return {
      name,
      pbTime:        perSegmentPBTimes[i],
      bestSegment,
      times,
      attemptIds,    // parallel to times; use with attemptDurationById to filter by run duration
      resets:        onSegmentResets,
      resetRate,
      lowConfidence: reachedI < 10,
    }
  })

  // Flat array for convenience (no ID needed for general stats)
  const attemptDurations = Array.from(attemptDurationById.values())

  return { gameName, categoryName, attemptCount, segments, attemptDurations, attemptDurationById }
}
