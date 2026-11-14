#!/usr/bin/env node
// palette.mjs: rampa tonal OKLCH a partir de uma cor semente, com contraste de cada passo contra branco e preto.
import { normalize, srgbToOklch, gamutMapOklch, maxChroma, toHex, toOklchCss, wcagRatio, apcaLc, round, clamp } from './lib/color.mjs';
import { cli, fail, table, swatch } from './lib/cli.mjs';

const HELP = `
palette.mjs: gera uma rampa tonal em OKLCH a partir de uma cor semente.

Uso:
  node tools/palette.mjs <cor> [opções]

Método:
  1. Converte a semente para OKLCH (L, C, H).
  2. Distribui a luminosidade L entre --lmax e --lmin com a curva t^--curve
     (expoente > 1 dá passos mais finos nos claros). Por defeito a curva é
     ajustada para que a semente caia exatamente no passo com L mais próxima (--no-anchor desliga).
  3. Chroma relativa: mede quanto da chroma máxima sRGB a semente usa em (L, H) e aplica
     essa proporção a cada passo, sem ultrapassar a chroma da semente (x --chroma).
  4. Gamut mapping por redução de chroma (mantém L e H) para garantir sRGB.

Opções:
  --steps <n>          número de passos (por defeito 11, nomes 50,100,...,900,950; com n != 11 os nomes são 1..n)
  --name <nome>        nome da rampa (por defeito "primary")
  --prefix <p>         prefixo das custom properties (por defeito "color"); CSS: --<prefix>-<nome>-<passo>
  --lmax <0-1>         luminosidade OKLCH do passo mais claro (por defeito 0.975)
  --lmin <0-1>         luminosidade OKLCH do passo mais escuro (por defeito 0.26)
  --curve <exp>        expoente da curva de luminosidade (por defeito 1.15)
  --chroma <fator>     multiplica a chroma alvo (por defeito 1; 0 dá uma rampa neutra com o mesmo matiz)
  --hue-shift <graus>  rotação de matiz do passo mais claro ao mais escuro (por defeito 0)
  --no-anchor          não força a semente a coincidir com um passo
  --format <f>         table (por defeito) | css | dtcg | json
  --css-color <f>      formato de cor no CSS: oklch (por defeito) | hex
  --json               igual a --format json
  -h, --help           esta ajuda

Exemplos:
  node tools/palette.mjs "#2563eb"
  node tools/palette.mjs "oklch(65% 0.19 145)" --name success --format css
  node tools/palette.mjs "#64748b" --name neutral --chroma 0.6 --format dtcg > neutral.tokens.json
`;

const { values: o, positionals } = cli({
  steps: { type: 'string' }, name: { type: 'string' }, prefix: { type: 'string' },
  lmax: { type: 'string' }, lmin: { type: 'string' }, curve: { type: 'string' }, chroma: { type: 'string' },
  'hue-shift': { type: 'string' }, 'no-anchor': { type: 'boolean' }, format: { type: 'string' }, 'css-color': { type: 'string' },
}, HELP);

if (positionals.length !== 1) fail('indica uma cor semente. Ver --help.');
const numOpt = (k, d, lo = -Infinity, hi = Infinity) => {
  if (o[k] === undefined) return d;
  const v = Number(o[k]);
  if (!Number.isFinite(v) || v < lo || v > hi) fail(`--${k} inválido: ${o[k]}`);
  return v;
};
const n = numOpt('steps', 11, 2, 40);
const Lmax = numOpt('lmax', 0.975, 0, 1);
const Lmin = numOpt('lmin', 0.26, 0, 1);
const curve = numOpt('curve', 1.15, 0.1, 5);
const chromaK = numOpt('chroma', 1, 0, 3);
const hueShift = numOpt('hue-shift', 0, -180, 180);
const name = o.name || 'primary';
const prefix = o.prefix ?? 'color';
const format = o.json ? 'json' : o.format || 'table';
if (!['table', 'css', 'dtcg', 'json'].includes(format)) fail(`--format inválido: ${format}`);
if (Lmin >= Lmax) fail('--lmin tem de ser menor que --lmax');

let seed;
try { seed = normalize(positionals[0]); } catch (e) { fail(e.message); }
const [sL, sC, sH0] = seed.oklch;
const achromatic = sC < 0.002;
const sH = achromatic ? 0 : sH0;

const labels = n === 11 ? [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] : Array.from({ length: n }, (_, i) => i + 1);
// posição t em [0,1]: para 50..950 usa o próprio número (50 -> 0, 950 -> 1), senão uniforme
const ts = n === 11 ? labels.map((x) => (x - 50) / 900) : labels.map((_, i) => i / (n - 1));
let Ls = ts.map((t) => Lmax - (Lmax - Lmin) * t ** curve);

