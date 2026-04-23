/**
 * Hand-rolled, dependency-free SVG generators for inline embedding in
 * the HTML report. All output is deterministic given the same inputs:
 * no timestamps, random ids, or floating-point drift greater than fixed
 * precision. Suitable for snapshot testing.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Round to 2 decimal places, returning a clean string ("1" not "1.00"). */
function r(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const s = n.toFixed(2);
  // Strip trailing zeros / trailing dot to make output stable & compact.
  return s.replace(/\.?0+$/, '');
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ---------------------------------------------------------------------------
// Sparkline
// ---------------------------------------------------------------------------

export interface SparklineOptions {
  width?: number;
  height?: number;
  /** Stroke colour for the line. Background is transparent. */
  stroke?: string;
  /** Fill under the line (rgba ok). */
  fill?: string;
  /** Optional padding inside the viewBox. */
  pad?: number;
}

/**
 * Render a series of numbers as a single-line sparkline SVG. Empty or
 * single-value series degrade gracefully to a flat line.
 */
export function sparkline(values: number[], opts: SparklineOptions = {}): string {
  const w = opts.width ?? 240;
  const h = opts.height ?? 40;
  const pad = opts.pad ?? 2;
  const stroke = opts.stroke ?? 'currentColor';
  const fill = opts.fill ?? 'none';

  if (values.length === 0) {
    return `<svg xmlns="${SVG_NS}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"></svg>`;
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const stepX = values.length > 1 ? innerW / (values.length - 1) : 0;

  const points = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + innerH - ((v - min) / range) * innerH;
    return `${r(x)},${r(y)}`;
  });

  const polyline = `<polyline fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" points="${points.join(' ')}"/>`;

  let area = '';
  if (fill !== 'none') {
    const first = `${r(pad)},${r(h - pad)}`;
    const last = `${r(pad + (values.length - 1) * stepX)},${r(h - pad)}`;
    const polygonPts = [first, ...points, last].join(' ');
    area = `<polygon fill="${fill}" stroke="none" points="${polygonPts}"/>`;
  }

  return `<svg xmlns="${SVG_NS}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${area}${polyline}</svg>`;
}

// ---------------------------------------------------------------------------
// Bar chart (horizontal)
// ---------------------------------------------------------------------------

export interface BarDatum {
  label: string;
  value: number;
}

export interface BarChartOptions {
  width?: number;
  /** Per-bar height in px. Total height = bars.length * barHeight + pad*2. */
  barHeight?: number;
  pad?: number;
  /** Width reserved on the left for labels. */
  labelWidth?: number;
  /** Width reserved on the right for value text. */
  valueWidth?: number;
  fill?: string;
}

export function barChart(data: BarDatum[], opts: BarChartOptions = {}): string {
  const w = opts.width ?? 480;
  const bh = opts.barHeight ?? 20;
  const pad = opts.pad ?? 6;
  const labelW = opts.labelWidth ?? 140;
  const valueW = opts.valueWidth ?? 70;
  const fill = opts.fill ?? 'currentColor';

  const h = data.length * bh + pad * 2;
  const trackX = labelW + pad;
  const trackW = w - trackX - valueW - pad;

  if (data.length === 0) {
    return `<svg xmlns="${SVG_NS}" viewBox="0 0 ${w} ${pad * 2}" width="${w}" height="${pad * 2}"></svg>`;
  }

  const max = Math.max(...data.map((d) => d.value), 0) || 1;
  const rows = data
    .map((d, i) => {
      const y = pad + i * bh;
      const barLen = (Math.max(0, d.value) / max) * trackW;
      const labelY = y + bh / 2 + 4;
      return [
        `<text x="${r(labelW)}" y="${r(labelY)}" text-anchor="end" font-size="11" font-family="ui-monospace,monospace">${escapeXml(d.label)}</text>`,
        `<rect x="${r(trackX)}" y="${r(y + 3)}" width="${r(barLen)}" height="${r(bh - 6)}" fill="${fill}" opacity="0.8"/>`,
        `<text x="${r(trackX + barLen + 4)}" y="${r(labelY)}" font-size="11" font-family="ui-monospace,monospace">${escapeXml(formatCount(d.value))}</text>`,
      ].join('');
    })
    .join('');

  return `<svg xmlns="${SVG_NS}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${rows}</svg>`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2).replace(/\.?0+$/, '') + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(2).replace(/\.?0+$/, '') + 'K';
  return String(Math.round(n));
}

// ---------------------------------------------------------------------------
// Pie chart
// ---------------------------------------------------------------------------

export interface PieSlice {
  label: string;
  value: number;
}

export interface PieChartOptions {
  size?: number;
  /** Optional palette; cycled. */
  palette?: string[];
  /** Width reserved for the legend column on the right. */
  legendWidth?: number;
}

const DEFAULT_PALETTE = [
  '#5b8def', '#f0a868', '#7ac96b', '#d96bb1', '#a07bd6',
  '#6bbfc9', '#e3c548', '#888888',
];

/**
 * Render a pie chart with an inline legend. Slices with zero or negative
 * value are dropped. A single-slice pie renders as a full circle to avoid
 * the SVG-arc degenerate case.
 */
export function pieChart(slices: PieSlice[], opts: PieChartOptions = {}): string {
  const size = opts.size ?? 180;
  const legendW = opts.legendWidth ?? 200;
  const palette = opts.palette ?? DEFAULT_PALETTE;
  const w = size + legendW;
  const h = size;

  const positive = slices.filter((s) => s.value > 0);
  const total = positive.reduce((s, x) => s + x.value, 0);

  if (total === 0 || positive.length === 0) {
    return `<svg xmlns="${SVG_NS}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"></svg>`;
  }

  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 2;

  let slicesSvg = '';
  if (positive.length === 1) {
    const colour = palette[0]!;
    slicesSvg = `<circle cx="${r(cx)}" cy="${r(cy)}" r="${r(radius)}" fill="${colour}"/>`;
  } else {
    let acc = 0;
    for (let i = 0; i < positive.length; i++) {
      const s = positive[i]!;
      const start = acc / total;
      acc += s.value;
      const end = acc / total;
      const a0 = start * Math.PI * 2 - Math.PI / 2;
      const a1 = end * Math.PI * 2 - Math.PI / 2;
      const x0 = cx + Math.cos(a0) * radius;
      const y0 = cy + Math.sin(a0) * radius;
      const x1 = cx + Math.cos(a1) * radius;
      const y1 = cy + Math.sin(a1) * radius;
      const large = end - start > 0.5 ? 1 : 0;
      const colour = palette[i % palette.length]!;
      const d = [
        `M ${r(cx)} ${r(cy)}`,
        `L ${r(x0)} ${r(y0)}`,
        `A ${r(radius)} ${r(radius)} 0 ${large} 1 ${r(x1)} ${r(y1)}`,
        'Z',
      ].join(' ');
      slicesSvg += `<path d="${d}" fill="${colour}"/>`;
    }
  }

  const legendItems = positive
    .map((s, i) => {
      const colour = palette[i % palette.length]!;
      const y = 14 + i * 16;
      const pct = ((s.value / total) * 100).toFixed(1);
      return [
        `<rect x="${r(size + 8)}" y="${r(y - 9)}" width="10" height="10" fill="${colour}"/>`,
        `<text x="${r(size + 24)}" y="${r(y)}" font-size="11" font-family="ui-monospace,monospace">${escapeXml(s.label)} (${pct}%)</text>`,
      ].join('');
    })
    .join('');

  return `<svg xmlns="${SVG_NS}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${slicesSvg}${legendItems}</svg>`;
}
