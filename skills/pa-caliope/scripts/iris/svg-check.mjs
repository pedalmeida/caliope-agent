#!/usr/bin/env node
// svg-check.mjs: verifica ficheiros SVG (ícones e ilustrações) e, opcionalmente, renderiza para PNG via rsvg-convert.
import { readFileSync, mkdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { basename, join, extname } from 'node:path';
import { cli, fail, table } from './lib/cli.mjs';

const HELP = `
svg-check.mjs: verifica SVG e sugere correções.

Uso:
  node tools/svg-check.mjs <ficheiro.svg> [mais.svg ...] [opções]

Verifica:
  viewBox presente e válido; width/height e coerência de proporção com o viewBox
  stroke-width: valores usados e consistência entre ficheiros (útil em sets de ícones)
  cores fixas (hex, rgb, nomes) vs currentColor / none
  ids duplicados e ids não referenciados
  elementos e atributos desnecessários: <metadata>, comentários, namespaces de editores
  (Inkscape, Sodipodi, Illustrator, Sketch, Figma), version, xml:space, enable-background, data-name
  riscos: <script>, atributos on*, <foreignObject>, href externo, raster embutido
  precisão excessiva de números em paths (> 3 casas decimais), tamanho em bytes e gzip

Opções:
  --icon               modo ícone: exige viewBox quadrado, prefere currentColor e avisa width/height fixos
  --grid <n>           com --icon, viewBox esperado "0 0 n n" (ex. 24)
  --render <dir>       renderiza PNG para inspeção visual (precisa de rsvg-convert)
  --sizes <lista>      tamanhos em px para --render (por defeito 16,24,48,96)
  --bg <cor>           cor de fundo no PNG (por defeito transparente)
  --color <cor>        substitui currentColor por esta cor no render (por defeito #111111)
  --json               saída JSON
  -h, --help           esta ajuda

Código de saída: 1 se houver erros (viewBox em falta, ids duplicados, script), 0 caso contrário.

Exemplos:
  node tools/svg-check.mjs icons/*.svg --icon --grid 24
  node tools/svg-check.mjs ilustracao.svg --render /tmp/render --sizes 64,256 --bg "#ffffff"
`;

const { values: o, positionals } = cli({
  icon: { type: 'boolean' }, grid: { type: 'string' }, render: { type: 'string' }, sizes: { type: 'string' },
  bg: { type: 'string' }, color: { type: 'string' },
}, HELP);
if (!positionals.length) fail('indica pelo menos um ficheiro SVG. Ver --help.');

const EDITOR_NS = /^(inkscape|sodipodi|sketch|figma|serif|i|x|graph|a|adobe|ns\d+|xap|dc|cc|rdf|krita|vectornator|bx)$/i;
const COLOR_PROPS = ['fill', 'stroke', 'stop-color', 'flood-color', 'lighting-color', 'color'];

function parse(src) {
  const nodes = []; // { name, attrs, parent, children, selfClosing }
  const root = { name: '#root', attrs: {}, children: [] };
  const stack = [root];
  let comments = 0, commentBytes = 0;
  const textOf = new Map();
  src = src.replace(/<!--[\s\S]*?-->/g, (m) => { comments++; commentBytes += m.length; return ''; });
  const re = /<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)\s*(\/?)>|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>/g;
  let m, last = 0;
  while ((m = re.exec(src))) {
    const between = src.slice(last, m.index);
    if (between.trim() && stack.length > 1) textOf.set(stack.at(-1), (textOf.get(stack.at(-1)) || '') + between);
    last = re.lastIndex;
    if (m[5] !== undefined) { textOf.set(stack.at(-1), (textOf.get(stack.at(-1)) || '') + m[5]); continue; }
    if (!m[2]) continue;
    if (m[1]) { if (stack.length > 1 && stack.at(-1).name === m[2]) stack.pop(); continue; }
    const attrs = {};
    for (const a of m[3].matchAll(/([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/g)) attrs[a[1]] = a[2] ?? a[3] ?? '';
    const node = { name: m[2], attrs, parent: stack.at(-1), children: [] };
    stack.at(-1).children.push(node);
    nodes.push(node);
    if (!m[4]) stack.push(node);
  }
  for (const [n, t] of textOf) n.text = t;
  return { root, nodes, comments, commentBytes };
}

const styleDecls = (s = '') => Object.fromEntries(s.split(';').map((d) => d.split(':').map((x) => x.trim())).filter((d) => d.length === 2 && d[0]));
const isHardColor = (v) => v && !/^(none|currentcolor|inherit|transparent|context-fill|context-stroke|initial|unset)$/i.test(v.trim()) && !/^url\(/i.test(v.trim()) && !/^var\(/i.test(v.trim());

function check(file) {
  let src;
  try { src = readFileSync(file, 'utf8'); } catch (e) { return { ficheiro: file, erros: [`não consegui ler: ${e.message}`], avisos: [], info: {} }; }
  const erros = [], avisos = [], sugestoes = [];
  const { nodes, comments, commentBytes } = parse(src);
  const svg = nodes.find((n) => n.name === 'svg');
  const bytes = Buffer.byteLength(src), gz = gzipSync(src).length;
  const info = { bytes, gzip: gz, elementos: nodes.length };
  if (!svg) { erros.push('sem elemento <svg>'); return { ficheiro: file, erros, avisos, sugestoes, info }; }

  // viewBox e dimensões
  const vbRaw = svg.attrs.viewBox;
  let vb = null;
  if (!vbRaw) erros.push('sem viewBox: o SVG não escala corretamente com CSS');
  else {
    vb = vbRaw.trim().split(/[\s,]+/).map(Number);
    if (vb.length !== 4 || vb.some(Number.isNaN) || vb[2] <= 0 || vb[3] <= 0) { erros.push(`viewBox inválido: "${vbRaw}"`); vb = null; }
  }
  info.viewBox = vbRaw || null;
  info.width = svg.attrs.width ?? null; info.height = svg.attrs.height ?? null;
  const w = parseFloat(svg.attrs.width), h = parseFloat(svg.attrs.height);
  if (!svg.attrs.width || !svg.attrs.height) {
    if (o.icon) sugestoes.push('sem width/height: ok se o tamanho vier do CSS; sem CSS o navegador usa 300x150');
    else avisos.push('sem width/height: sem CSS o navegador usa 300x150 (ou 100% de largura)');
  } else if (vb && Number.isFinite(w) && Number.isFinite(h) && !/%/.test(svg.attrs.width + svg.attrs.height)) {
    if (Math.abs(w / h - vb[2] / vb[3]) > 0.01) avisos.push(`proporção width/height (${w}x${h}) difere do viewBox (${vb[2]}x${vb[3]}): preserveAspectRatio vai acrescentar margens`);
    if (o.icon) sugestoes.push(`width/height fixos (${svg.attrs.width}x${svg.attrs.height}): em ícones, preferir dimensionar por CSS (1em ou tokens)`);
  }
  if (o.icon && vb) {
    if (vb[2] !== vb[3]) avisos.push(`ícone com viewBox não quadrado (${vb[2]}x${vb[3]})`);
    if (o.grid && (vb[0] !== 0 || vb[1] !== 0 || vb[2] !== Number(o.grid) || vb[3] !== Number(o.grid))) avisos.push(`viewBox "${vbRaw}" difere da grelha esperada "0 0 ${o.grid} ${o.grid}"`);
  }

  // estilos, strokes, cores
  const strokeWidths = new Map();
  const hardColors = new Map();
  let currentColorUses = 0, nonScaling = 0;
  const styleEls = nodes.filter((n) => n.name === 'style');
  for (const n of nodes) {
    const st = styleDecls(n.attrs.style);
    const props = { ...n.attrs, ...st };
    if (props['stroke-width'] !== undefined) strokeWidths.set(props['stroke-width'], (strokeWidths.get(props['stroke-width']) || 0) + 1);
    if (props['vector-effect'] === 'non-scaling-stroke') nonScaling++;
    for (const p of COLOR_PROPS) {
      const v = props[p];
      if (v === undefined) continue;
      if (/currentcolor/i.test(v)) currentColorUses++;
      else if (isHardColor(v)) hardColors.set(v.toLowerCase(), (hardColors.get(v.toLowerCase()) || 0) + 1);
    }
  }
  for (const s of styleEls) {
    const css = s.text || '';
    for (const m of css.matchAll(/stroke-width\s*:\s*([^;}\s]+)/g)) strokeWidths.set(m[1], (strokeWidths.get(m[1]) || 0) + 1);
    for (const m of css.matchAll(/(?:^|[;{\s])(fill|stroke|stop-color)\s*:\s*([^;}]+)/g)) {
      const v = m[2].trim();
      if (/currentcolor/i.test(v)) currentColorUses++; else if (isHardColor(v)) hardColors.set(v.toLowerCase(), (hardColors.get(v.toLowerCase()) || 0) + 1);
    }
  }
  if (styleEls.length) avisos.push(`${styleEls.length} elemento(s) <style>: classes podem colidir quando vários SVG são inline na mesma página`);
  info.strokeWidths = Object.fromEntries(strokeWidths);
  info.coresFixas = Object.fromEntries(hardColors);
  info.currentColor = currentColorUses;
  if (strokeWidths.size > 1) avisos.push(`stroke-width inconsistente: ${[...strokeWidths.keys()].join(', ')}`);
  if (o.icon && hardColors.size) avisos.push(`cores fixas num ícone (${[...hardColors.keys()].join(', ')}): usar currentColor para herdar a cor do texto`);
  else if (hardColors.size > 8) sugestoes.push(`${hardColors.size} cores fixas distintas: considerar reduzir a paleta`);
  if (o.icon && nonScaling) sugestoes.push('vector-effect="non-scaling-stroke" presente: o traço não escala com o ícone (intencional?)');

  // ids
  const ids = new Map();
  for (const n of nodes) if (n.attrs.id !== undefined) ids.set(n.attrs.id, (ids.get(n.attrs.id) || 0) + 1);
  const dup = [...ids].filter(([, c]) => c > 1).map(([id]) => id);
  if (dup.length) erros.push(`ids duplicados: ${dup.join(', ')}`);
  const refs = new Set([...src.matchAll(/url\(\s*['"]?#([^)'"\s]+)/g), ...src.matchAll(/href\s*=\s*["']#([^"']+)/g), ...src.matchAll(/aria-(?:labelledby|describedby)\s*=\s*["']([^"']+)/g)].flatMap((m) => m[1].split(/\s+/)));
  const unused = [...ids.keys()].filter((id) => !refs.has(id));
  if (unused.length) sugestoes.push(`ids não referenciados (podem sair; evitam colisões inline): ${unused.slice(0, 10).join(', ')}${unused.length > 10 ? ` (+${unused.length - 10})` : ''}`);
  if (ids.size && !o.icon) sugestoes.push('se vários SVG forem inline na mesma página, prefixar ids para evitar colisões');

  // desnecessários
  const removable = [];
  const meta = nodes.filter((n) => n.name === 'metadata' || /^(sodipodi|inkscape):/.test(n.name));
  if (meta.length) removable.push(`${meta.length} elemento(s) de metadados/editor (${[...new Set(meta.map((n) => n.name))].join(', ')})`);
  if (comments) removable.push(`${comments} comentário(s) (${commentBytes} bytes)`);
  const nsAttrs = Object.keys(svg.attrs).filter((a) => a.startsWith('xmlns:') && EDITOR_NS.test(a.slice(6)));
  if (nsAttrs.length) removable.push(`namespaces de editor: ${nsAttrs.join(', ')}`);
  if (svg.attrs['xmlns:xlink'] && !/xlink:/.test(src.replace(/xmlns:xlink/g, ''))) removable.push('xmlns:xlink sem uso');
  const junkAttrs = new Map();
  for (const n of nodes) for (const a of Object.keys(n.attrs)) {
    if (/^(sodipodi|inkscape|sketch|figma|serif|i|x|adobe):/.test(a) || ['data-name', 'enable-background', 'xml:space'].includes(a) || (a === 'version' && n === svg)) junkAttrs.set(a, (junkAttrs.get(a) || 0) + 1);
  }
  if (junkAttrs.size) removable.push(`atributos desnecessários: ${[...junkAttrs].map(([a, c]) => `${a} (${c})`).join(', ')}`);
  const emptyG = nodes.filter((n) => (n.name === 'g' || n.name === 'defs') && n.children.length === 0).length;
  if (emptyG) removable.push(`${emptyG} <g>/<defs> vazio(s)`);
  const singleG = nodes.filter((n) => n.name === 'g' && n.children.length === 1 && Object.keys(n.attrs).length === 0).length;
  if (singleG) removable.push(`${singleG} <g> sem atributos com um único filho`);
  if (removable.length) avisos.push('remover: ' + removable.join('; '));

  // precisão numérica
  const longNums = (src.match(/\d+\.\d{4,}/g) || []).length;
  if (longNums > 5) sugestoes.push(`${longNums} números com 4+ casas decimais: arredondar a 2-3 casas reduz o tamanho sem perda visível`);

  // riscos
  if (nodes.some((n) => n.name === 'script')) erros.push('contém <script>');
  const handlers = nodes.flatMap((n) => Object.keys(n.attrs).filter((a) => /^on/i.test(a)));
  if (handlers.length) erros.push(`atributos de evento: ${[...new Set(handlers)].join(', ')}`);
  if (nodes.some((n) => n.name === 'foreignObject')) avisos.push('contém <foreignObject> (suporte e render inconsistentes)');
  const ext = nodes.flatMap((n) => [n.attrs.href, n.attrs['xlink:href']]).filter((h) => h && /^(https?:)?\/\//.test(h));
  if (ext.length) avisos.push(`href externo: ${ext.slice(0, 3).join(', ')}`);
  const raster = nodes.filter((n) => n.name === 'image');
  if (raster.length) avisos.push(`${raster.length} <image> (raster embutido ou ligado): perde nitidez ao escalar e pesa mais`);

  // acessibilidade (informativo)
  const hasTitle = svg.children.some((c) => c.name === 'title');
  info.acessibilidade = { title: hasTitle, role: svg.attrs.role ?? null, ariaHidden: svg.attrs['aria-hidden'] ?? null, ariaLabel: svg.attrs['aria-label'] ?? null };
  if (!o.icon && !hasTitle && !svg.attrs['aria-label'] && svg.attrs['aria-hidden'] !== 'true') sugestoes.push('sem <title>/aria-label nem aria-hidden: decidir se é decorativo (aria-hidden="true") ou informativo (role="img" + nome)');

  if (bytes > 50 * 1024) avisos.push(`tamanho ${Math.round(bytes / 1024)} KB: grande para SVG inline; considerar otimizar (ex. SVGO) ou servir como ficheiro`);
  else if (o.icon && bytes > 2048) sugestoes.push(`ícone com ${bytes} bytes: ícones simples costumam ficar abaixo de 1-2 KB após otimização`);

  return { ficheiro: file, erros, avisos, sugestoes, info, _src: src };
}

function render(r, dir, sizes) {
  const which = spawnSync('rsvg-convert', ['--version'], { encoding: 'utf8' });
  if (which.error) return ['rsvg-convert não encontrado (macOS: brew install librsvg)'];
  mkdirSync(dir, { recursive: true });
  const color = o.color || '#111111';
  const src = r._src.replace(/currentColor/gi, color);
  const out = [];
  for (const s of sizes) {
    const file = join(dir, `${basename(r.ficheiro, extname(r.ficheiro))}-${s}.png`);
    const args = ['-w', String(s), '-a', '-o', file];
    if (o.bg) args.push('-b', o.bg);
    const p = spawnSync('rsvg-convert', args, { input: src });
    out.push(p.status === 0 ? file : `falhou ${file}: ${String(p.stderr).trim()}`);
  }
  return out;
}

const sizes = (o.sizes || '16,24,48,96').split(',').map((s) => parseInt(s, 10)).filter((n) => n > 0);
const results = positionals.map(check);
for (const r of results) if (o.render && r._src) r.renders = render(r, o.render, sizes);

// consistência entre ficheiros (sets de ícones)
const set = {};
if (results.length > 1) {
  const sw = new Set(results.flatMap((r) => Object.keys(r.info.strokeWidths || {})));
  const vbs = new Set(results.map((r) => r.info.viewBox ?? '(nenhum)'));
  set.strokeWidths = [...sw]; set.viewBoxes = [...vbs];
  set.avisos = [];
  if (sw.size > 1) set.avisos.push(`stroke-width diferentes no conjunto: ${[...sw].join(', ')}`);
  if (vbs.size > 1) set.avisos.push(`viewBox diferentes no conjunto: ${[...vbs].join(' | ')}`);
}

const hasErr = results.some((r) => r.erros.length);
if (o.json) {
  console.log(JSON.stringify({ ficheiros: results.map(({ _src, ...r }) => r), conjunto: results.length > 1 ? set : undefined }, null, 2));
} else {
  for (const r of results) {
    const i = r.info;
    console.log(`\n${r.ficheiro}`);
    console.log(`  ${i.bytes} bytes (${i.gzip} gzip), ${i.elementos} elementos, viewBox ${i.viewBox ?? '(nenhum)'}, width ${i.width ?? '-'} height ${i.height ?? '-'}`);
    if (i.strokeWidths) console.log(`  stroke-width: ${Object.keys(i.strokeWidths).join(', ') || '-'}; currentColor: ${i.currentColor}; cores fixas: ${Object.keys(i.coresFixas).join(', ') || '-'}`);
    for (const e of r.erros) console.log(`  ERRO   ${e}`);
    for (const a of r.avisos) console.log(`  aviso  ${a}`);
    for (const s of r.sugestoes || []) console.log(`  dica   ${s}`);
    for (const f of r.renders || []) console.log(`  png    ${f}`);
    if (!r.erros.length && !r.avisos.length) console.log('  sem erros nem avisos');
  }
  if (results.length > 1) {
    console.log(`\nConjunto (${results.length} ficheiros): ${set.avisos.length ? set.avisos.join('; ') : 'viewBox e stroke-width consistentes'}`);
    console.log(table(results.map((r) => [basename(r.ficheiro), r.erros.length, r.avisos.length, r.info.viewBox ?? '-', Object.keys(r.info.strokeWidths || {}).join(',') || '-', r.info.bytes]), ['ficheiro', 'erros', 'avisos', 'viewBox', 'stroke', 'bytes']));
  }
}
process.exit(hasErr ? 1 : 0);
