// Biblioteca de cor sem dependências, partilhada por contrast, palette e tokens.
// Conversões: sRGB <-> sRGB linear <-> OKLab <-> OKLCH, HSL, luminância WCAG 2, APCA-W3.
// Fontes das constantes: ver tools/README.md (secção Fontes).

// ---------- utilitários ----------
export const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
const round = (x, p = 4) => { const f = 10 ** p; return Math.round(x * f) / f; };

// ---------- cores nomeadas CSS (CSS Color 4, 148 nomes) ----------
const NAMED_RAW = 'aliceblue:f0f8ff,antiquewhite:faebd7,aqua:00ffff,aquamarine:7fffd4,azure:f0ffff,beige:f5f5dc,bisque:ffe4c4,black:000000,blanchedalmond:ffebcd,blue:0000ff,blueviolet:8a2be2,brown:a52a2a,burlywood:deb887,cadetblue:5f9ea0,chartreuse:7fff00,chocolate:d2691e,coral:ff7f50,cornflowerblue:6495ed,cornsilk:fff8dc,crimson:dc143c,cyan:00ffff,darkblue:00008b,darkcyan:008b8b,darkgoldenrod:b8860b,darkgray:a9a9a9,darkgreen:006400,darkgrey:a9a9a9,darkkhaki:bdb76b,darkmagenta:8b008b,darkolivegreen:556b2f,darkorange:ff8c00,darkorchid:9932cc,darkred:8b0000,darksalmon:e9967a,darkseagreen:8fbc8f,darkslateblue:483d8b,darkslategray:2f4f4f,darkslategrey:2f4f4f,darkturquoise:00ced1,darkviolet:9400d3,deeppink:ff1493,deepskyblue:00bfff,dimgray:696969,dimgrey:696969,dodgerblue:1e90ff,firebrick:b22222,floralwhite:fffaf0,forestgreen:228b22,fuchsia:ff00ff,gainsboro:dcdcdc,ghostwhite:f8f8ff,gold:ffd700,goldenrod:daa520,gray:808080,green:008000,greenyellow:adff2f,grey:808080,honeydew:f0fff0,hotpink:ff69b4,indianred:cd5c5c,indigo:4b0082,ivory:fffff0,khaki:f0e68c,lavender:e6e6fa,lavenderblush:fff0f5,lawngreen:7cfc00,lemonchiffon:fffacd,lightblue:add8e6,lightcoral:f08080,lightcyan:e0ffff,lightgoldenrodyellow:fafad2,lightgray:d3d3d3,lightgreen:90ee90,lightgrey:d3d3d3,lightpink:ffb6c1,lightsalmon:ffa07a,lightseagreen:20b2aa,lightskyblue:87cefa,lightslategray:778899,lightslategrey:778899,lightsteelblue:b0c4de,lightyellow:ffffe0,lime:00ff00,limegreen:32cd32,linen:faf0e6,magenta:ff00ff,maroon:800000,mediumaquamarine:66cdaa,mediumblue:0000cd,mediumorchid:ba55d3,mediumpurple:9370db,mediumseagreen:3cb371,mediumslateblue:7b68ee,mediumspringgreen:00fa9a,mediumturquoise:48d1cc,mediumvioletred:c71585,midnightblue:191970,mintcream:f5fffa,mistyrose:ffe4e1,moccasin:ffe4b5,navajowhite:ffdead,navy:000080,oldlace:fdf5e6,olive:808000,olivedrab:6b8e23,orange:ffa500,orangered:ff4500,orchid:da70d6,palegoldenrod:eee8aa,palegreen:98fb98,paleturquoise:afeeee,palevioletred:db7093,papayawhip:ffefd5,peachpuff:ffdab9,peru:cd853f,pink:ffc0cb,plum:dda0dd,powderblue:b0e0e6,purple:800080,rebeccapurple:663399,red:ff0000,rosybrown:bc8f8f,royalblue:4169e1,saddlebrown:8b4513,salmon:fa8072,sandybrown:f4a460,seagreen:2e8b57,seashell:fff5ee,sienna:a0522d,silver:c0c0c0,skyblue:87ceeb,slateblue:6a5acd,slategray:708090,slategrey:708090,snow:fffafa,springgreen:00ff7f,steelblue:4682b4,tan:d2b48c,teal:008080,thistle:d8bfd8,tomato:ff6347,turquoise:40e0d0,violet:ee82ee,wheat:f5deb3,white:ffffff,whitesmoke:f5f5f5,yellow:ffff00,yellowgreen:9acd32';
const NAMED = Object.fromEntries(NAMED_RAW.split(',').map((p) => p.split(':')));

