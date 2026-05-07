import { formatPercent } from './formatting';

/**
 * Confidence thresholds aligned to the React prototype (shared.jsx → confidenceTone)
 * and PRD §3.1.3: confidence < 0.80 forces ESCALATED.
 *
 *  >= CONFIDENCE_OK_THRESHOLD     → 'ok'   (auto-approval territory)
 *  >= CONFIDENCE_WARN_THRESHOLD   → 'warn' (manual review zone)
 *   < CONFIDENCE_WARN_THRESHOLD   → 'err'  (escalation)
 */
const CONFIDENCE_OK_THRESHOLD = 0.8;
const CONFIDENCE_WARN_THRESHOLD = 0.65;

export type ConfidenceTone = 'ok' | 'warn' | 'err';

/**
 * Maps a confidence value in [0..1] to a tone bucket.
 */
export function confidenceTone(value: number): ConfidenceTone {
  if (value >= CONFIDENCE_OK_THRESHOLD) {
    return 'ok';
  }
  if (value >= CONFIDENCE_WARN_THRESHOLD) {
    return 'warn';
  }
  return 'err';
}

/**
 * Shortcut: confidence value in [0..1] formatted as integer percent ("94%").
 */
export function confidencePercent(value: number): string {
  return formatPercent(value, 0);
}

export { formatPercent };
