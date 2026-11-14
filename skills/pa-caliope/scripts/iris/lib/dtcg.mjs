// Leitura, resolução e validação de tokens no formato DTCG 2025.10 (Design Tokens Format Module).
// https://www.designtokens.org/tr/2025.10/format/  e  /tr/2025.10/color/
import { DTCG_SPACES, parseColor } from './color.mjs';

export const TYPES = ['color', 'dimension', 'fontFamily', 'fontWeight', 'duration', 'cubicBezier', 'number', 'strokeStyle', 'border', 'transition', 'shadow', 'gradient', 'typography'];
const TOKEN_PROPS = new Set(['$value', '$type', '$description', '$extensions', '$deprecated']);
const GROUP_PROPS = new Set(['$type', '$description', '$extensions', '$deprecated', '$extends', '$root']);
export const FONT_WEIGHTS = { thin: 100, hairline: 100, 'extra-light': 200, 'ultra-light': 200, light: 300, normal: 400, regular: 400, book: 400, medium: 500, 'semi-bold': 600, 'demi-bold': 600, bold: 700, 'extra-bold': 800, 'ultra-bold': 800, black: 900, heavy: 900, 'extra-black': 950, 'ultra-black': 950 };
const STROKE_STYLES = ['solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'outset', 'inset'];

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const REF_RE = /^\{([^{}]+)\}$/;

function getByPath(root, parts) {
  let cur = root;
  for (const p of parts) { if (!isObj(cur) || !(p in cur)) return undefined; cur = cur[p]; }
  return cur;
}
function deepMerge(base, over) {
  const out = structuredClone(base);
  for (const [k, v] of Object.entries(over)) out[k] = isObj(v) && isObj(out[k]) && !('$value' in v) ? deepMerge(out[k], v) : structuredClone(v);
  return out;
}

// Aplica $extends dos grupos (merge profundo, o grupo local sobrepõe-se). Deteta ciclos.
function applyExtends(doc, issues) {
  const visit = (node, path, stack) => {
    if (!isObj(node) || '$value' in node) return node;
    let cur = node;
    // $extends: "{grupo}" ou, equivalente, $ref: "#/grupo" (JSON Schema)
    if (typeof cur.$ref === 'string' && cur.$extends === undefined) {
      const { $ref, ...rest } = cur;
      cur = { ...rest, $extends: $ref.startsWith('#/') ? '{' + $ref.slice(2).split('/').join('.') + '}' : $ref };
    }
    if (typeof cur.$extends === 'string') {
      const m = cur.$extends.match(REF_RE);
      const target = m ? m[1] : null;
      if (!target) issues.push({ level: 'erro', path: path.join('.'), msg: `$extends inválido: "${cur.$extends}" (esperado {grupo.caminho})` });
      else if (stack.includes(target)) issues.push({ level: 'erro', path: path.join('.'), msg: `ciclo em $extends: ${[...stack, target].join(' -> ')}` });
      else {
        const base = getByPath(doc, target.split('.'));
        if (!isObj(base) || '$value' in base) issues.push({ level: 'erro', path: path.join('.'), msg: `$extends aponta para grupo inexistente: {${target}}` });
        else {
          const resolvedBase = visit(base, target.split('.'), [...stack, target]);
          const { $extends, ...rest } = cur;
          cur = deepMerge(resolvedBase, rest);
        }
      }
    }
    const out = {};
    for (const [k, v] of Object.entries(cur)) out[k] = k.startsWith('$') && k !== '$root' ? v : visit(v, [...path, k], [...stack, path.concat(k).join('.')]);
    return out;
  };
  return visit(doc, [], []);
}

// Achata a árvore em tokens { path, value, type (explícito ou herdado), ... }.
export function flatten(rawDoc, { file = '' } = {}) {
  const issues = [];
  const doc = applyExtends(rawDoc, issues);
  const tokens = new Map();
  const lowerNames = new Map();
  const walk = (node, path, inheritedType, inheritedDeprecated) => {
    if (!isObj(node)) { issues.push({ level: 'erro', path: path.join('.'), msg: 'nó que não é objeto (token sem $value?)' }); return; }
    const isToken = '$value' in node;
    for (const k of Object.keys(node)) {
      if (k.startsWith('$')) {
        const allowed = isToken ? TOKEN_PROPS : GROUP_PROPS;
        if (!allowed.has(k)) issues.push({ level: 'aviso', path: path.join('.'), msg: `propriedade reservada desconhecida "${k}"${isToken ? ' num token' : ' num grupo'}` });
      } else if (/[{}.]/.test(k)) issues.push({ level: 'erro', path: [...path, k].join('.'), msg: `nome inválido "${k}": não pode conter { } ou .` });
    }
    if (node.$description !== undefined && typeof node.$description !== 'string') issues.push({ level: 'aviso', path: path.join('.'), msg: '$description deve ser string' });
    if (node.$type !== undefined && !TYPES.includes(node.$type)) issues.push({ level: 'erro', path: path.join('.'), msg: `$type desconhecido "${node.$type}"` });
    const dep = node.$deprecated ?? inheritedDeprecated;
    if (isToken) {
      const p = path.filter((x) => x !== '$root').join('.');
      const key = path.join('.');
      tokens.set(key, { path: key, cssPath: path.filter((x) => x !== '$root'), value: node.$value, explicitType: node.$type, inheritedType, description: node.$description, deprecated: dep, extensions: node.$extensions, file });
      const low = p.toLowerCase();
      if (lowerNames.has(low) && lowerNames.get(low) !== p) issues.push({ level: 'aviso', path: p, msg: `nome difere só em maiúsculas de "${lowerNames.get(low)}"` });
      lowerNames.set(low, p);
      return;
    }
    const t = node.$type ?? inheritedType;
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith('$') && k !== '$root') continue;
      walk(v, [...path, k], t, dep);
    }
  };
  walk(doc, [], undefined, undefined);
  return { doc, tokens, issues };
}

