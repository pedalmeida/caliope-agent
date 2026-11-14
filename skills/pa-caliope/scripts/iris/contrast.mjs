#!/usr/bin/env node
// contrast.mjs: contraste WCAG 2.x e APCA-W3 (Lc) entre pares de cores ou em matriz de uma paleta.
import { readFileSync } from 'node:fs';
import { normalize, wcagRatio, wcagLevels, apcaLc, apcaUse, blend, round } from './lib/color.mjs';
import { flatten, resolveAll } from './lib/dtcg.mjs';
import { cli, fail, table, swatch, ok } from './lib/cli.mjs';

const HELP = `
contrast.mjs: contraste WCAG 2.x (rácio) e APCA-W3 0.0.98G-4g (Lc) entre cores.

Uso:
  node tools/contrast.mjs <texto> <fundo> [<texto> <fundo> ...]
  node tools/contrast.mjs --matrix <cor> <cor> [<cor> ...]
  node tools/contrast.mjs --palette paleta.json [--bg <cor>]

Formatos de cor: #rgb, #rrggbb, #rrggbbaa, rgb(), hsl(), oklch(), oklab(), color(srgb ...), nomes CSS.
A ordem importa no APCA: primeiro o texto (primeiro plano), depois o fundo.
Cores fora de sRGB (ex. oklch com chroma alta) são mapeadas por redução de chroma.
Texto com alpha é misturado sobre o fundo antes do cálculo.

Opções:
  --matrix             trata os argumentos como paleta e calcula todas as combinações texto x fundo
  --palette <ficheiro> paleta em JSON: array de cores, objeto {nome: cor} ou ficheiro DTCG (usa tokens de cor)
  --bg <cor>           com --palette ou --matrix: compara cada cor só contra este fundo (repetível com vírgulas: --bg "#fff,#111")
  --min <nível>        filtra a matriz: aa | aa-large | aaa | ui | lc:<n>  (mostra só pares que passam)
  --assert <nível>     termina com código 1 se algum par falhar o nível (mesmos valores que --min)
  --json               saída JSON para agentes
  -h, --help           esta ajuda

Limiares WCAG 2.2 (sem arredondamento, 4.48 falha 4.5):
  AA texto normal 4.5, AA texto grande 3, AAA normal 7, AAA grande 4.5, UI/gráficos (1.4.11) 3.
  Texto grande: >= 24px normal ou >= 18.66px (14pt) bold.
Níveis APCA (Bronze simplificado): Lc 90, 75, 60, 45, 30, 15. Sinal negativo = texto claro em fundo escuro.

Exemplos:
  node tools/contrast.mjs "#777" "#fff"
  node tools/contrast.mjs "oklch(55% 0.2 260)" white "#fff" "#1a1a1a"
  node tools/contrast.mjs --matrix "#0b1f33" "#1d4ed8" "#e2e8f0" "#fff" --min aa
  node tools/contrast.mjs --palette tokens.json --bg "#fff,#0b0b0b" --json
`;

const { values: o, positionals } = cli({
  matrix: { type: 'boolean' }, palette: { type: 'string' }, bg: { type: 'string' },
  min: { type: 'string' }, assert: { type: 'string' },
}, HELP);

