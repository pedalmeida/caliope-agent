#!/usr/bin/env node
// tokens.mjs: tokens DTCG 2025.10 (JSON) -> CSS custom properties, com resolução de aliases e validação.
import { readFileSync, writeFileSync } from 'node:fs';
import { flatten, resolveAll, lint, FONT_WEIGHTS } from './lib/dtcg.mjs';
import { fromDtcg, toHex, toOklchCss, srgbToOklch, inGamut, gamutMapOklch, clamp, round } from './lib/color.mjs';
import { cli, fail, table } from './lib/cli.mjs';

const HELP = `
tokens.mjs: lê tokens no formato DTCG 2025.10, resolve aliases e emite CSS custom properties.

Uso:
  node tools/tokens.mjs <tokens.json> [mais.json ...] [opções]
  node tools/tokens.mjs <tokens.json> --lint

Vários ficheiros são fundidos pela ordem dada (os seguintes sobrepõem-se), como um só conjunto.

Suporta:
  $value, $type (incluindo herança do grupo), $description, $deprecated, $extensions, $root, $extends
  aliases "{grupo.token}" (também dentro de valores compostos) e JSON Pointer {"$ref": "#/grupo/token/$value/..."}
  cor como objeto {colorSpace, components, alpha?, hex?}; conversão própria para srgb, srgb-linear, hsl, oklab, oklch;
  outros espaços usam o "hex" de fallback.
  Deteta ciclos e referências partidas (erro, código de saída 1).

Opções:
  --selector <s>       seletor do bloco principal (por defeito ":root")
  --prefix <p>         prefixo das variáveis (ex. "ds" -> --ds-color-primary)
  --dark <ficheiro>    tokens do modo escuro (só os que mudam); podem referir tokens dos ficheiros base.
                       Emite os tokens cujo valor resolvido muda, incluindo aliases afetados indiretamente.
  --dark-selector <s>  por defeito "@media (prefers-color-scheme: dark)" (envolve o seletor principal).
                       Pode ser um seletor, ex. '[data-theme="dark"]'.
  --keep-refs          aliases saem como var(--alvo) em vez do valor resolvido
  --color <f>          formato das cores: auto (por defeito: hex em srgb, oklch() em oklch, etc.) | hex | oklch
  --out <ficheiro>     escreve o CSS no ficheiro em vez do stdout
  --lint               só valida: nomes, tipos, forma dos valores, aliases, ciclos, tokens obsoletos
  --json               saída JSON (tokens resolvidos, ou relatório de lint com --lint)
  -h, --help           esta ajuda

Exemplos:
  node tools/tokens.mjs tokens/base.json tokens/semantic.json --prefix ds
  node tools/tokens.mjs tokens.json --dark tokens.dark.json --dark-selector '[data-theme="dark"]' --out tokens.css
  node tools/tokens.mjs tokens.json --lint --json
`;

const { values: o, positionals } = cli({
  selector: { type: 'string' }, prefix: { type: 'string' }, dark: { type: 'string' }, 'dark-selector': { type: 'string' },
  'keep-refs': { type: 'boolean' }, color: { type: 'string' }, out: { type: 'string' }, lint: { type: 'boolean' },
}, HELP);

if (!positionals.length) fail('indica pelo menos um ficheiro de tokens. Ver --help.');
const colorFmt = o.color || 'auto';
if (!['auto', 'hex', 'oklch'].includes(colorFmt)) fail(`--color inválido: ${colorFmt}`);

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
function merge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = isObj(v) && isObj(out[k]) && !('$value' in v) ? merge(out[k], v) : v;
  return out;
}
function load(files) {
  return files.reduce((acc, f) => {
    let d;
    try { d = JSON.parse(readFileSync(f, 'utf8')); } catch (e) { fail(`não consegui ler ${f}: ${e.message}`); }
    return merge(acc, d);
  }, {});
}