// ---------- sRGB <-> linear ----------
// Função de transferência sRGB (IEC 61966-2-1), limiar 0.04045.
export const srgbToLinear = (c) => (Math.abs(c) <= 0.04045 ? c / 12.92 : Math.sign(c) * ((Math.abs(c) + 0.055) / 1.055) ** 2.4);
export const linearToSrgb = (c) => (Math.abs(c) <= 0.0031308 ? c * 12.92 : Math.sign(c) * (1.055 * Math.abs(c) ** (1 / 2.4) - 0.055));

// ---------- OKLab (Björn Ottosson, matrizes também usadas em CSS Color 4) ----------
export function linearSrgbToOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}
export function oklabToLinearSrgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}
export function oklabToOklch([L, a, b]) {
  const C = Math.hypot(a, b);
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return [L, C, C < 1e-4 ? 0 : H];
}
export function oklchToOklab([L, C, H]) {
  const h = (H * Math.PI) / 180;
  return [L, C * Math.cos(h), C * Math.sin(h)];
}

// rgb: componentes sRGB codificados 0..1
export const srgbToOklch = (rgb) => oklabToOklch(linearSrgbToOklab(rgb.map(srgbToLinear)));
export const oklchToSrgb = (lch) => oklabToLinearSrgb(oklchToOklab(lch)).map(linearToSrgb);

export const inGamut = (rgb, eps = 1e-6) => rgb.every((c) => c >= -eps && c <= 1 + eps);

// Gamut mapping simples: mantém L e H, reduz C por bisseção até caber em sRGB.
export function gamutMapOklch([L, C, H], eps = 1e-5) {
  if (L >= 1) return { lch: [1, 0, H], rgb: [1, 1, 1], clipped: C > 0 };
  if (L <= 0) return { lch: [0, 0, H], rgb: [0, 0, 0], clipped: C > 0 };
  let rgb = oklchToSrgb([L, C, H]);
  if (inGamut(rgb)) return { lch: [L, C, H], rgb: rgb.map((c) => clamp(c)), clipped: false };
  let lo = 0, hi = C;
  while (hi - lo > eps) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToSrgb([L, mid, H]))) lo = mid; else hi = mid;
  }
  rgb = oklchToSrgb([L, lo, H]).map((c) => clamp(c));
  return { lch: [L, lo, H], rgb, clipped: true };
}
// Chroma máxima em sRGB para um par L,H.
export function maxChroma(L, H) { return gamutMapOklch([L, 0.5, H]).lch[1]; }

// ---------- HSL ----------
function hslToSrgb(h, s, l) {
  h = ((h % 360) + 360) % 360; s = clamp(s); l = clamp(l);
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)];
}

// ---------- parsing ----------
// Devolve { rgb: [r,g,b] 0..1 (pode estar fora de gamut antes do clip), alpha, source, oklch? }
function num(tok, pctScale = 1) {
  tok = String(tok).trim();
  if (tok === 'none') return 0;
  if (tok.endsWith('%')) return (parseFloat(tok) / 100) * pctScale;
  const v = parseFloat(tok);
  if (Number.isNaN(v)) throw new Error(`valor numérico inválido: "${tok}"`);
  return v;
}
function hue(tok) {
  tok = String(tok).trim();
  if (tok === 'none') return 0;
  const v = parseFloat(tok);
  if (tok.endsWith('turn')) return v * 360;
  if (tok.endsWith('grad')) return v * 0.9;
  if (tok.endsWith('rad')) return (v * 180) / Math.PI;
  return v;
}
function splitArgs(inner) {
  // aceita "a b c / d" e "a, b, c, d"
  let alpha;
  let body = inner;
  if (inner.includes('/')) { const [b, a] = inner.split('/'); body = b; alpha = a.trim(); }
  const parts = body.split(/[\s,]+/).filter(Boolean);
  if (alpha === undefined && parts.length === 4) alpha = parts.pop();
  return { parts, alpha: alpha === undefined ? 1 : clamp(num(alpha)) };
}

