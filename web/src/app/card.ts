import { CEILING, FLOOR } from "../lib/sky";

// The result as a 1080 by 1350 picture, drawn in the browser; nothing is uploaded.

export interface Thread {
  /** Where on the shared grid of months the thread begins. */
  at: number;
  /** How far trade ran from what this baseline expects, at each of those months. */
  vals: number[];
  /** Which of the three recipes it is, coloured as the page colours it. */
  hue: 0 | 1 | 2;
  pass: boolean;
  me: boolean;
}

export interface CardContent {
  lead: string;
  big: string;
  unit: string;
  lines: string[];
  /** How many months the grid holds, so a thread knows where it starts. */
  months: number;
  sky: Thread[];
}

const INK = "#0b0d24";
const TEXT = "#eeecff";
const SOFT = "#c2bdec";
const MUTED = "#8e89c0";
const RULE = "#39356a";
// the three recipes, as the sky draws them: bright if the baseline passed its
// placebo test, dim if it did not
const HUES: [lit: string, dim: string][] = [
  ["#7ec8f2", "#4f7f9e"],
  ["#c9c2ff", "#6f6aa8"],
  ["#ff9ec2", "#a56584"],
];
const PASS = "#b9b1ff";

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

  // every baseline for this trade as a thread. The page holds one scale across
  // all three trades so it can be switched in place; a card is one picture, so
  // it fills itself with the trade it shows.
  const skyH = 360;
  const skyTop = 1350 - P - 116 - skyH;
  const all = c.sky.flatMap((t) => t.vals);
  const pad = 0.06 * (Math.max(...all) - Math.min(...all));
  const lo = Math.max(FLOOR, Math.min(...all) - pad);
  const hi = Math.min(CEILING, Math.max(...all) + pad);
  const gx = (k: number) => P + (k / (c.months - 1)) * inner;
  const gy = (v: number) => skyTop + skyH - ((v - lo) / (hi - lo)) * skyH;
  const line = (t: Thread) => {
    ctx.beginPath();
    t.vals.forEach((v, k) => {
      const px = gx(t.at + k);
      const py = gy(v);
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  };
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const t of c.sky) {
    if (t.me) continue;
    ctx.strokeStyle = HUES[t.hue]![t.pass ? 0 : 1];
    ctx.lineWidth = t.pass ? 3 : 1.4;
    line(t);
  }
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(P, gy(0));
  ctx.lineTo(P + inner, gy(0));
  ctx.stroke();
  const me = c.sky.find((t) => t.me);
  if (me) {
    ctx.strokeStyle = TEXT;
    ctx.lineWidth = 7;
    line(me);
    ctx.beginPath();
    ctx.arc(gx(c.months - 1), gy(me.vals[me.vals.length - 1]!), 11, 0, 2 * Math.PI);
    ctx.fillStyle = TEXT;
    ctx.fill();
  }
  // the horizon's label sits over the threads, so it carries a halo
  ctx.font = '400 26px "IBM Plex Sans", sans-serif';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.strokeText("what happened", P, gy(0) - 14);
  ctx.fillStyle = SOFT;
  ctx.fillText("what happened", P, gy(0) - 14);
  ctx.fillStyle = MUTED;
  ctx.fillText("every baseline for this trade; bright: passed its test; white: this one", P, skyTop + skyH + 42);
  ctx.font = '400 32px "IBM Plex Mono", monospace';
  ctx.fillText("finntech3.github.io/brexit-baseline", P, 1350 - P);
}
