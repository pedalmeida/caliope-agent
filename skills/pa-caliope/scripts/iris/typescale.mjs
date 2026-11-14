#!/usr/bin/env node
// typescale.mjs: escala tipográfica modular, com clamp() fluido entre dois viewports e line-heights sugeridos.
import { cli, fail, table } from './lib/cli.mjs';

const RATIOS = {
  'minor-second': 1.067, 'major-second': 1.125, 'minor-third': 1.2, 'major-third': 1.25,
  'perfect-fourth': 1.333, 'augmented-fourth': 1.414, 'perfect-fifth': 1.5, golden: 1.618,
};
const DEFAULT_NAMES = { '-3': '3xs', '-2': 'xs', '-1': 'sm', 0: 'base', 1: 'lg', 2: 'xl', 3: '2xl', 4: '3xl', 5: '4xl', 6: '5xl', 7: '6xl', 8: '7xl', 9: '8xl' };

const HELP = `
typescale.mjs: escala tipográfica modular (base x razão^passo) em rem, com clamp() fluido.

Uso:
  node tools/typescale.mjs [opções]

Opções:
  --base <px>          tamanho base no viewport mínimo (por defeito 16)
  --ratio <r>          razão no viewport mínimo: número ou nome (por defeito 1.2)
                       nomes: ${Object.entries(RATIOS).map(([k, v]) => `${k}=${v}`).join(', ')}
  --max-base <px>      tamanho base no viewport máximo (por defeito = --base; se diferente, a escala é fluida)
  --max-ratio <r>      razão no viewport máximo (por defeito = --ratio)
  --min-vw <px>        viewport mínimo (por defeito 360)
  --max-vw <px>        viewport máximo (por defeito 1280)
  --up <n>             passos acima da base (por defeito 5)
  --down <n>           passos abaixo da base (por defeito 2)
  --root <px>          tamanho do rem (por defeito 16)
  --lh-grid <px>       arredonda a altura de linha a esta grelha (ex. 4); por defeito sem grelha
  --prefix <p>         prefixo das custom properties (por defeito "font-size"; line-height usa "line-height")
  --format <f>         table (por defeito) | css | json
  --json               igual a --format json
  -h, --help           esta ajuda

Line-height sugerido (heurística, não norma): 1 + 8/tamanho_px, limitado a [1.1, 1.6].
Dá ~1.5 a 16px, ~1.33 a 24px, ~1.17 a 48px. Ajusta à fonte (altura-x, comprimento de linha).
clamp() usa rem + vw, para que o zoom do navegador continue a escalar o texto.
Aviso quando max/min de um passo > 2.5: verifica zoom a 200% (WCAG 1.4.4).

Exemplos:
  node tools/typescale.mjs --base 16 --ratio major-third
  node tools/typescale.mjs --base 16 --ratio 1.2 --max-base 18 --max-ratio 1.333 --format css
  node tools/typescale.mjs --base 15 --ratio 1.25 --up 6 --down 1 --lh-grid 4 --json
`;

const { values: o } = cli({
  base: { type: 'string' }, ratio: { type: 'string' }, 'max-base': { type: 'string' }, 'max-ratio': { type: 'string' },
  'min-vw': { type: 'string' }, 'max-vw': { type: 'string' }, up: { type: 'string' }, down: { type: 'string' },
  root: { type: 'string' }, 'lh-grid': { type: 'string' }, prefix: { type: 'string' }, format: { type: 'string' },
}, HELP);