// ---------- lint ----------
if (o.lint) {
  const files = o.dark ? [...positionals, o.dark] : positionals;
  const reports = [];
  const base = load(positionals);
  reports.push({ ficheiros: positionals, ...lint(base) });
  if (o.dark) reports.push({ ficheiros: [...positionals, o.dark], modo: 'escuro', ...lint(merge(base, load([o.dark]))) });
  const issues = reports.flatMap((r) => r.issues.map((i) => ({ ...i, contexto: r.modo || 'base' })));
  const seen = new Set();
  const uniq = issues.filter((i) => { const k = `${i.level}|${i.path}|${i.msg}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const errors = uniq.filter((i) => i.level === 'erro').length;
  if (o.json) {
    console.log(JSON.stringify({ ficheiros: files, tokens: reports[0].tokens.size, erros: errors, avisos: uniq.length - errors, problemas: uniq }, null, 2));
  } else {
    console.log(`${files.join(', ')}: ${reports[0].tokens.size} tokens, ${errors} erro(s), ${uniq.length - errors} aviso(s)`);
    if (uniq.length) console.log('\n' + table(uniq.map((i) => [i.level, i.path || '(raiz)', i.msg, i.contexto === 'base' ? '' : i.contexto]), ['nível', 'token', 'problema', '']));
  }
  process.exit(errors ? 1 : 0);
}

// ---------- conversão para CSS ----------
const prefix = o.prefix ? o.prefix.replace(/^-+|-+$/g, '') + '-' : '';
const varName = (cssPath) => '--' + prefix + cssPath.map((p) => p.trim().replace(/\s+/g, '-').replace(/[^A-Za-z0-9_-]/g, '-')).join('-');

function colorCss(v) {
  if (typeof v === 'string') return v; // formato antigo (string) passa tal como está
  const c = fromDtcg(v);
  const alpha = clamp(c.alpha ?? 1);
  let rgb = c.rgb;
  const lch = c.oklch || srgbToOklch(rgb);
  const fits = inGamut(rgb);
  if (colorFmt === 'oklch' || (colorFmt === 'auto' && (v.colorSpace === 'oklch' || v.colorSpace === 'oklab' || !fits))) {
    if (v.colorSpace === 'oklab' && colorFmt === 'auto') return `oklab(${round(v.components[0] * 100, 2)}% ${v.components[1]} ${v.components[2]}${alpha < 1 ? ` / ${alpha}` : ''})`;
    return toOklchCss(lch, alpha);
  }
  if (colorFmt === 'auto' && ['display-p3', 'rec2020', 'a98-rgb', 'prophoto-rgb', 'xyz-d65', 'xyz-d50', 'lab', 'lch', 'hwb'].includes(v.colorSpace)) {
    const fn = ['lab', 'lch', 'hwb'].includes(v.colorSpace) ? v.colorSpace : null;
    const comps = v.components.join(' ');
    return fn ? `${fn}(${comps}${alpha < 1 ? ` / ${alpha}` : ''})` : `color(${v.colorSpace} ${comps}${alpha < 1 ? ` / ${alpha}` : ''})`;
  }
  if (!fits) rgb = gamutMapOklch(lch).rgb;
  return toHex(rgb.map((x) => clamp(x)), alpha);
}
const dim = (v) => (isObj(v) ? `${v.value}${v.unit}` : String(v));
const fontFamily = (v) => (Array.isArray(v) ? v : [v]).map((f) => (/^[a-z-]+$/i.test(f) && !/\s/.test(f) ? f : `"${f}"`)).join(', ');
const fontWeight = (v) => (typeof v === 'string' ? FONT_WEIGHTS[v] ?? v : v);
const bezier = (v) => `cubic-bezier(${v.join(', ')})`;

function toCss(type, v) {
  if (v === undefined) return null;
  switch (type) {
    case 'color': return colorCss(v);
    case 'dimension': case 'duration': return dim(v);
    case 'number': return String(v);
    case 'fontFamily': return fontFamily(v);
    case 'fontWeight': return String(fontWeight(v));
    case 'cubicBezier': return bezier(v);
    case 'strokeStyle': return typeof v === 'string' ? v : 'dashed';
    case 'border': return `${dim(v.width)} ${typeof v.style === 'string' ? v.style : 'dashed'} ${colorCss(v.color)}`;
    case 'transition': return `${dim(v.duration)} ${bezier(v.timingFunction)} ${dim(v.delay)}`;
    case 'shadow': return (Array.isArray(v) ? v : [v]).map((s) => `${s.inset ? 'inset ' : ''}${dim(s.offsetX)} ${dim(s.offsetY)} ${dim(s.blur)} ${dim(s.spread)} ${colorCss(s.color)}`).join(', ');
    case 'gradient': return v.map((s) => `${colorCss(s.color)} ${round(clamp(s.position) * 100, 2)}%`).join(', ');
    case 'typography': return null; // tratado à parte (várias propriedades)
    default: return typeof v === 'object' ? JSON.stringify(v) : String(v);
  }
}

// Gera pares [nome, valor, comentário] para um token resolvido.
function declarations(t, byKey) {
  const name = varName(t.cssPath);
  const direct = typeof t.value === 'string' && t.value.match(/^\{([^{}]+)\}$/);
  if (o['keep-refs'] && direct && byKey.has(direct[1])) return [[name, `var(${varName(byKey.get(direct[1]).cssPath)})`, t]];
  if (t.type === 'typography') {
    const v = t.resolved;
    return [
      [`${name}-font-family`, fontFamily(v.fontFamily), t], [`${name}-font-size`, dim(v.fontSize), t],
      [`${name}-font-weight`, String(fontWeight(v.fontWeight)), t], [`${name}-letter-spacing`, dim(v.letterSpacing), t],
      [`${name}-line-height`, String(v.lineHeight), t],
    ];
  }
  const val = toCss(t.type, t.resolved);
  return val == null ? [] : [[name, val, t]];
}

function build(files) {
  const doc = load(files);
  const { doc: d, tokens, issues } = flatten(doc);
  const r = resolveAll(d, tokens);
  return { resolved: r.resolved, issues: [...issues, ...r.issues] };
}

const base = build(positionals);
const errors = base.issues.filter((i) => i.level === 'erro');
const byKey = base.resolved;
const decl = [...byKey.values()].filter((t) => !t.error).flatMap((t) => declarations(t, byKey));

let darkDecl = [];
if (o.dark) {
  const dark = build([...positionals, o.dark]);
  errors.push(...dark.issues.filter((i) => i.level === 'erro').map((i) => ({ ...i, msg: `[escuro] ${i.msg}` })));
  let darkOnly;
  try { darkOnly = new Set(flatten(JSON.parse(readFileSync(o.dark, 'utf8'))).tokens.keys()); } catch (e) { fail(`não consegui ler ${o.dark}: ${e.message}`); }
  const baseMap = new Map(decl.map(([n, v]) => [n, v]));
  darkDecl = [...dark.resolved.values()].filter((t) => !t.error).flatMap((t) => declarations(t, dark.resolved))
    .filter(([n, v, t]) => darkOnly.has(t.path) || baseMap.get(n) !== v);
}

if (o.json) {
  const pick = (list) => Object.fromEntries(list.map(([n, v]) => [n, v]));
  const tokensOut = [...byKey.values()].map((t) => ({ path: t.path, type: t.type, value: t.resolved, refs: t.refs?.length ? t.refs : undefined, description: t.description, deprecated: t.deprecated, error: t.error }));
  console.log(JSON.stringify({ erros: errors, css: pick(decl), cssEscuro: o.dark ? pick(darkDecl) : undefined, tokens: tokensOut }, null, 2));
  process.exit(errors.length ? 1 : 0);
}

const sel = o.selector || ':root';
const block = (selector, list, indent = '') => {
  const lines = list.map(([n, v, t]) => {
    const notes = [t.deprecated ? `obsoleto${typeof t.deprecated === 'string' ? ': ' + t.deprecated : ''}` : '', t.description || ''].filter(Boolean).join('; ');
    return `${indent}  ${n}: ${v};${notes ? ` /* ${notes.replace(/\*\//g, '* /')} */` : ''}`;
  });
  return `${indent}${selector} {\n${lines.join('\n')}\n${indent}}`;
};
let css = `/* Gerado por tools/tokens.mjs a partir de ${[...positionals, ...(o.dark ? [o.dark] : [])].join(', ')}. Não editar à mão. */\n`;
css += block(sel, decl) + '\n';
if (o.dark && darkDecl.length) {
  const ds = o['dark-selector'] || '@media (prefers-color-scheme: dark)';
  css += '\n' + (ds.startsWith('@') ? `${ds} {\n${block(sel, darkDecl, '  ')}\n}` : block(ds, darkDecl)) + '\n';
}
if (errors.length) {
  process.stderr.write(`${errors.length} erro(s) nos tokens (tokens com erro foram omitidos):\n` + errors.map((e) => `  ${e.path}: ${e.msg}`).join('\n') + '\n');
}
if (o.out) { writeFileSync(o.out, css); console.log(`escrito ${o.out}: ${decl.length} propriedades${o.dark ? `, ${darkDecl.length} no modo escuro` : ''}`); }
else process.stdout.write(css);
process.exit(errors.length ? 1 : 0);