// Resolve aliases {a.b} e JSON Pointer {"$ref": "#/..."} (também dentro de valores compostos).
export function resolveAll(doc, tokens) {
  const issues = [];
  const cache = new Map();
  const typeOf = new Map();
  const refsOf = new Map();

  const pointer = (ref) => {
    if (!ref.startsWith('#/')) return { err: `$ref só suporta ponteiros locais "#/...": "${ref}"` };
    const parts = ref.slice(2).split('/').map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));
    const vi = parts.indexOf('$value');
    const tokenParts = vi === -1 ? parts : parts.slice(0, vi);
    const key = tokenParts.join('.');
    if (!tokens.has(key)) return { err: `referência partida: ${ref}` };
    return { key, rest: vi === -1 ? [] : parts.slice(vi + 1) };
  };

  const resolveToken = (key, stack) => {
    if (cache.has(key)) return cache.get(key);
    if (stack.includes(key)) {
      const cyc = [...stack.slice(stack.indexOf(key)), key];
      throw Object.assign(new Error(`ciclo de referências: ${cyc.join(' -> ')}`), { cycle: cyc });
    }
    const t = tokens.get(key);
    const refs = [];
    const value = resolveValue(t.value, [...stack, key], refs);
    let type = t.explicitType;
    const direct = typeof t.value === 'string' && t.value.match(REF_RE);
    if (!type && direct) type = typeOf.get(direct[1]);
    if (!type && isObj(t.value) && typeof t.value.$ref === 'string') { const p = pointer(t.value.$ref); if (!p.err && p.rest.length === 0) type = typeOf.get(p.key); }
    if (!type) type = t.inheritedType;
    cache.set(key, value); typeOf.set(key, type); refsOf.set(key, refs);
    return value;
  };

  const resolveValue = (v, stack, refs) => {
    if (typeof v === 'string') {
      const m = v.match(REF_RE);
      if (!m) {
        if (/\{[^{}]+\}/.test(v)) issues.push({ level: 'aviso', path: stack.at(-1), msg: `referência embutida em texto "${v}" não é suportada pelo formato (só valores completos)` });
        return v;
      }
      const target = m[1];
      if (!tokens.has(target)) throw Object.assign(new Error(`referência partida: {${target}}`), { broken: target });
      refs.push(target);
      if (tokens.get(target).deprecated) issues.push({ level: 'aviso', path: stack.at(-1), msg: `usa token obsoleto {${target}}` });
      return resolveToken(target, stack);
    }
    if (Array.isArray(v)) return v.map((x) => resolveValue(x, stack, refs));
    if (isObj(v)) {
      if (typeof v.$ref === 'string' && Object.keys(v).length === 1) {
        const p = pointer(v.$ref);
        if (p.err) throw Object.assign(new Error(p.err), { broken: v.$ref });
        refs.push(p.key);
        let val = resolveToken(p.key, stack);
        for (const part of p.rest) {
          if (val == null || !(part in Object(val))) throw Object.assign(new Error(`referência partida: ${v.$ref}`), { broken: v.$ref });
          val = val[part];
        }
        return val;
      }
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolveValue(x, stack, refs)]));
    }
    return v;
  };

  const resolved = new Map();
  for (const key of tokens.keys()) {
    try {
      const value = resolveToken(key, []);
      resolved.set(key, { ...tokens.get(key), resolved: value, type: typeOf.get(key), refs: refsOf.get(key) });
    } catch (e) {
      issues.push({ level: 'erro', path: key, msg: e.message });
      resolved.set(key, { ...tokens.get(key), resolved: undefined, type: tokens.get(key).explicitType ?? tokens.get(key).inheritedType, error: e.message });
    }
  }
  // dedupe de mensagens de ciclo repetidas por cada token do ciclo
  const seen = new Set();
  return { resolved, issues: issues.filter((i) => { const k = i.path + i.msg; if (seen.has(k)) return false; seen.add(k); return true; }) };
}