export function parseColor(input) {
  if (input && typeof input === 'object') return fromDtcg(input);
  let s = String(input).trim().toLowerCase();
  if (s === 'transparent') return { rgb: [0, 0, 0], alpha: 0, source: input };
  if (NAMED[s]) s = '#' + NAMED[s];
  if (/^[0-9a-f]{3,8}$/.test(s) && [3, 4, 6, 8].includes(s.length)) s = '#' + s;
  let m;
  if ((m = s.match(/^#([0-9a-f]{3,8})$/))) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) throw new Error(`hex inválido: "${input}"`);
    const v = [0, 2, 4, 6].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    return { rgb: v.slice(0, 3), alpha: h.length === 8 ? v[3] : 1, source: input };
  }
  if ((m = s.match(/^rgba?\((.*)\)$/))) {
    const { parts, alpha } = splitArgs(m[1]);
    return { rgb: parts.slice(0, 3).map((p) => (p.endsWith('%') ? num(p) : num(p) / 255)), alpha, source: input };
  }
  if ((m = s.match(/^hsla?\((.*)\)$/))) {
    const { parts, alpha } = splitArgs(m[1]);
    const sat = parts[1].endsWith('%') ? num(parts[1]) : num(parts[1]) / 100;
    const lig = parts[2].endsWith('%') ? num(parts[2]) : num(parts[2]) / 100;
    return { rgb: hslToSrgb(hue(parts[0]), sat, lig), alpha, source: input };
  }
  if ((m = s.match(/^oklch\((.*)\)$/))) {
    const { parts, alpha } = splitArgs(m[1]);
    const L = num(parts[0]);
    const C = num(parts[1], 0.4);
    const H = hue(parts[2]);
    return { rgb: oklchToSrgb([L, C, H]), alpha, source: input, oklch: [L, C, H] };
  }
  if ((m = s.match(/^oklab\((.*)\)$/))) {
    const { parts, alpha } = splitArgs(m[1]);
    const lab = [num(parts[0]), num(parts[1], 0.4), num(parts[2], 0.4)];
    return { rgb: oklabToLinearSrgb(lab).map(linearToSrgb), alpha, source: input };
  }
  if ((m = s.match(/^color\(\s*(srgb|srgb-linear)\s+(.*)\)$/))) {
    const { parts, alpha } = splitArgs(m[2]);
    let rgb = parts.slice(0, 3).map((p) => num(p));
    if (m[1] === 'srgb-linear') rgb = rgb.map(linearToSrgb);
    return { rgb, alpha, source: input };
  }
  throw new Error(`cor não reconhecida: "${input}" (formatos: #hex, rgb(), hsl(), oklch(), oklab(), color(srgb ...), nome CSS)`);
}

// Cor DTCG 2025.10: { colorSpace, components, alpha?, hex? }
export const DTCG_SPACES = ['srgb', 'srgb-linear', 'hsl', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'display-p3', 'a98-rgb', 'prophoto-rgb', 'rec2020', 'xyz-d65', 'xyz-d50'];
export function fromDtcg(v) {
  const { colorSpace, components, alpha = 1, hex } = v;
  const c = (components || []).map((x) => (x === 'none' ? 0 : x));
  switch (colorSpace) {
    case 'srgb': return { rgb: c, alpha, source: v };
    case 'srgb-linear': return { rgb: c.map(linearToSrgb), alpha, source: v };
    case 'hsl': return { rgb: hslToSrgb(c[0], c[1] / 100, c[2] / 100), alpha, source: v };
    case 'oklch': return { rgb: oklchToSrgb(c), alpha, source: v, oklch: c };
    case 'oklab': return { rgb: oklabToLinearSrgb(c).map(linearToSrgb), alpha, source: v };
    default:
      if (hex) { const p = parseColor(hex); return { ...p, alpha, source: v, approx: true }; }
      throw new Error(`colorSpace "${colorSpace}" sem conversão implementada e sem "hex" de fallback`);
  }
}

// ---------- formatação ----------
const h2 = (x) => Math.round(clamp(x) * 255).toString(16).padStart(2, '0');
export const toHex = (rgb, alpha = 1) => '#' + rgb.map(h2).join('') + (alpha < 1 ? h2(alpha) : '');
export function toOklchCss([L, C, H], alpha = 1) {
  const a = alpha < 1 ? ` / ${round(alpha, 3)}` : '';
  return `oklch(${round(L * 100, 2)}% ${round(C, 4)} ${round(H, 2)}${a})`;
}

// ---------- WCAG 2.x ----------
// Luminância relativa (WCAG 2.x, definição "relative luminance"; coeficientes Rec. 709).
export function relativeLuminance(rgb) {
  const [r, g, b] = rgb.map((c) => srgbToLinear(clamp(c)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function wcagRatio(fgRgb, bgRgb) {
  const a = relativeLuminance(fgRgb), b = relativeLuminance(bgRgb);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}
// Limiares WCAG 2.2: 1.4.3 (AA), 1.4.6 (AAA), 1.4.11 (não texto). Sem arredondamento: 4.48 falha 4.5.
export function wcagLevels(ratio) {
  return {
    aaNormal: ratio >= 4.5,
    aaLarge: ratio >= 3,
    aaaNormal: ratio >= 7,
    aaaLarge: ratio >= 4.5,
    uiComponents: ratio >= 3,
  };
}

// ---------- APCA-W3 0.0.98G-4g (biblioteca apca-w3 0.1.9) ----------
const SA98G = {
  mainTRC: 2.4, sRco: 0.2126729, sGco: 0.7151522, sBco: 0.0721750,
  normBG: 0.56, normTXT: 0.57, revTXT: 0.62, revBG: 0.65,
  blkThrs: 0.022, blkClmp: 1.414, scaleBoW: 1.14, scaleWoB: 1.14,
  loBoWoffset: 0.027, loWoBoffset: 0.027, deltaYmin: 0.0005, loClip: 0.1,
};
// sRGBtoY do APCA: expoente simples 2.4 sobre valores 8 bits (sem segmento linear).
export function apcaY(rgb) {
  const [r, g, b] = rgb.map((c) => (Math.round(clamp(c) * 255) / 255) ** SA98G.mainTRC);
  return SA98G.sRco * r + SA98G.sGco * g + SA98G.sBco * b;
}
// Ordem importa: texto primeiro, fundo depois. Positivo = texto escuro em fundo claro.
export function apcaContrast(txtY, bgY) {
  if ([txtY, bgY].some((y) => Number.isNaN(y) || y < 0 || y > 1.1)) return 0;
  txtY = txtY > SA98G.blkThrs ? txtY : txtY + (SA98G.blkThrs - txtY) ** SA98G.blkClmp;
  bgY = bgY > SA98G.blkThrs ? bgY : bgY + (SA98G.blkThrs - bgY) ** SA98G.blkClmp;
  if (Math.abs(bgY - txtY) < SA98G.deltaYmin) return 0;
  if (bgY > txtY) {
    const sapc = (bgY ** SA98G.normBG - txtY ** SA98G.normTXT) * SA98G.scaleBoW;
    return (sapc < SA98G.loClip ? 0 : sapc - SA98G.loBoWoffset) * 100;
  }
  const sapc = (bgY ** SA98G.revBG - txtY ** SA98G.revTXT) * SA98G.scaleWoB;
  return (sapc > -SA98G.loClip ? 0 : sapc + SA98G.loWoBoffset) * 100;
}
// Mistura alpha do texto sobre o fundo (como alphaBlend do apca-w3, com arredondamento a 8 bits).
export function blend(fg, alpha, bg) {
  return fg.map((c, i) => Math.round((bg[i] * (1 - alpha) + clamp(c) * alpha) * 255) / 255);
}
export function apcaLc(fgRgb, bgRgb, fgAlpha = 1) {
  const fg = fgAlpha < 1 ? blend(fgRgb, fgAlpha, bgRgb) : fgRgb;
  return apcaContrast(apcaY(fg), apcaY(bgRgb));
}
// Níveis de uso APCA ("APCA in a Nutshell", modo Bronze simplificado).
export const APCA_LEVELS = [
  { lc: 90, uso: 'preferido para texto corrido (>=18px/300 ou >=14px/400)' },
  { lc: 75, uso: 'mínimo para texto corrido (>=24px/300, 18px/400, 16px/500, 14px/700)' },
  { lc: 60, uso: 'mínimo para texto de conteúdo que não é corrido (>=16px/700, 24px/400 ou 48px/200)' },
  { lc: 45, uso: 'mínimo para texto grande e pesado (>=36px/400 ou 24px/700), títulos' },
  { lc: 30, uso: 'mínimo absoluto para texto "spot" (placeholder, disabled) e ícones/UI' },
  { lc: 15, uso: 'mínimo para elementos não textuais distinguíveis (>=5px), sem semântica' },
];
export function apcaUse(lc) {
  const a = Math.abs(lc);
  const hit = APCA_LEVELS.find((l) => a >= l.lc);
  return hit ? { nivel: hit.lc, uso: hit.uso } : { nivel: 0, uso: 'insuficiente para qualquer uso (abaixo de Lc 15)' };
}

// Atalho: cor de entrada -> objeto normalizado (com gamut mapping para sRGB)
export function normalize(input) {
  const p = parseColor(input);
  let rgb = p.rgb;
  let clipped = false;
  if (!inGamut(rgb)) {
    const lch = p.oklch || srgbToOklch(rgb);
    const gm = gamutMapOklch(lch);
    rgb = gm.rgb; clipped = true;
  }
  rgb = rgb.map((c) => clamp(c));
  return { input: typeof input === 'string' ? input : JSON.stringify(input), rgb, alpha: p.alpha, hex: toHex(rgb, p.alpha), oklch: srgbToOklch(rgb), clipped };
}
export { round };
