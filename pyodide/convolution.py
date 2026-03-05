
"""
convolution.py  â€”  SM64 Splits Analysis Engine
Runs inside Pyodide (NumPy + SciPy available).

Public API (called from JS via runPython):
  compute_distribution(segment_times_list, pb_times_list, resolution=0.1)
    -> dict with keys: x, pdf, cdf, pb_time, pb_probability, percentiles

  rank_segments_by_impact(segment_times_list, pb_times_list, resolution=0.1)
    -> list of dicts: {index, name, delta_pb, variance_share, std, mean, n}

  compute_reset_stats(segment_reset_rates)
    -> dict: {completion_probability, per_segment: [{reset_rate, ...}]}
"""

import numpy as np
from scipy.stats import gaussian_kde
from scipy.signal import fftconvolve


# â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def _parse_seconds(times):
    """Accept a list/array of floats (seconds). Returns np.ndarray."""
    arr = np.asarray(times, dtype=float)
    return arr[np.isfinite(arr)]


def _kde_pdf(times, x_grid):
    """
    Fit a Gaussian KDE (Scott's rule) to `times` and evaluate on `x_grid`.
    Returns a non-negative, normalised probability density array.
    Falls back to a uniform distribution if fewer than 2 data points.
    """
    if len(times) < 2:
        # With 0 or 1 point, return a narrow spike at the observed time (or 0)
        pdf = np.zeros_like(x_grid)
        center = times[0] if len(times) == 1 else x_grid[len(x_grid) // 2]
        idx = np.argmin(np.abs(x_grid - center))
        pdf[idx] = 1.0
        return pdf

    kde = gaussian_kde(times, bw_method='scott')
    pdf = kde(x_grid)
    pdf = np.clip(pdf, 0, None)

    # Normalise so integral â‰ˆ 1 (KDE already is, but guard against numerics)
    integral = np.trapz(pdf, x_grid)
    if integral > 0:
        pdf /= integral
    return pdf


# Maximum number of grid points per segment. At resolution=0.1s this caps the
# per-segment grid at 10,000 points (1,000 seconds span), which is more than
# enough for any real SM64 segment. This prevents timer-left-running outliers
# from inflating the grid and crashing the browser even after IQR trimming.
_MAX_GRID_POINTS = 10_000

def _build_common_grid(all_times_list, resolution=0.1, padding_factor=1.3):
    """
    Build a shared time grid that spans the range of all observed times,
    with some right-padding. Capped at _MAX_GRID_POINTS as a safety net.
    """
    flat = np.concatenate([np.asarray(t, dtype=float) for t in all_times_list if len(t) > 0])
    flat = flat[np.isfinite(flat)]
    if len(flat) == 0:
        raise ValueError("No valid time data provided")

    lo = 0.0
    hi = flat.max() * padding_factor
    n_points = int(np.ceil((hi - lo) / resolution)) + 1

    # Hard cap: if outliers survived IQR trimming, clamp the grid rather than crash.
    if n_points > _MAX_GRID_POINTS:
        n_points = _MAX_GRID_POINTS

    return np.linspace(lo, hi, n_points)


def _fft_convolve_pdfs(pdfs):
    """
    Convolve a list of per-segment PDF arrays using FFT.
    Each array should be evaluated on the same x_grid.
    Returns the joint PDF of the sum (total run time).
    """
    result = pdfs[0].copy()
    for pdf in pdfs[1:]:
        result = fftconvolve(result, pdf, mode='full')
        result = np.clip(result, 0, None)

    # Normalise
    total = result.sum()
    if total > 0:
        result /= total
    return result


# â”€â”€ Public API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def compute_distribution(segment_times_list, pb_times_list, resolution=0.1):
    """
    Parameters
    ----------
    segment_times_list : list of list of float
        Each inner list is the set of recorded times (seconds) for one segment.
    pb_times_list : list of float
        Per-segment PB times (seconds), same length as segment_times_list.
    resolution : float
        Grid resolution in seconds.

    Returns
    -------
    dict with:
      x                : list[float]  â€” time axis for the total run (seconds)
      pdf              : list[float]  â€” KDE-smoothed probability density
      cdf              : list[float]  â€” cumulative distribution
      pb_time          : float        â€” current PB (sum of pb_times_list)
      pb_probability   : float        â€” P(run < pb_time), 0â€“1
      percentiles      : dict         â€” {p10, p25, p50, p75, p90} in seconds
      segment_stats    : list[dict]   â€” per-segment {mean, std, n} for UI table
    """
    # Validate and clean input
    cleaned = [_parse_seconds(t) for t in segment_times_list]
    pb_times = np.asarray(pb_times_list, dtype=float)

    if len(cleaned) == 0:
        raise ValueError("segment_times_list is empty")

    # Build shared per-segment x grid
    seg_x = _build_common_grid(cleaned, resolution=resolution)

    # Fit KDE for each segment
    pdfs = [_kde_pdf(times, seg_x) for times in cleaned]

    # Convolve to get total-run PDF
    # The total run x-axis is longer: it spans n_segments Ã— seg_x range
    joint_pdf = _fft_convolve_pdfs(pdfs)

    # Build the x-axis for the joint distribution.
    # After convolving N arrays each of length M, result has length (N-1)*(M-1)+1
    n_seg = len(pdfs)
    m = len(seg_x)
    joint_len = (n_seg - 1) * (m - 1) + m
    # Trim to actual length of joint_pdf
    joint_len = min(joint_len, len(joint_pdf))
    joint_pdf = joint_pdf[:joint_len]

    dx = seg_x[1] - seg_x[0]
    joint_x = np.arange(joint_len) * dx

    # Re-normalise after trimming
    total = np.trapz(joint_pdf, joint_x)
    if total > 0:
        joint_pdf /= total

    # CDF
    joint_cdf = np.cumsum(joint_pdf) * dx
    joint_cdf = np.clip(joint_cdf, 0, 1)

    # PB probability
    pb_time = float(pb_times.sum())
    pb_idx = np.searchsorted(joint_x, pb_time, side='right')
    pb_probability = float(joint_cdf[min(pb_idx, len(joint_cdf) - 1)])

    # Percentiles (find x where CDF crosses p)
    def _percentile(p):
        idx = np.searchsorted(joint_cdf, p / 100.0)
        idx = min(idx, len(joint_x) - 1)
        return float(joint_x[idx])

    percentiles = {
        'p10': _percentile(10),
        'p25': _percentile(25),
        'p50': _percentile(50),
        'p75': _percentile(75),
        'p90': _percentile(90),
    }

    # Per-segment stats for the UI table
    segment_stats = []
    for times in cleaned:
        segment_stats.append({
            'n':    int(len(times)),
            'mean': float(times.mean()) if len(times) > 0 else None,
            'std':  float(times.std())  if len(times) > 1 else None,
        })

    return {
        'x':               joint_x.tolist(),
        'pdf':             joint_pdf.tolist(),
        'cdf':             joint_cdf.tolist(),
        'pb_time':         pb_time,
        'pb_probability':  pb_probability,
        'percentiles':     percentiles,
        'segment_stats':   segment_stats,
    }


def rank_segments_by_impact(segment_times_list, pb_times_list, resolution=0.1):
    """
    For each segment, compute the counterfactual PB probability if that
    segment were replaced by its PB time (zero variance, best-case).

    Returns a list of dicts sorted by delta_pb descending:
      index, delta_pb, variance_share, std, mean, n
    """
    cleaned = [_parse_seconds(t) for t in segment_times_list]
    pb_times = np.asarray(pb_times_list, dtype=float)

    # Baseline
    baseline = compute_distribution(cleaned, pb_times, resolution)
    baseline_pb_prob = baseline['pb_probability']

    stds = np.array([
        float(t.std()) if len(t) > 1 else 0.0
        for t in cleaned
    ])
    total_std = stds.sum()

    results = []
    for i in range(len(cleaned)):
        # Replace segment i with its PB time (point mass)
        modified = list(cleaned)
        modified[i] = np.array([pb_times[i]])

        try:
            cf = compute_distribution(modified, pb_times, resolution)
            delta_pb = cf['pb_probability'] - baseline_pb_prob
        except Exception:
            delta_pb = 0.0

        results.append({
            'index':          i,
            'delta_pb':       float(delta_pb),
            'variance_share': float(stds[i] / total_std) if total_std > 0 else 0.0,
            'std':            float(stds[i]),
            'mean':           float(cleaned[i].mean()) if len(cleaned[i]) > 0 else None,
            'n':              int(len(cleaned[i])),
        })

    results.sort(key=lambda r: r['delta_pb'], reverse=True)
    return results


def compute_reset_stats(segment_reset_rates):
    """
    Parameters
    ----------
    segment_reset_rates : list of float
        Pre-computed survival-based reset rate per segment (0-1).
        Computed in lssParser as (prev_reached - reached_i) / prev_reached.

    Returns
    -------
    dict with completion_probability and per_segment list of {reset_rate}
    """
    per_segment = []
    completion_prob = 1.0
    for rate in segment_reset_rates:
        r = float(max(0.0, min(1.0, rate)))
        completion_prob *= (1.0 - r)
        per_segment.append({'reset_rate': r})
    return {
        'completion_probability': float(completion_prob),
        'per_segment':            per_segment,
    }


print("âœ“ SM64 analysis engine loaded")