// ---------- validação de forma por tipo ----------
const isDim = (v, units = ['px', 'rem']) => isObj(v) && typeof v.value === 'number' && units.includes(v.unit);
export function validateValue(type, v) {
  const errs = [];
  const need = (cond, msg) => { if (!cond) errs.push(msg); };
  switch (type) {
    case 'color':
      if (typeof v === 'string') {
        let okStr = true; try { parseColor(v); } catch { okStr = false; }
        errs.push(okStr ? 'cor em string (formato anterior a 2025.10); usar {colorSpace, components, alpha?, hex?}' : `cor inválida "${v}"`);
        break;
      }
      need(isObj(v), 'cor deve ser objeto {colorSpace, components}');
      if (!isObj(v)) break;
      need(DTCG_SPACES.includes(v.colorSpace), `colorSpace inválido "${v.colorSpace}"`);
      need(Array.isArray(v.components) && v.components.length === 3 && v.components.every((c) => typeof c === 'number' || c === 'none'), 'components deve ter 3 números (ou "none")');
      if (v.alpha !== undefined) need(typeof v.alpha === 'number' && v.alpha >= 0 && v.alpha <= 1, 'alpha deve estar entre 0 e 1');
      if (v.hex !== undefined) need(/^#[0-9a-fA-F]{6}$/.test(v.hex), `hex de fallback deve ter 6 dígitos (#rrggbb): "${v.hex}"`);
      if (['srgb', 'display-p3', 'srgb-linear', 'a98-rgb', 'prophoto-rgb', 'rec2020'].includes(v.colorSpace) && Array.isArray(v.components))
        need(v.components.every((c) => c === 'none' || (c >= 0 && c <= 1)), `componentes ${v.colorSpace} devem estar entre 0 e 1`);
      if (v.colorSpace === 'srgb' && v.hex && Array.isArray(v.components) && errs.length === 0) {
        const hx = '#' + v.components.map((c) => Math.round((c === 'none' ? 0 : c) * 255).toString(16).padStart(2, '0')).join('');
        need(hx.toLowerCase() === v.hex.toLowerCase(), `hex ${v.hex} não corresponde aos components (${hx})`);
      }
      break;
    case 'dimension': need(isDim(v), 'dimension deve ser {value: número, unit: "px"|"rem"}'); break;
    case 'duration': need(isDim(v, ['ms', 's']), 'duration deve ser {value: número, unit: "ms"|"s"}'); break;
    case 'number': need(typeof v === 'number', 'number deve ser número JSON'); break;
    case 'fontFamily': need(typeof v === 'string' || (Array.isArray(v) && v.every((x) => typeof x === 'string')), 'fontFamily deve ser string ou array de strings'); break;
    case 'fontWeight': need((typeof v === 'number' && v >= 1 && v <= 1000) || (typeof v === 'string' && v in FONT_WEIGHTS), 'fontWeight deve ser 1-1000 ou palavra-chave do formato'); break;
    case 'cubicBezier': need(Array.isArray(v) && v.length === 4 && v.every((x) => typeof x === 'number') && v[0] >= 0 && v[0] <= 1 && v[2] >= 0 && v[2] <= 1, 'cubicBezier deve ser [x1,y1,x2,y2] com x em [0,1]'); break;
    case 'strokeStyle': need(STROKE_STYLES.includes(v) || (isObj(v) && Array.isArray(v.dashArray) && typeof v.lineCap === 'string'), 'strokeStyle inválido'); break;
    case 'border': need(isObj(v) && 'color' in v && 'width' in v && 'style' in v, 'border precisa de color, width, style'); break;
    case 'transition': need(isObj(v) && 'duration' in v && 'delay' in v && 'timingFunction' in v, 'transition precisa de duration, delay, timingFunction'); break;
    case 'shadow': {
      const arr = Array.isArray(v) ? v : [v];
      need(arr.every((s) => isObj(s) && ['color', 'offsetX', 'offsetY', 'blur', 'spread'].every((k) => k in s)), 'shadow precisa de color, offsetX, offsetY, blur, spread');
      break;
    }
    case 'gradient': need(Array.isArray(v) && v.every((s) => isObj(s) && 'color' in s && typeof s.position === 'number'), 'gradient deve ser array de {color, position}'); break;
    case 'typography': need(isObj(v) && ['fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'lineHeight'].every((k) => k in v), 'typography precisa de fontFamily, fontSize, fontWeight, letterSpacing, lineHeight'); break;
    case undefined: errs.push('tipo indeterminado: sem $type, sem grupo com $type e não é alias'); break;
    default: break;
  }
  return errs;
}

export function lint(rawDoc, opts = {}) {
  const { doc, tokens, issues } = flatten(rawDoc, opts);
  const r = resolveAll(doc, tokens);
  const all = [...issues, ...r.issues];
  for (const t of r.resolved.values()) {
    if (t.error) continue;
    for (const msg of validateValue(t.type, t.resolved)) all.push({ level: msg.startsWith('cor em string') || msg.startsWith('tipo indeterminado') ? 'aviso' : 'erro', path: t.path, msg });
  }
  return { tokens: r.resolved, issues: all };
}
