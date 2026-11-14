#!/usr/bin/env node
// padroes-gastos.mjs: deteta numa página renderizada os padrões visuais e de copy gastos pelo uso em massa
// (lista base e extras, 2026-10-21). Não julga: reporta com evidência para se decidir se a rota é assumida ou se varia.
// Critérios, exceções e alternativas em docs/avaliacao-ux-ui/padroes-gastos.md.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { cli, fail, table } from './lib/cli.mjs';

const HELP = `
padroes-gastos.mjs: deteta padrões gastos numa página renderizada e mostra a evidência.

Uso:
  node tools/padroes-gastos.mjs <url|ficheiro.html> [opções]

Opções:
  --viewport <LxA>      viewport (por defeito 1440x900)
  --dark                tema escuro
  --wait <ms>           espera extra depois de carregar (por defeito 600)
  --channel <c>         browser instalado em vez do Chromium do Playwright (ex. chrome)
  --json                saída JSON
  -h, --help            esta ajuda

Estados por padrão:
  sim   detetado com evidência no DOM, CSS ou texto
  ver   indício fraco: confirmar na captura
  não   nada encontrado (não prova ausência: hover e páginas internas não são percorridos)

Percorre a página até ao fim antes de analisar, para disparar reveals e lazy-load.
Só lê a página de entrada: correr em cada página relevante.
`;

const { values: o, positionals } = cli({
  viewport: { type: 'string' }, dark: { type: 'boolean' }, wait: { type: 'string' }, channel: { type: 'string' },
}, HELP);

if (positionals.length !== 1) fail('indica uma URL ou ficheiro HTML. Ver --help.');
let target = positionals[0];
if (!/^[a-z]+:\/\//i.test(target)) {
  if (existsSync(target)) target = pathToFileURL(resolve(target)).href;
  else if (/^(localhost|127\.|[\w-]+\.[\w.-]+)(:\d+)?(\/|$)/.test(target)) target = 'http://' + target;
  else fail(`não encontrei o ficheiro nem parece uma URL: ${target}`);
}
const m = (o.viewport || '1440x900').match(/^(\d+)x(\d+)$/);
if (!m) fail('viewport inválido (formato 1440x900)');
const viewport = { width: +m[1], height: +m[2] };
const wait = Number(o.wait ?? 600);

let playwright;
try { playwright = await import('playwright'); } catch {
  fail(`Playwright não está instalado em tools/. Instala com: cd "${fileURLToPath(new URL('.', import.meta.url))}" && npm run setup`);
}
const { chromium } = playwright;
const browser = await (o.channel ? chromium.launch({ channel: o.channel }) : chromium.launch().catch(() => chromium.launch({ channel: 'chrome' })))
  .catch((e) => fail(`não consegui abrir o browser: ${e.message.split('\n')[0]}`));