function loadPalette(file) {
  let data;
  try { data = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { fail(`não consegui ler ${file}: ${e.message}`); }
  if (Array.isArray(data)) return data.map((c) => ({ name: String(c), value: c }));
  const vals = Object.values(data);
  const looksDtcg = JSON.stringify(data).includes('"$value"');
  if (!looksDtcg && vals.every((v) => typeof v === 'string')) return Object.entries(data).map(([name, value]) => ({ name, value }));
  const { doc, tokens } = flatten(data, { file });
  const { resolved } = resolveAll(doc, tokens);
  return [...resolved.values()].filter((t) => t.type === 'color' && t.resolved !== undefined).map((t) => ({ name: t.cssPath.join('.'), value: t.resolved }));
}

function parseLevel(s) {
  if (!s) return null;
  const l = s.toLowerCase();
  if (l.startsWith('lc:')) { const n = Number(l.slice(3)); if (!Number.isFinite(n)) fail(`nível inválido "${s}"`); return { label: `Lc ${n}`, test: (r) => Math.abs(r.apca.lc) >= n }; }
  const map = { aa: 'aaNormal', 'aa-large': 'aaLarge', aaa: 'aaaNormal', 'aaa-large': 'aaaLarge', ui: 'uiComponents' };
  if (!map[l]) fail(`nível inválido "${s}" (usa aa, aa-large, aaa, aaa-large, ui ou lc:<n>)`);
  return { label: l.toUpperCase(), test: (r) => r.wcag[map[l]] };
}

const safe = (c, name) => { try { return { name: name ?? (typeof c === 'string' ? c : JSON.stringify(c)), ...normalize(c) }; } catch (e) { fail(e.message); } };

function evaluate(fg, bg) {
  if (bg.alpha < 1) fail(`o fundo ${bg.name} tem alpha < 1; indica um fundo opaco (o resultado dependeria do que está por baixo)`);
  const fgEff = fg.alpha < 1 ? blend(fg.rgb, fg.alpha, bg.rgb) : fg.rgb;
  const ratio = wcagRatio(fgEff, bg.rgb);
  const lc = apcaLc(fg.rgb, bg.rgb, fg.alpha);
  const use = apcaUse(lc);
  return {
    texto: { nome: fg.name, hex: fg.hex, foraDeGamut: fg.clipped || undefined },
    fundo: { nome: bg.name, hex: bg.hex, foraDeGamut: bg.clipped || undefined },
    wcag: { ratio: round(ratio, 2), ...wcagLevels(ratio) },
    apca: { lc: round(lc, 1), polaridade: lc >= 0 ? 'texto escuro em fundo claro' : 'texto claro em fundo escuro', nivel: use.nivel, uso: use.uso },
    _rgb: [fgEff, bg.rgb],
  };
}

let pairs = [];
let colors = null;
if (o.palette) colors = loadPalette(o.palette).map((c) => safe(c.value, c.name));
else if (o.matrix) colors = positionals.map((c) => safe(c));

if (colors) {
  if (colors.length < 1) fail('paleta vazia');
  const bgs = o.bg ? o.bg.split(',').map((c) => safe(c.trim())) : colors;
  for (const fg of colors) for (const bg of bgs) if (fg.hex !== bg.hex) pairs.push(evaluate(fg, bg));
} else {
  if (positionals.length === 0 || positionals.length % 2) fail('indica pares <texto> <fundo> (número par de cores), ou usa --matrix / --palette. Ver --help.');
  for (let i = 0; i < positionals.length; i += 2) pairs.push(evaluate(safe(positionals[i]), safe(positionals[i + 1])));
}

const minL = parseLevel(o.min);
if (minL) pairs = pairs.filter(minL.test);
const assertL = parseLevel(o.assert);
const failed = assertL ? pairs.filter((p) => !assertL.test(p)) : [];

if (o.json) {
  const out = { pares: pairs.map(({ _rgb, ...p }) => p) };
  if (assertL) out.assert = { nivel: assertL.label, falhas: failed.length };
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
} else {
  const rows = pairs.map((p) => [
    swatch(p._rgb[0]) + swatch(p._rgb[1]),
    `${p.texto.nome}${p.texto.foraDeGamut ? '*' : ''}`, `${p.fundo.nome}${p.fundo.foraDeGamut ? '*' : ''}`,
    p.wcag.ratio.toFixed(2) + ':1', ok(p.wcag.aaNormal), ok(p.wcag.aaLarge), ok(p.wcag.aaaNormal), ok(p.wcag.aaaLarge), ok(p.wcag.uiComponents),
    `Lc ${p.apca.lc.toFixed(1)}`, p.apca.uso,
  ]);
  console.log(table(rows, ['', 'texto', 'fundo', 'WCAG', 'AA', 'AA grande', 'AAA', 'AAA grande', 'UI 3:1', 'APCA', 'uso APCA recomendado']));
  if (pairs.some((p) => p.texto.foraDeGamut || p.fundo.foraDeGamut)) console.log('\n* cor fora de sRGB, mapeada por redução de chroma em OKLCH.');
  if (pairs.length === 0) console.log('(nenhum par a mostrar)');
  if (assertL) console.log(`\n--assert ${assertL.label}: ${failed.length ? `${failed.length} par(es) falham` : 'todos passam'}`);
}
process.exit(failed.length ? 1 : 0);