let anchorIdx = -1;
if (!o['no-anchor'] && sL > Lmin && sL < Lmax) {
  anchorIdx = Ls.reduce((best, L, i) => (Math.abs(L - sL) < Math.abs(Ls[best] - sL) ? i : best), 0);
  const La = Ls[anchorIdx];
  Ls = Ls.map((L, i) => {
    if (i === anchorIdx) return sL;
    if (i < anchorIdx) return Lmax + ((L - Lmax) * (sL - Lmax)) / (La - Lmax || 1);
    return Lmin + ((L - Lmin) * (sL - Lmin)) / (La - Lmin || 1);
  });
}

const relC = achromatic ? 0 : clamp(sC / Math.max(maxChroma(sL, sH), 1e-6), 0, 1);
const WHITE = [1, 1, 1], BLACK = [0, 0, 0];

const steps = labels.map((label, i) => {
  const L = Ls[i];
  const H = (sH + hueShift * (ts[i] - 0.5) * 2 + 360) % 360;
  let C;
  if (i === anchorIdx && chromaK === 1 && hueShift === 0) C = sC;
  else C = Math.min(relC * maxChroma(L, H), sC) * chromaK;
  const gm = gamutMapOklch([L, C, H]);
  const rgb = gm.rgb;
  const lch = srgbToOklch(rgb);
  const vsW = wcagRatio(rgb, WHITE), vsB = wcagRatio(rgb, BLACK);
  return {
    passo: String(label), hex: toHex(rgb), oklch: toOklchCss([L, gm.lch[1], achromatic ? 0 : H]),
    L: round(L, 4), C: round(gm.lch[1], 4), H: round(achromatic ? 0 : H, 2), semente: i === anchorIdx, ajustadoAoGamut: gm.clipped,
    _rgb: rgb, _lch: lch,
    contraste: {
      branco: { wcag: round(vsW, 2), lcTextoNoBranco: round(apcaLc(rgb, WHITE), 1), lcBrancoSobreCor: round(apcaLc(WHITE, rgb), 1) },
      preto: { wcag: round(vsB, 2), lcTextoNoPreto: round(apcaLc(rgb, BLACK), 1), lcPretoSobreCor: round(apcaLc(BLACK, rgb), 1) },
      textoSobreCor: vsW >= vsB ? 'branco' : 'preto',
    },
  };
});

const cssName = (s) => `--${prefix ? prefix + '-' : ''}${name}-${s.passo}`;
const clean = (s) => { const { _rgb, _lch, ...rest } = s; return rest; };

if (format === 'json') {
  console.log(JSON.stringify({ semente: { input: positionals[0], hex: seed.hex, oklch: toOklchCss(seed.oklch), foraDeGamut: seed.clipped }, nome: name, passos: steps.map(clean) }, null, 2));
} else if (format === 'css') {
  const lines = steps.map((s) => `  ${cssName(s)}: ${o['css-color'] === 'hex' ? s.hex : s.oklch};${s.semente ? ' /* semente */' : ''}`);
  console.log(`/* palette.mjs: ${name} a partir de ${positionals[0]} (${seed.hex}) */\n:root {\n${lines.join('\n')}\n}`);
} else if (format === 'dtcg') {
  const group = { $type: 'color' };
  for (const s of steps) {
    group[s.passo] = { $value: { colorSpace: 'oklch', components: [round(s._lch[0], 4), round(s._lch[1], 4), round(s._lch[2], 2)], hex: s.hex } };
    if (s.semente) group[s.passo].$description = `semente ${positionals[0]}`;
  }
  console.log(JSON.stringify(prefix ? { [prefix]: { [name]: group } } : { [name]: group }, null, 2));
} else {
  console.log(`Semente ${positionals[0]} -> ${seed.hex}  ${toOklchCss(seed.oklch)}${seed.clipped ? '  (fora de sRGB, mapeada)' : ''}\n`);
  console.log(table(steps.map((s) => [
    swatch(s._rgb), s.passo + (s.semente ? ' *' : ''), s.hex, s.oklch,
    s.contraste.branco.wcag.toFixed(2), s.contraste.branco.lcTextoNoBranco.toFixed(1),
    s.contraste.preto.wcag.toFixed(2), s.contraste.preto.lcTextoNoPreto.toFixed(1),
    s.contraste.textoSobreCor,
  ]), ['', 'passo', 'hex', 'oklch', 'vs branco', 'Lc no branco', 'vs preto', 'Lc no preto', 'texto sobre a cor']));
  console.log('\n* passo que coincide com a semente. "Lc no branco" = cor como texto sobre branco; "texto sobre a cor" = branco ou preto com maior rácio WCAG.');
}