let res;
try {
  const page = await (await browser.newContext({ viewport, colorScheme: o.dark ? 'dark' : 'light' })).newPage();
  await page.goto(target, { waitUntil: 'networkidle', timeout: 30000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  // Antes de percorrer: marcar o que está escondido abaixo da dobra, para saber depois o que só aparece com o scroll.
  await page.evaluate(() => {
    for (const el of document.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.top < innerHeight || r.width < 40 || r.height < 20) continue;
      const cs = getComputedStyle(el);
      if (+cs.opacity < 0.1 || cs.visibility === 'hidden') el.setAttribute('data-pg-oculto', '');
    }
  });
  for (let y = 0, i = 0; i < 60; i++) {
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    if (y >= h - viewport.height) break;
    y += Math.round(viewport.height * 0.8);
    await page.evaluate((t) => window.scrollTo(0, t), y);
    await page.waitForTimeout(250);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  if (wait) await page.waitForTimeout(wait);
  res = await page.evaluate(analisar);
} catch (e) {
  await browser.close();
  fail(`falhou a análise: ${e.message.split('\n')[0]}`);
}
await browser.close();

if (o.json) console.log(JSON.stringify({ url: target, viewport: `${viewport.width}x${viewport.height}`, padroes: res }, null, 2));
else {
  console.log(`${target} (${viewport.width}x${viewport.height})\n`);
  console.log(table(res.map((r) => [r.n, r.nome, r.estado, r.resumo]), ['#', 'padrão', 'estado', 'evidência']));
  const det = res.filter((r) => r.exemplos.length);
  if (det.length) {
    console.log('\nExemplos:');
    for (const r of det) console.log(`  ${r.n}. ${r.nome}\n` + r.exemplos.slice(0, 4).map((e) => `     - ${e}`).join('\n'));
  }
  console.log('\nCritérios e alternativas: docs/avaliacao-ux-ui/padroes-gastos.md');
}

// Corre dentro da página. Tem de ser autossuficiente.
function analisar() {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05;
  };
  const desc = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const c = (typeof el.className === 'string' ? el.className : el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 3);
    if (c.length) s += '.' + c.join('.');
    return s.slice(0, 70);
  };
  const corta = (t, n = 90) => (t.length > n ? t.slice(0, n - 3) + '...' : t);
  const todos = [...document.body.querySelectorAll('*')].filter((el) => !['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(el.tagName));
  const visiveis = todos.filter(vis);
  const estilos = new Map(visiveis.map((el) => [el, getComputedStyle(el)]));

  // Texto visível, por nó
  const textos = [];
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeValue.trim() && n.parentElement && vis(n.parentElement) && !['SCRIPT', 'STYLE'].includes(n.parentElement.tagName) ? 1 : 2),
  });
  while (tw.nextNode()) textos.push(tw.currentNode);
  const textoTodo = textos.map((n) => n.nodeValue).join(' ').replace(/\s+/g, ' ');
  const frases = (re) => {
    const out = [];
    for (const n of textos) {
      const t = n.nodeValue.replace(/\s+/g, ' ');
      const mm = t.match(re);
      if (mm) out.push(`"${corta(t.trim())}" em ${desc(n.parentElement)}`);
    }
    return out;
  };

  // Regras CSS (ignora folhas de outra origem, que o browser não deixa ler)
  const regras = [];
  const recolhe = (lista) => {
    for (const r of lista) {
      if (r.cssRules && !r.selectorText) { try { recolhe(r.cssRules); } catch {} }
      else if (r.selectorText) regras.push(r);
    }
  };
  let folhasFechadas = 0;
  for (const s of document.styleSheets) { try { recolhe(s.cssRules); } catch { folhasFechadas++; } }

  // Cor
  const rgb = (s) => { const mm = s && s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/); return mm ? { r: +mm[1], g: +mm[2], b: +mm[3], a: mm[4] === undefined ? 1 : +mm[4] } : null; };
  const hsl = ({ r, g, b }) => {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (!d) return { h: 0, s: 0, l };
    const s = d / (1 - Math.abs(2 * l - 1));
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: (h * 60 + 360) % 360, s, l };
  };
  const roxo = (c) => { if (!c || c.a < 0.3) return false; const x = hsl(c); return x.h >= 250 && x.h <= 320 && x.s > 0.35 && x.l > 0.15 && x.l < 0.85; };
  const coresGrad = (bg) => (bg.match(/rgba?\([^)]+\)/g) || []).map(rgb).filter(Boolean);

  const out = [];
  const add = (n, nome, estado, resumo, exemplos = []) => out.push({ n, nome, estado, resumo, exemplos: [...new Set(exemplos)].slice(0, 8) });

  // 1. Lucide
  const lucide = visiveis.filter((el) => el.tagName.toLowerCase() === 'svg' && (/\blucide\b/.test(el.getAttribute('class') || '') || el.hasAttribute('data-lucide')));
  const nomesLucide = lucide.map((el) => ((el.getAttribute('class') || '').match(/lucide-([\w-]+)/) || [])[1] || el.getAttribute('data-lucide')).filter(Boolean);
  // Assinatura de traço do Lucide/Feather sem classe: viewBox 24, stroke 2, round, sem fill
  const tipoLucide = visiveis.filter((el) => el.tagName.toLowerCase() === 'svg' && !lucide.includes(el) && el.getAttribute('viewBox') === '0 0 24 24' && el.getAttribute('stroke-width') === '2' && el.getAttribute('stroke-linecap') === 'round' && el.getAttribute('fill') === 'none');
  add(1, 'ícones Lucide', lucide.length ? 'sim' : tipoLucide.length ? 'ver' : 'não',
    lucide.length ? `${lucide.length} ícones (${[...new Set(nomesLucide)].length} diferentes)` : tipoLucide.length ? `${tipoLucide.length} SVG com a assinatura Lucide/Feather (24, traço 2, round)` : '',
    [...new Set(nomesLucide)].map((x) => 'lucide-' + x).concat(tipoLucide.slice(0, 3).map(desc)));

  // 2. Emojis (exclui ©, ®, ™ e dígitos com variação)
  const reEmoji = /(?![©®™])\p{Extended_Pictographic}/u;
  const comEmoji = frases(new RegExp(reEmoji.source, 'u'));
  const emojis = [...new Set((textoTodo.match(/(?![©®™])\p{Extended_Pictographic}/gu) || []))];
  add(2, 'emojis', comEmoji.length ? 'sim' : 'não', comEmoji.length ? `${comEmoji.length} textos, ${emojis.join(' ')}` : '', comEmoji);

  // 3. Liquid glass
  const vidro = visiveis.filter((el) => { const cs = estilos.get(el); const f = cs.backdropFilter || cs.webkitBackdropFilter; return f && f !== 'none' && /blur/.test(f); });
  add(3, 'liquid glass (backdrop-filter)', vidro.length ? 'sim' : 'não', vidro.length ? `${vidro.length} superfícies com desfoque do fundo` : '',
    vidro.map((el) => `${desc(el)} (${estilos.get(el).backdropFilter || estilos.get(el).webkitBackdropFilter})`));

  // 4. Travessões
  const em = frases(/—/);
  const enComoEm = frases(/\S – \S/);
  add(4, 'travessões (— ou – entre espaços)', em.length || enComoEm.length ? 'sim' : 'não',
    em.length || enComoEm.length ? `${em.length} com —, ${enComoEm.length} com – a fazer de travessão` : '', [...em, ...enComoEm]);

  // 5. Fontes gastas
  const gastas = /^(inter|inter var|inter display|geist|geist sans|geist mono|space grotesk)$/i;
  const tambem = /^(manrope|poppins|plus jakarta sans|dm sans|instrument serif|fraunces|satoshi|general sans|outfit)$/i;
  const usoFonte = new Map();
  for (const n of textos) {
    const el = n.parentElement, cs = getComputedStyle(el);
    const primeira = cs.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');
    const peso = n.nodeValue.trim().length;
    usoFonte.set(primeira, (usoFonte.get(primeira) || 0) + peso);
  }
  const faces = document.fonts ? [...document.fonts] : [];
  const nome = (f) => f.family.replace(/^["']|["']$/g, '');
  const carregadas = faces.filter((f) => f.status === 'loaded').map(nome), declaradas = faces.map(nome);
  const total = [...usoFonte.values()].reduce((a, b) => a + b, 0) || 1;
  const lista = [...usoFonte.entries()].sort((a, b) => b[1] - a[1]).map(([f, c]) => `${f} ${Math.round((c / total) * 100)}%${carregadas.includes(f) ? '' : declaradas.includes(f) ? ' (declarada mas não carregada: cai no fallback)' : ' (do sistema)'}`);
  const daLista = [...usoFonte.keys()].filter((f) => gastas.test(f) && carregadas.includes(f));
  const outras = [...usoFonte.keys()].filter((f) => tambem.test(f) && carregadas.includes(f));
  add(5, 'Inter, Geist, Space Grotesk', daLista.length ? 'sim' : outras.length ? 'ver' : 'não',
    daLista.length ? daLista.join(', ') : outras.length ? `fora da lista mas também muito usadas: ${outras.join(', ')}` : '', lista.slice(0, 6));

  // Cartões: superfície com fundo, borda ou sombra própria
  const ehCartao = (el) => {
    const cs = estilos.get(el); if (!cs) return false;
    const bg = rgb(cs.backgroundColor), sombra = cs.boxShadow !== 'none', borda = parseFloat(cs.borderTopWidth) > 0 && rgb(cs.borderTopColor)?.a > 0.05;
    return (bg && bg.a > 0.05) || sombra || borda || cs.backgroundImage !== 'none';
  };

  // 6. Três cartões de feature em linha
  const trios = [];
  for (const el of visiveis) {
    const filhos = [...el.children].filter((c) => estilos.has(c));
    if (filhos.length !== 3 && filhos.length !== 6) continue;
    const rs = filhos.map((c) => c.getBoundingClientRect());
    const linha = rs.slice(0, 3);
    if (linha[0].width < 160 || Math.abs(linha[0].top - linha[1].top) > 4 || Math.abs(linha[1].top - linha[2].top) > 4) continue;
    if (Math.max(...linha.map((r) => r.width)) - Math.min(...linha.map((r) => r.width)) > 8) continue;
    if (!filhos.slice(0, 3).every((c) => ehCartao(c) || c.querySelector('svg, img'))) continue;
    if (!filhos.slice(0, 3).every((c) => c.querySelector('h2, h3, h4, strong, b, p'))) continue;
    trios.push(`${desc(el)}: ${filhos.length} itens, "${corta((filhos[0].innerText || '').trim().split('\n')[0], 40)}"...`);
  }
  add(6, '3 cartões de feature em linha', trios.length ? 'sim' : 'não', trios.length ? `${trios.length} grupos` : '', trios);

  // 7. Bento
  const bentos = [];
  for (const el of visiveis) {
    const cs = estilos.get(el);
    if (!/grid/.test(cs.display)) continue;
    const filhos = [...el.children].filter((c) => estilos.has(c));
    if (filhos.length < 4) continue;
    const spans = filhos.filter((c) => { const s = estilos.get(c); return /span\s*[2-9]/.test(s.gridColumnStart + s.gridColumnEnd + s.gridRowStart + s.gridRowEnd); });
    const areas = filhos.map((c) => { const r = c.getBoundingClientRect(); return Math.round(r.width * r.height / 1000); });
    const variados = new Set(areas).size >= 2 && Math.max(...areas) > 1.6 * Math.min(...areas);
    if ((spans.length || variados) && filhos.filter(ehCartao).length >= Math.min(4, filhos.length)) bentos.push(`${desc(el)}: ${filhos.length} células, ${spans.length} com span`);
  }
  add(7, 'bento grid', bentos.length ? 'sim' : 'não', bentos.length ? `${bentos.length} grelhas de cartões com tamanhos variados` : '', bentos);

  // 8. Janela de terminal
  const semaforos = visiveis.filter((el) => {
    const filhos = [...el.children].filter((c) => estilos.has(c));
    if (filhos.length !== 3) return false;
    return filhos.every((c) => { const r = c.getBoundingClientRect(), s = estilos.get(c); return r.width >= 6 && r.width <= 16 && Math.abs(r.width - r.height) < 2 && parseFloat(s.borderTopLeftRadius) >= r.width / 2 - 1; })
      && filhos.map((c) => hsl(rgb(estilos.get(c).backgroundColor) || { r: 0, g: 0, b: 0 }).h).some((h) => h < 20 || h > 340);
  });
  const consolas = visiveis.filter((el) => {
    const cs = estilos.get(el); if (!/mono|courier|menlo|consolas/i.test(cs.fontFamily)) return false;
    const bg = rgb(cs.backgroundColor); if (!bg || bg.a < 0.5 || hsl(bg).l > 0.25) return false;
    return /^\s*[$>❯%]\s|\bnpm |\bnpx |\bpip |\bcurl /m.test(el.innerText || '');
  });
  add(8, 'janela de terminal', semaforos.length || consolas.length ? 'sim' : 'não',
    semaforos.length || consolas.length ? `${semaforos.length} barras com 3 círculos, ${consolas.length} blocos tipo consola` : '', [...semaforos, ...consolas].map(desc));

  // 9. "Não é X, é Y"
  const reNao = [
    /\b(it'?s|this is|we'?re|that'?s)\s+not\s+(just\s+|only\s+)?[^.!?]{1,50}?[,;:.—–-]\s*(it'?s|but|we'?re|this is)\b/i,
    /\bnot\s+(just|only)\s+[^.!?]{1,40}?,?\s+but\b/i,
    /\bnão\s+(é|são|somos)\s+(só\s+|apenas\s+)?[^.!?]{1,50}?[,;:.—–-]\s*(é|são|somos)\b/i,
    /\bnão\s+(só|apenas)\s+[^.!?]{1,40}?,?\s+mas\s+(também\s+)?/i,
    /\bmais do que (um|uma)\s+[^.!?]{1,30}?[,.]\s*(é|um|uma)\b/i,
  ];
  const nao = reNao.flatMap((re) => frases(re));
  add(9, '"não é X, é Y"', nao.length ? 'sim' : 'não', nao.length ? `${nao.length} frases` : '', nao);

  // 10. Sem demo real
  // "Em breve" sozinho é muitas vezes conteúdo legítimo (prazos, títulos por anunciar): só conta como sim ao lado do produto.
  const reFalso = /\b(lorem ipsum|placeholder|screenshot here|product screenshot|captura aqui|imagem aqui|(demo|preview|screenshot|app|produto|captura|vídeo|video)\b[^.]{0,25}\b(coming soon|em breve|brevemente))\b/i;
  const reBreve = /\b(coming soon|em breve|brevemente)\b/i;
  const falsos = frases(reFalso);
  const breve = frases(reBreve).filter((x) => !falsos.includes(x));
  const imgsFalsas = visiveis.filter((el) => el.tagName === 'IMG' && /placehold|placeholder|dummyimage|via\.placeholder|picsum/i.test(el.currentSrc || el.src || '')).map((el) => `img ${corta(el.currentSrc || el.src, 60)}`);
  const imgsProduto = visiveis.filter((el) => (el.tagName === 'IMG' || el.tagName === 'VIDEO') && el.getBoundingClientRect().width > 400);
  const sim10 = falsos.length || imgsFalsas.length;
  add(10, 'sem demo real ("coming soon", placeholder)', sim10 ? 'sim' : breve.length || !imgsProduto.length ? 'ver' : 'não',
    sim10 ? `${falsos.length} textos, ${imgsFalsas.length} imagens de placeholder`
      : breve.length ? `${breve.length} "em breve" sem relação clara com o produto (confirmar)`
      : !imgsProduto.length ? 'nenhuma imagem ou vídeo com mais de 400 px: confirmar se o produto aparece' : '',
    [...falsos, ...imgsFalsas, ...breve]);

  // 11. Roxo e preto
  let areaRoxa = 0, areaEscura = 0, areaTotal = viewport();
  function viewport() { return document.documentElement.scrollWidth * document.documentElement.scrollHeight || 1; }
  const roxos = [];
  for (const el of visiveis) {
    const cs = estilos.get(el), r = el.getBoundingClientRect(), a = r.width * r.height;
    const bg = rgb(cs.backgroundColor);
    if (bg && bg.a > 0.5) { if (roxo(bg)) { areaRoxa += a; roxos.push(`${desc(el)} fundo ${cs.backgroundColor}`); } else if (hsl(bg).l < 0.12 && a > areaTotal * 0.2) areaEscura += a; }
    if (coresGrad(cs.backgroundImage).some(roxo)) { areaRoxa += a; roxos.push(`${desc(el)} gradiente roxo`); }
    if (el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim()) && roxo(rgb(cs.color))) roxos.push(`${desc(el)} texto ${cs.color}`);
  }
  const bodyBg = rgb(getComputedStyle(document.body).backgroundColor), htmlBg = rgb(getComputedStyle(document.documentElement).backgroundColor);
  const fundoEscuro = [bodyBg, htmlBg].some((c) => c && c.a > 0.5 && hsl(c).l < 0.12) || areaEscura > areaTotal * 0.5;
  add(11, 'roxo e preto', fundoEscuro && roxos.length ? 'sim' : roxos.length ? 'ver' : 'não',
    roxos.length ? `${roxos.length} usos de roxo${fundoEscuro ? ' sobre fundo escuro' : ', fundo claro'}` : '', roxos);

  // 12. Orbs radiais e 13. grelha de pontos
  const orbs = [], pontos = [];
  for (const el of visiveis) {
    const cs = estilos.get(el), bi = cs.backgroundImage, r = el.getBoundingClientRect();
    if (/radial-gradient/.test(bi)) {
      const tam = cs.backgroundSize.split(/[ ,]+/).map(parseFloat).filter((x) => !isNaN(x));
      if (/repeat/.test(cs.backgroundRepeat) && tam.length && Math.max(...tam) <= 48) pontos.push(`${desc(el)} radial ${cs.backgroundSize}`);
      else if (r.width > 150 && r.height > 150) orbs.push(`${desc(el)} radial-gradient ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    const filtro = cs.filter;
    if (/blur\((\d+)/.test(filtro) && parseFloat(filtro.match(/blur\(([\d.]+)/)[1]) >= 30 && r.width > 120 && (bi !== 'none' || rgb(cs.backgroundColor)?.a > 0.1))
      orbs.push(`${desc(el)} filter ${filtro} ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  for (const r of regras) if (/background(-image)?/.test(r.cssText) && /radial-gradient/.test(r.cssText) && /background-size:\s*\d{1,2}px/.test(r.cssText) && !pontos.some((p) => p.includes(r.selectorText))) pontos.push(`regra ${corta(r.selectorText, 50)}`);
  add(12, 'orbs radiais', orbs.length ? 'sim' : 'não', orbs.length ? `${orbs.length} manchas de gradiente ou desfoque grandes` : '', orbs);
  add(13, 'grelha de pontos', pontos.length ? 'sim' : 'não', pontos.length ? `${pontos.length} fundos de pontos repetidos` : '', pontos);

  // 14. Brilhos (sparkles)
  const brilhos = [
    ...nomesLucide.filter((x) => /sparkle|stars|wand/.test(x)).map((x) => 'lucide-' + x),
    ...visiveis.filter((el) => /sparkle|stars-icon|magic|wand/i.test((el.getAttribute('class') || '') + ' ' + (el.getAttribute('data-icon') || '') + ' ' + (el.getAttribute('aria-label') || ''))).map(desc),
    ...frases(/[✨✦✧❇]/u),
  ];
  add(14, 'ícones de brilho (sparkles)', brilhos.length ? 'sim' : 'não', brilhos.length ? `${brilhos.length} ocorrências` : '', brilhos);

  // 15. Setas animadas e 16. animações de hover
  const setas = [], hovers = [];
  for (const r of regras) {
    if (!/:hover/.test(r.selectorText)) continue;
    const t = r.style.transform || r.style.translate || r.style.scale || '';
    const muda = t || r.style.boxShadow || r.style.filter;
    if (!muda) continue;
    if (/arrow|chevron|seta|icon|svg|→/i.test(r.selectorText) && /translate/i.test(t + r.style.translate)) setas.push(`${corta(r.selectorText, 60)} { ${t || r.style.translate} }`);
    else hovers.push(`${corta(r.selectorText, 60)} { ${[t, r.style.boxShadow && 'box-shadow', r.style.filter && 'filter'].filter(Boolean).join(', ')} }`);
  }
  for (const el of visiveis) {
    const c = typeof el.className === 'string' ? el.className : el.getAttribute('class') || '';
    if (/group-hover:(-?translate-x|translate-x)/.test(c)) setas.push(`${desc(el)} (Tailwind group-hover:translate-x)`);
    else if (/\bhover:(-?translate|scale|shadow|-?rotate)/.test(c)) hovers.push(`${desc(el)} (Tailwind ${(c.match(/hover:[\w\[\].-]+/) || [''])[0]})`);
  }
  const setasTexto = frases(/[→↗➜➔]\s*$/u);
  add(15, 'setas animadas', setas.length ? 'sim' : setasTexto.length ? 'ver' : 'não',
    setas.length ? `${setas.length} setas que se deslocam no hover` : setasTexto.length ? `${setasTexto.length} botões ou ligações terminados em seta (animação por confirmar)` : '', [...setas, ...setasTexto]);
  add(16, 'animações de hover', hovers.length ? 'sim' : 'não', hovers.length ? `${hovers.length} regras ou elementos que se movem, crescem ou ganham sombra no hover` : '', hovers);

  // 17. Arco-íris
  const arco = [];
  for (const el of visiveis) {
    const cs = estilos.get(el), cores = coresGrad(cs.backgroundImage).filter((c) => c.a > 0.2).map(hsl).filter((x) => x.s > 0.35);
    if (cores.length < 3) continue;
    const hs = cores.map((x) => x.h).sort((a, b) => a - b);
    let maiorBuraco = 360 - hs[hs.length - 1] + hs[0];
    for (let i = 1; i < hs.length; i++) maiorBuraco = Math.max(maiorBuraco, hs[i] - hs[i - 1]);
    if (360 - maiorBuraco >= 150) arco.push(`${desc(el)} ${/text/.test(cs.backgroundClip || cs.webkitBackgroundClip) ? 'texto em gradiente ' : ''}${cores.length} cores, ${Math.round(360 - maiorBuraco)}° de matiz`);
  }
  add(17, 'cor arco-íris', arco.length ? 'sim' : 'não', arco.length ? `${arco.length} gradientes com matizes de mais de 150°` : '', arco);


  // ---- Extras (18 a 28), acrescentados a 2026-10-21 ----
  const titulos = visiveis.filter((el) => /^H[1-3]$/.test(el.tagName));
  const tam = (el) => parseFloat(estilos.get(el)?.fontSize || getComputedStyle(el).fontSize);
  const temTexto = (el) => (el.innerText || '').trim();

  // 18. Texto em gradiente no título
  const gradTexto = visiveis.filter((el) => {
    const cs = estilos.get(el);
    return /text/.test(cs.backgroundClip + ' ' + cs.webkitBackgroundClip) && /gradient/.test(cs.backgroundImage) && tam(el) >= 24 && temTexto(el);
  });
  add(18, 'texto em gradiente no título', gradTexto.length ? 'sim' : 'não', gradTexto.length ? `${gradTexto.length} títulos ou destaques` : '',
    gradTexto.map((el) => `${desc(el)} "${corta(temTexto(el), 40)}"`));

  // 19. Pílula acima do título
  const pilulas = [];
  for (const h of titulos.filter((h) => h.tagName !== 'H3')) {
    const hr = h.getBoundingClientRect();
    const cands = visiveis.filter((el) => {
      if (el.contains(h) || h.contains(el)) return false;
      const r = el.getBoundingClientRect(), cs = estilos.get(el), t = temTexto(el);
      return r.bottom <= hr.top + 2 && hr.top - r.bottom < 48 && r.height >= 18 && r.height <= 44 && r.width < hr.width + 40 && t && t.length <= 60
        && parseFloat(cs.borderTopLeftRadius) >= r.height / 2 - 2 && ehCartao(el);
    });
    if (cands.length) pilulas.push(`"${corta(temTexto(cands[0]), 40)}" acima de ${h.tagName.toLowerCase()} "${corta(temTexto(h), 30)}"`);
  }
  add(19, 'pílula acima do título', pilulas.length ? 'sim' : 'não', pilulas.length ? `${pilulas.length} etiquetas em pílula` : '', pilulas);

  // 20. Eyebrows em maiúsculas espaçadas em todas as secções
  const h2s = titulos.filter((h) => h.tagName === 'H2');
  const eyebrows = [];
  for (const h of h2s) {
    let ant = h.previousElementSibling;
    if (!ant && h.parentElement) ant = h.parentElement.previousElementSibling;
    if (!ant || !estilos.has(ant)) continue;
    const cs = estilos.get(ant), t = temTexto(ant);
    const caps = cs.textTransform === 'uppercase' || (t.length > 2 && t === t.toUpperCase() && /[A-ZÀ-Ý]/.test(t));
    if (caps && t.length <= 40 && tam(ant) <= 15 && parseFloat(cs.letterSpacing) >= 0.04 * tam(ant)) eyebrows.push(`"${t}" acima de "${corta(temTexto(h), 30)}"`);
  }
  const eyeEstado = eyebrows.length >= 3 && eyebrows.length >= h2s.length * 0.5 ? 'sim' : eyebrows.length ? 'ver' : 'não';
  add(20, 'eyebrows em maiúsculas em todas as secções', eyeEstado, eyebrows.length ? `${eyebrows.length} de ${h2s.length} títulos de secção` : '', eyebrows);

  // 21. Hero centrado com gradiente e dois botões
  const h1 = titulos.find((h) => h.tagName === 'H1');
  const ehBotao = (el) => (el.tagName === 'A' || el.tagName === 'BUTTON') && temTexto(el) && (() => { const cs = estilos.get(el); const r = el.getBoundingClientRect(); return cs && r.height >= 32 && (rgb(cs.backgroundColor)?.a > 0.3 || parseFloat(cs.borderTopWidth) > 0); })();
  if (h1) {
    const r = h1.getBoundingClientRect(), centro = Math.abs(r.left + r.width / 2 - innerWidth / 2) < 40 && estilos.get(h1).textAlign === 'center';
    let bloco = h1.parentElement, botoes = [];
    for (let i = 0; i < 3 && bloco; i++, bloco = bloco.parentElement) { botoes = [...bloco.querySelectorAll('a, button')].filter((b) => estilos.has(b) && ehBotao(b)); if (botoes.length >= 2) break; }
    let anc = h1, grad = false;
    while (anc && anc !== document.documentElement) { const cs = getComputedStyle(anc); if (/gradient/.test(cs.backgroundImage)) grad = true; anc = anc.parentElement; }
    grad = grad || gradTexto.includes(h1) || orbs.length > 0;
    const estado = centro && botoes.length >= 2 && r.top < innerHeight ? (grad ? 'sim' : 'ver') : 'não';
    add(21, 'hero centrado, gradiente e dois botões', estado, estado !== 'não' ? `título centrado, ${botoes.length} botões${grad ? ', com gradiente ou luz' : ', sem gradiente'}` : '',
      estado !== 'não' ? [`h1 "${corta(temTexto(h1), 40)}"`, ...botoes.slice(0, 3).map((b) => `botão "${corta(temTexto(b), 30)}"`)] : []);
  } else add(21, 'hero centrado, gradiente e dois botões', 'não', 'sem h1', []);

  // 22. Zigzag e 23. cabeçalho partido sem razão
  const media = (el) => [...el.querySelectorAll('img, video, picture, canvas, svg')].some((m) => { const r = m.getBoundingClientRect(); return r.width >= 200 && r.height >= 120; });
  const divididos = [], partidos = [];
  for (const el of visiveis) {
    const f = [...el.children].filter((c) => estilos.has(c));
    if (f.length !== 2) continue;
    const [a, b] = f.map((c) => c.getBoundingClientRect()), pr = el.getBoundingClientRect();
    if (Math.abs(a.top - b.top) > 60 || a.right > b.left + 4 || a.width < pr.width * 0.25 || b.width < pr.width * 0.25) continue;
    const ma = media(f[0]), mb = media(f[1]);
    if (ma !== mb) { if (f[ma ? 1 : 0].querySelector('h2, h3')) divididos.push({ el, lado: ma ? 'esq' : 'dir', top: pr.top + scrollY }); continue; }
    if (!ma && !mb) {
      const h = f[0].querySelector('h2'), btn = f[1].querySelector('a, button, input, img, svg, ul, table');
      const t1 = temTexto(f[1]);
      if (h && tam(h) >= 28 && !btn && t1 && t1.length < 320 && !f[1].querySelector('h2, h3') && b.height < a.height * 1.3) partidos.push(`${desc(el)}: "${corta(temTexto(h), 30)}" | "${corta(t1, 40)}"`);
    }
  }
  const zz = divididos.filter((d) => !divididos.some((o) => o !== d && o.el.contains(d.el))).sort((x, y) => x.top - y.top);
  let melhor = [], run = [];
  for (const d of zz) { if (run.length && run[run.length - 1].lado === d.lado) run = []; run.push(d); if (run.length > melhor.length) melhor = [...run]; }
  add(22, 'zigzag de imagem e texto', melhor.length >= 3 ? 'sim' : zz.length >= 3 ? 'ver' : 'não',
    melhor.length >= 3 ? `${melhor.length} secções seguidas a alternar lados` : zz.length >= 3 ? `${zz.length} secções imagem e texto, sem alternância contínua` : '', melhor.map((d) => `${desc(d.el)} imagem à ${d.lado === 'esq' ? 'esquerda' : 'direita'}`));
  add(23, 'cabeçalho partido em dois sem razão', partidos.length ? 'ver' : 'não', partidos.length ? `${partidos.length} cabeçalhos com título à esquerda e parágrafo curto à direita (julgar se o segundo lado tem papel)` : '', partidos);

  // 24. Prova social (só se pode confirmar se é real: sempre "ver")
  const reConfianca = /\b(trusted by|loved by|(used|chosen) by (\d|thousands|millions|teams|companies|the best)|join (over )?\d|confiam em nós|já confiam|(usado|escolhido) por (\d|milhares|equipas|empresas))/i;
  const muros = visiveis.filter((el) => {
    const f = [...el.children].filter((c) => estilos.has(c));
    if (f.length < 4 || el.closest('nav, header, footer, [role=navigation], button, a')) return false;
    // Logótipos: só imagem, sem texto visível ao lado (ícones com etiqueta são navegação ou chips)
    const logos = f.filter((c) => { const r = c.getBoundingClientRect(); return r.height <= 90 && r.width >= 40 && (c.matches('img, svg') || (c.querySelector('img, svg') && temTexto(c).length === 0)); });
    return logos.length >= 4 && logos.length >= f.length * 0.7;
  });
  const frasesConf = frases(reConfianca);
  const citacoes = visiveis.filter((el) => el.tagName === 'BLOCKQUOTE' || /\b(testimonial|depoimento|testemunho|review)/i.test(el.getAttribute('class') || '')).filter((el) => !visiveis.some((o) => o !== el && o.contains(el) && /\b(testimonial|depoimento|testemunho|review)/i.test(o.getAttribute('class') || '')));
  const numeros = textos.filter((n) => /^\s*[\d.,]+\s*(k|m|mil|\+|%|×|x)\+?\s*$/i.test(n.nodeValue) && tam(n.parentElement) >= 28).map((n) => `"${n.nodeValue.trim()}" em ${desc(n.parentElement)}`);
  const provas = [...muros.map((el) => `muro de logótipos ${desc(el)}`), ...frasesConf, ...citacoes.map((el) => `testemunho ${desc(el)}`), ...numeros];
  add(24, 'prova social (confirmar que é real)', provas.length ? 'ver' : 'não', provas.length ? `${muros.length} muros de logótipos, ${citacoes.length} testemunhos, ${numeros.length} números grandes, ${frasesConf.length} frases de confiança` : '', provas);

  // 25. Fade-up em todas as secções
  const revelados = [...document.querySelectorAll('[data-pg-oculto]')].filter((el) => vis(el) && !el.parentElement.closest('[data-pg-oculto]'));
  const libs = [document.querySelector('[data-aos]') && 'AOS', window.ScrollTrigger && 'GSAP ScrollTrigger', document.querySelector('[data-sal], [data-scroll]') && 'atributos de scroll'].filter(Boolean);
  add(25, 'fade-up em todas as secções', revelados.length >= 3 ? 'sim' : revelados.length || libs.length ? 'ver' : 'não',
    revelados.length || libs.length ? `${revelados.length} blocos escondidos até ao scroll${libs.length ? ', ' + libs.join(', ') : ''}` : '', revelados.map(desc));

  // 26. Marquee
  const marquees = visiveis.filter((el) => {
    if (el.tagName === 'MARQUEE') return true;
    const cs = estilos.get(el);
    if (cs.animationName === 'none' || !/infinite/.test(cs.animationIterationCount)) return false;
    const r = el.getBoundingClientRect(), p = el.parentElement.getBoundingClientRect();
    return r.width > p.width * 1.4 && r.height < 300;
  });
  add(26, 'marquee', marquees.length ? 'sim' : 'não', marquees.length ? `${marquees.length} faixas em movimento contínuo` : '', marquees.map((el) => `${desc(el)} (${estilos.get(el).animationName || 'marquee'})`));

  // 27. Texto revelado palavra a palavra
  const partidosPal = visiveis.filter((el) => {
    const sp = [...el.children].filter((c) => c.tagName === 'SPAN' || c.tagName === 'DIV');
    if (sp.length < 3 || sp.length < el.children.length * 0.8) return false;
    const umaPal = sp.filter((c) => /^\S{1,30}$/.test(temTexto(c)));
    if (umaPal.length < sp.length * 0.8) return false;
    const c0 = getComputedStyle(sp[0]), cls = sp.map((c) => c.getAttribute('class') || '').join(' ');
    const estiloInline = sp.filter((c) => /transform|opacity|translate|animation/.test(c.getAttribute('style') || '')).length >= sp.length * 0.8;
    return /inline-block|block|flex/.test(c0.display) && (/\b(word|char|split|letter)/i.test(cls) || estiloInline || c0.animationName !== 'none' || c0.transform !== 'none');
  });
  add(27, 'texto revelado palavra a palavra', partidosPal.length ? 'sim' : 'não', partidosPal.length ? `${partidosPal.length} textos partidos em palavras ou letras` : '', partidosPal.map((el) => `${desc(el)} "${corta(temTexto(el).replace(/\s+/g, ' '), 40)}"`));

  // 28. CTA duplicado
  const porDestino = new Map();
  for (const el of visiveis.filter(ehBotao)) {
    const href = el.tagName === 'A' ? el.getAttribute('href') : null;
    if (!href || href === '#' || href.startsWith('javascript')) continue;
    const k = new URL(href, location.href).href.replace(/#.*$/, '');
    if (!porDestino.has(k)) porDestino.set(k, new Set());
    // Variantes do mesmo rótulo (com preço, seta ou separador) contam como um só
    porDestino.get(k).add(temTexto(el).toLowerCase().replace(/[→↗➜➔·|•]/g, ' ').replace(/[€$£]\s*[\d.,]+|[\d.,]+\s*[€$£]|\d+/g, ' ').replace(/\s+/g, ' ').trim());
  }
  const dup = [...porDestino.entries()].filter(([, l]) => l.size >= 2).sort((a, b) => b[1].size - a[1].size);
  add(28, 'CTA duplicado (rótulos diferentes, mesmo destino)', dup.some(([, l]) => l.size >= 3) ? 'sim' : dup.length ? 'ver' : 'não',
    dup.length ? `${dup.length} destinos com mais de um rótulo` : '', dup.map(([k, l]) => `${corta(k.replace(location.origin, '') || '/', 40)}: ${[...l].map((x) => `"${x}"`).join(', ')}`));

  if (folhasFechadas) out.push({ n: '', nome: 'nota', estado: '', resumo: `${folhasFechadas} folhas de estilo de outra origem não lidas: hover e setas podem faltar`, exemplos: [] });
  return out;
}
