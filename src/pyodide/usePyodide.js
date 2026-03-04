/**
 * usePyodide.js
 *
 * Manages the Pyodide runtime lifecycle:
 *   - Loads Pyodide from CDN on first use
 *   - Installs NumPy + SciPy (micropip, from Pyodide's bundled packages)
 *   - Caches the loaded runtime in a module-level singleton so the
 *     expensive initialisation only happens once per page session
 *   - Exposes `runPython(code, globals)` for executing Python snippets
 *     and returning JS-friendly results
 *
 * Usage:
 *   const { ready, loading, error, runPython } = usePyodide()
 */

import { useState, useEffect, useCallback, useRef } from 'react'

// ── Module-level singleton ──────────────────────────────────────────────────
// Keeps the Pyodide instance alive across React re-renders and hot-reloads.
let pyodideInstance = null
let pyodideLoadPromise = null

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js'

async function initialisePyodide(onProgress) {
  // Already loaded – return immediately
  if (pyodideInstance) return pyodideInstance

  // Already loading – wait for the in-flight promise
  if (pyodideLoadPromise) return pyodideLoadPromise

  pyodideLoadPromise = (async () => {
    onProgress?.('Loading Pyodide runtime…')

    // Dynamically inject the Pyodide loader script if not already present
    if (!window.loadPyodide) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = PYODIDE_CDN
        script.onload = resolve
        script.onerror = () => reject(new Error(`Failed to load Pyodide from ${PYODIDE_CDN}`))
        document.head.appendChild(script)
      })
    }

    onProgress?.('Initialising Python environment…')
    const pyodide = await window.loadPyodide()

    onProgress?.('Installing NumPy & SciPy…')
    await pyodide.loadPackage(['numpy', 'scipy'])

    // Pre-load our convolution module so it's ready to call
    onProgress?.('Loading analysis modules…')
    const convolutionCode = await fetch('/src/pyodide/convolution.py').then(r => r.text())
    await pyodide.runPythonAsync(convolutionCode)

    pyodideInstance = pyodide
    onProgress?.('Ready')
    return pyodide
  })()

  return pyodideLoadPromise
}

// ── Hook ───────────────────────────────────────────────────────────────────
export function usePyodide() {
  const [state, setState] = useState({
    ready: false,
    loading: false,
    progress: '',
    error: null,
  })

  // Keep a stable ref to pyodide so runPython doesn't need it in deps
  const pyRef = useRef(null)

  useEffect(() => {
    // If already loaded, mark ready immediately
    if (pyodideInstance) {
      pyRef.current = pyodideInstance
      setState({ ready: true, loading: false, progress: 'Ready', error: null })
      return
    }

    setState(s => ({ ...s, loading: true, error: null }))

    initialisePyodide((msg) => {
      setState(s => ({ ...s, progress: msg }))
    })
      .then((py) => {
        pyRef.current = py
        setState({ ready: true, loading: false, progress: 'Ready', error: null })
      })
      .catch((err) => {
        pyodideLoadPromise = null // allow retry
        setState({ ready: false, loading: false, progress: '', error: err.message })
      })
  }, [])

  /**
   * runPython(code, globals?)
   *
   * Executes `code` in the Pyodide runtime.
   * `globals` is an optional plain JS object whose keys are injected
   * as Python variables before execution.
   *
   * Returns the value of the last expression, converted to JS.
   * Throws if Pyodide is not ready or execution fails.
   */
  const runPython = useCallback(async (code, globals = {}) => {
    if (!pyRef.current) throw new Error('Pyodide is not ready yet')

    const py = pyRef.current

    // Inject JS variables into the Python global namespace
    for (const [key, value] of Object.entries(globals)) {
      py.globals.set(key, value)
    }

    const result = await py.runPythonAsync(code)

    // Convert Pyodide proxy objects to plain JS values where possible
    if (result && typeof result.toJs === 'function') {
      return result.toJs({ dict_converter: Object.fromEntries })
    }
    return result
  }, [])

  return { ...state, runPython }
}
