import { useState, useRef, useCallback } from 'react'
import { parseLSS } from '../../utils/lssParser'
import './FileUpload.css'

export function FileUpload({ onParsed }) {
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)

  const processFile = useCallback(async (file) => {
    if (!file) return
    if (!file.name.endsWith('.lss')) {
      setError('Please upload a LiveSplit .lss file.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const text = await file.text()
      const parsed = parseLSS(text)
      if (parsed.segments.length === 0) throw new Error('No segments found in this file.')
      onParsed(parsed, file.name)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [onParsed])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    processFile(e.dataTransfer.files[0])
  }, [processFile])

  return (
    <div className="upload-wrap">
      <div
        className={'upload-zone' + (dragging ? ' is-dragging' : '') + (loading ? ' is-loading' : '')}
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onClick={() => !loading && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept=".lss"
          onChange={e => processFile(e.target.files[0])} style={{ display: 'none' }} />

        <div className="upload-zone__star">{loading ? '...' : '*'}</div>

        <div className="upload-zone__text">
          {loading ? (
            <span>Parsing splits file...</span>
          ) : dragging ? (
            <span className="upload-zone__drop-hint">Drop to analyse</span>
          ) : (
            <>
              <span className="upload-zone__primary">Drop your .lss file here</span>
              <span className="upload-zone__secondary">or click to browse</span>
            </>
          )}
        </div>

        <div className="upload-zone__meta">
          LiveSplit split history file &middot; any category &middot; any game
        </div>

        <span className="upload-zone__corner upload-zone__corner--tl" />
        <span className="upload-zone__corner upload-zone__corner--tr" />
        <span className="upload-zone__corner upload-zone__corner--bl" />
        <span className="upload-zone__corner upload-zone__corner--br" />
      </div>

      {error && (
        <div className="upload-error">
          <span className="upload-error__icon">!</span>
          {error}
        </div>
      )}
    </div>
  )
}
