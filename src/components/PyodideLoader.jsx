import { usePyodide } from '../pyodide/usePyodide'
import './PyodideLoader.css'

const STEPS = [
  'Loading Pyodide runtime...',
  'Initialising Python environment...',
  'Installing NumPy & SciPy...',
  'Loading analysis modules...',
  'Ready',
]

export function PyodideLoader({ children }) {
  const { ready, loading, progress, error } = usePyodide()
  if (ready) return children

  const stepIndex = STEPS.indexOf(progress)
  const pct = stepIndex < 0 ? 5 : Math.round(((stepIndex + 1) / STEPS.length) * 100)

  return (
    <div className="py-loader">
      <div className="py-loader__panel">
        <div className="py-loader__star" aria-hidden>{error ? 'X' : '*'}</div>
        <h1 className="py-loader__title">SM64 Splits</h1>
        <p className="py-loader__subtitle">Analysis Engine</p>
        {error ? (
          <div className="py-loader__error">
            <p className="py-loader__error-msg">Failed to load Python runtime</p>
            <p className="py-loader__error-detail">{error}</p>
            <p className="py-loader__error-hint">
              Requires a modern browser and an internet connection to download
              Pyodide (~10 MB, cached after first load).
            </p>
            <button className="py-loader__retry" onClick={() => window.location.reload()}>
              Retry
            </button>
          </div>
        ) : (
          <div className="py-loader__progress-wrap">
            <div className="py-loader__bar-track">
              <div className="py-loader__bar-fill" style={{ width: pct + '%' }} />
            </div>
            <p className="py-loader__status">{progress || 'Starting...'}</p>
            <p className="py-loader__hint">
              Pyodide runs NumPy &amp; SciPy in your browser.<br />
              First load ~10 MB, cached thereafter.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