const numOpt = (k, d, lo = 0) => {
  if (o[k] === undefined) return d;
  const v = Number(o[k]);
  if (!Number.isFinite(v) || v < lo) fail(`--${k} inválido: ${o[k]}`);
  return v;
};
const ratioOpt = (k, d) => {
  if (o[k] === undefined) return d;
  if (RATIOS[o[k]]) return RATIOS[o[k]];
  const v = Number(o[k]);
  if (!Number.isFinite(v) || v <= 1) fail(`--${k} inválido: ${o[k]} (número > 1 ou nome)`);
  return v;
};
const base = numOpt('base', 16, 1);
const ratio = ratioOpt('ratio', 1.2);
const maxBase = numOpt('max-base', base, 1);
const maxRatio = ratioOpt('max-ratio', ratio);
const minVw = numOpt('min-vw', 360, 1);
const maxVw = numOpt('max-vw', 1280, 1);
const up = numOpt('up', 5);
const down = numOpt('down', 2);
const root = numOpt('root', 16, 1);
const grid = numOpt('lh-grid', 0);
const prefix = o.prefix ?? 'font-size';
const format = o.json ? 'json' : o.format || 'table';
if (!['table', 'css', 'json'].includes(format)) fail(`--format inválido: ${format}`);
if (maxVw <= minVw) fail('--max-vw tem de ser maior que --min-vw');

const r = (x, p = 4) => Math.round(x * 10 ** p) / 10 ** p;
const fluid = maxBase !== base || maxRatio !== ratio;

function lineHeight(px) {
  let lh = Math.min(1.6, Math.max(1.1, 1 + 8 / px));
  if (grid > 0) lh = Math.max(grid, Math.round((px * lh) / grid) * grid) / px;
  return r(lh, 3);
}

const steps = [];
for (let i = -down; i <= up; i++) {
  const minPx = base * ratio ** i;
  const maxPx = maxBase * maxRatio ** i;
  const slope = (maxPx - minPx) / (maxVw - minVw);
  const intercept = minPx - slope * minVw;
  const lo = Math.min(minPx, maxPx), hi = Math.max(minPx, maxPx);
  const value = Math.abs(maxPx - minPx) < 0.01
    ? `${r(minPx / root)}rem`
    : `clamp(${r(lo / root)}rem, ${r(intercept / root)}rem ${slope < 0 ? '-' : '+'} ${r(Math.abs(slope) * 100)}vw, ${r(hi / root)}rem)`;
  const avisos = [];
  if (hi / lo > 2.5) avisos.push('max/min > 2.5: verificar zoom 200% (WCAG 1.4.4)');
  if (lo < 12) avisos.push('< 12px: só para texto secundário curto');
  steps.push({
    passo: i, nome: DEFAULT_NAMES[i] ?? `step-${i}`,
    minPx: r(minPx, 2), maxPx: r(maxPx, 2), minRem: r(minPx / root), maxRem: r(maxPx / root),
    css: value, lineHeight: lineHeight(minPx), lineHeightMax: lineHeight(maxPx), avisos,
  });
}

if (format === 'json') {
  console.log(JSON.stringify({ config: { base, ratio, maxBase, maxRatio, minVw, maxVw, root, fluid, lhGrid: grid || null }, passos: steps }, null, 2));
} else if (format === 'css') {
  const lines = [];
  lines.push(`/* typescale.mjs: base ${base}px x ${ratio}${fluid ? ` -> ${maxBase}px x ${maxRatio}, fluido entre ${minVw}px e ${maxVw}px` : ''} */`);
  lines.push(':root {');
  for (const s of steps) lines.push(`  --${prefix}-${s.nome}: ${s.css};${s.avisos.length ? ` /* ${s.avisos.join('; ')} */` : ''}`);
  for (const s of steps) lines.push(`  --line-height-${s.nome}: ${s.lineHeight};`);
  lines.push('}');
  console.log(lines.join('\n'));
} else {
  console.log(`Base ${base}px, razão ${ratio}${fluid ? `  ->  base ${maxBase}px, razão ${maxRatio} (fluido ${minVw}-${maxVw}px)` : ''}; 1rem = ${root}px\n`);
  const rows = steps.map((s) => [
    s.passo, s.nome, `${s.minPx}px`, `${s.maxPx}px`, s.css, fluid && s.lineHeight !== s.lineHeightMax ? `${s.lineHeight} / ${s.lineHeightMax}` : s.lineHeight, s.avisos.join('; '),
  ]);
  const head = ['passo', 'nome', 'mín', 'máx', 'CSS', 'line-height', 'avisos'];
  if (!fluid) { rows.forEach((row) => row.splice(3, 1)); head.splice(3, 1); head[2] = 'tamanho'; }
  console.log(table(rows, head));
}
