// The result as a 1080 by 1350 picture, drawn in the browser; nothing is uploaded.

export interface CardContent {
  lead: string;
  big: string;
  unit: string;
  lines: string[];
  dots: { v: number; pass: boolean; me: boolean }[]; // every baseline for this trade
}

const INK = "#161614";
const TEXT = "#f3f2ee";
const SOFT = "#c3c2b7";
const MUTED = "#9a988f";
const RULE = "#3d3d3a";
const PASS = "#9c93f0";

const FONTS = [
  '700 260px "IBM Plex Sans Condensed"',
  '700 44px "IBM Plex Sans Condensed"',
  '600 44px "IBM Plex Sans"',
  '400 40px "IBM Plex Sans"',
  '400 32px "IBM Plex Mono"',
];

export async function fontsReady(): Promise<void> {
  try {
    await Promise.all(FONTS.map((f) => document.fonts.load(f)));
  } catch {
    // The card still draws in the fallback fonts.
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export function drawCard(canvas: HTMLCanvasElement, c: CardContent): void {
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const P = 84;
  const inner = 1080 - 2 * P;
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, 1080, 1350);

  // the mark: a line and the baseline it is measured against
  ctx.strokeStyle = TEXT;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(P, P + 34);
  ctx.lineTo(P + 26, P + 14);
  ctx.lineTo(P + 50, P + 24);
  ctx.stroke();
  ctx.strokeStyle = PASS;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(P, P + 30);
  ctx.lineTo(P + 56, P + 6);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = TEXT;
  ctx.font = '700 44px "IBM Plex Sans Condensed", sans-serif';
  ctx.fillText("Brexit baseline", P + 76, P + 40);

  ctx.fillStyle = SOFT;
  ctx.font = '400 38px "IBM Plex Sans", sans-serif';
  let y = P + 140;
  for (const line of wrap(ctx, c.lead, inner)) {
    ctx.fillText(line, P, y);
    y += 50;
  }

  let size = 220;
  ctx.fillStyle = TEXT;
  do {
    ctx.font = `700 ${size}px "IBM Plex Sans Condensed", sans-serif`;
    if (ctx.measureText(c.big).width <= inner) break;
    size -= 10;
  } while (size > 110);
  y += size * 0.82;
  ctx.fillText(c.big, P - 6, y);
  ctx.font = '600 42px "IBM Plex Sans", sans-serif';
  y += 66;
  ctx.fillText(c.unit, P, y);
  y += 74;
  ctx.font = '400 36px "IBM Plex Sans", sans-serif';
  for (const text of c.lines) {
    for (const line of wrap(ctx, text, inner)) {
      ctx.fillText(line, P, y);
      y += 48;
    }
    y += 12;
  }

  // every baseline for this trade, one dot each, stacked so none overlap
  const mid = 1350 - P - 240;
  const lo = Math.min(-0.3, ...c.dots.map((d) => d.v));
  const hi = Math.max(0.3, ...c.dots.map((d) => d.v));
  const x = (v: number) => P + ((v - lo) / (hi - lo)) * inner;
  const r = 7;
  const step = 2 * r + 2;
  const taken = new Map<number, number[]>();
  const placed = [...c.dots]
    .sort((a, b) => a.v - b.v)
    .map((d) => {
      const cx = x(d.v);
      let k = 0;
      while (taken.get(k)?.some((t) => Math.abs(t - cx) < step)) k = k > 0 ? -k : -k + 1;
      taken.set(k, [...(taken.get(k) ?? []), cx]);
      return { ...d, cx, cy: mid + k * step };
    });
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x(0), mid - 100);
  ctx.lineTo(x(0), mid + 100);
  ctx.stroke();
  for (const d of placed.filter((p) => !p.me)) {
    ctx.beginPath();
    ctx.arc(d.cx, d.cy, d.pass ? r : r - 1.5, 0, 2 * Math.PI);
    if (d.pass) {
      ctx.fillStyle = PASS;
      ctx.fill();
    } else {
      ctx.strokeStyle = MUTED;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }
  const me = placed.find((p) => p.me);
  if (me) {
    ctx.beginPath();
    ctx.arc(me.cx, me.cy, r + 7, 0, 2 * Math.PI);
    ctx.fillStyle = TEXT;
    ctx.fill();
  }
  ctx.fillStyle = MUTED;
  ctx.font = '400 26px "IBM Plex Sans", sans-serif';
  ctx.fillText("lower", P, mid + 136);
  ctx.textAlign = "right";
  ctx.fillText("higher", 1080 - P, mid + 136);
  ctx.textAlign = "left";
  ctx.fillText("every baseline; filled: passed its test; white: this one", P, mid + 172);
  ctx.font = '400 32px "IBM Plex Mono", monospace';
  ctx.fillText("finntech3.github.io/brexit-baseline", P, 1350 - P);
}
