// Testes da biblioteca de cor contra valores de referência publicados.
// Correr: cd tools && npm test   (ou: node --test tools/test/)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseColor, normalize, wcagRatio, apcaLc, srgbToOklch, oklchToSrgb, gamutMapOklch, inGamut, toHex,
} from '../lib/color.mjs';

const rgb = (c) => parseColor(c).rgb;
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} esperado ${b}, obtido ${a}`);

test('WCAG 2: #777 sobre #fff = 4.48:1 (falha AA 4.5)', () => {
  const r = wcagRatio(rgb('#777'), rgb('#fff'));
  close(r, 4.4776, 0.0005);
  assert.ok(r < 4.5);
});
test('WCAG 2: preto/branco = 21:1, igual = 1:1, simétrico', () => {
  close(wcagRatio(rgb('#000'), rgb('#fff')), 21, 1e-9);
  close(wcagRatio(rgb('#abc'), rgb('#abc')), 1, 1e-12);
  assert.equal(wcagRatio(rgb('#123456'), rgb('#fedcba')), wcagRatio(rgb('#fedcba'), rgb('#123456')));
});
test('WCAG 2: #767676 sobre #fff passa 4.5 (cinzento mais claro que passa AA)', () => {
  assert.ok(wcagRatio(rgb('#767676'), rgb('#fff')) >= 4.5);
});

// Vetores oficiais de github.com/Myndex/apca-w3 test/index.js (biblioteca 0.1.9, constantes 0.0.98G-4g)
const APCA_VECTORS = [
  ['#888', '#FFF', 63.056469930209424],
  ['#FFF', '#888', -68.54146436644962],
  ['#000', '#aaa', 58.146262578561334],
  ['#aaa', '#000', -56.24113336839742],
  ['#123', '#def', 91.66830811481631],
  ['#def', '#123', -93.06770049484275],
  ['#123', '#444', 8.32326136957393],
  ['#444', '#123', -7.526878460278154],
  ['#0006', '#fff', 54.62184067441377],
];
for (const [txt, bg, lc] of APCA_VECTORS) {
  test(`APCA: ${txt} sobre ${bg} = Lc ${lc.toFixed(3)}`, () => {
    const t = parseColor(txt);
    close(apcaLc(t.rgb, rgb(bg), t.alpha), lc, 1e-9);
  });
}

test('OKLCH: #ff0000 = oklch(0.628 0.2577 29.23)', () => {
  const [L, C, H] = srgbToOklch(rgb('#ff0000'));
  close(L, 0.62796, 0.0001); close(C, 0.25768, 0.0001); close(H, 29.2339, 0.01);
});
test('OKLCH: branco tem L=1 e C~0', () => {
  const [L, C] = srgbToOklch(rgb('#fff'));
  close(L, 1, 1e-6); close(C, 0, 1e-6);
});
test('OKLCH: ida e volta sRGB -> OKLCH -> sRGB preserva hex', () => {
  for (const hex of ['#2563eb', '#facc15', '#16a34a', '#111827', '#f3f4f6', '#e11d48']) {
    assert.equal(toHex(oklchToSrgb(srgbToOklch(rgb(hex)))), hex);
  }
});
test('Parsing: rgb(), hsl(), oklch() e nomes CSS dão o mesmo vermelho', () => {
  for (const c of ['rgb(255 0 0)', 'rgb(255, 0, 0)', 'hsl(0 100% 50%)', 'red', 'oklch(62.796% 0.25768 29.2339)', 'color(srgb 1 0 0)']) {
    assert.equal(normalize(c).hex, '#ff0000', c);
  }
});
test('Gamut mapping: mantém L e H, reduz C até caber em sRGB', () => {
  const src = [0.7, 0.37, 150];
  assert.ok(!inGamut(oklchToSrgb(src)));
  const { lch, rgb: out, clipped } = gamutMapOklch(src);
  assert.ok(clipped);
  assert.equal(lch[0], 0.7); assert.equal(lch[2], 150);
  assert.ok(lch[1] < 0.37 && lch[1] > 0.1);
  assert.ok(inGamut(out));
  // ligeiramente mais chroma já sai de gamut: a redução é mínima
  assert.ok(!inGamut(oklchToSrgb([0.7, lch[1] + 0.002, 150])));
});
