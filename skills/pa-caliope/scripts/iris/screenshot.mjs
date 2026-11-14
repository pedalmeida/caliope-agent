#!/usr/bin/env node
// screenshot.mjs: capturas de uma URL (ou ficheiro HTML local) em vários viewports, com tema claro/escuro,
// reduced motion e página inteira. Usa Playwright instalado localmente em tools/ (ver tools/README.md).
import { mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { cli, fail, table } from './lib/cli.mjs';

const DEFAULT_VIEWPORTS = '390x844,768x1024,1280x800,1440x900';
const HELP = `
screenshot.mjs: capturas de ecrã de uma página em vários viewports.

Uso:
  node tools/screenshot.mjs <url|ficheiro.html> [opções]

Opções:
  --viewports <lista>   larguraxaltura separados por vírgulas (por defeito ${DEFAULT_VIEWPORTS})
  --dark                tema escuro (prefers-color-scheme: dark)
  --theme <t>           light (por defeito) | dark | both (gera os dois)
  --reduced-motion      prefers-reduced-motion: reduce
  --full-page           página inteira (por defeito só a área visível). Antes de capturar percorre a página
                        vista a vista, para disparar lazy-load e reveals ao scroll, e volta ao topo
  --scroll-wait <ms>    espera em cada vista ao percorrer (por defeito 400; 0 não percorre)
  --out <pasta>         pasta de saída (por defeito ./screenshots)
  --name <prefixo>      prefixo dos ficheiros (por defeito derivado da URL)
  --dpr <n>             device pixel ratio (por defeito 1; 2 para inspecionar nitidez)
  --wait <ms>           espera extra depois de carregar (por defeito 300)
  --wait-for <seletor>  espera até este seletor estar visível
  --no-mobile           não emula dispositivo móvel (por defeito: largura < 600 usa isMobile + touch)
  --channel <c>         usa um browser instalado em vez do Chromium do Playwright (ex. chrome)
  --timeout <ms>        timeout de navegação (por defeito 30000)
  --transparent         PNG com fundo transparente (a página tem de ter html e body sem fundo)
  --json                saída JSON (ficheiros, título, overflow horizontal, erros de consola)
  -h, --help            esta ajuda

Nomes de ficheiro (previsíveis):
  <prefixo>_<largura>x<altura>_<light|dark>[_rm][_full][@<dpr>x].png
  ex.: localhost-3000_390x844_dark_rm_full.png

Também regista, por viewport: overflow horizontal (scrollWidth > largura), erros de consola e de página.

Instalação (uma vez, local a tools/):
  cd tools && npm run setup
  (equivale a: npm install && npx playwright install chromium)

Exemplos:
  node tools/screenshot.mjs http://localhost:3000 --theme both --full-page
  node tools/screenshot.mjs tools/test/fixtures/page.html --viewports 390x844 --dark --reduced-motion --out /tmp/shots
`;

const { values: o, positionals } = cli({
  viewports: { type: 'string' }, dark: { type: 'boolean' }, theme: { type: 'string' }, 'reduced-motion': { type: 'boolean' },
  'full-page': { type: 'boolean' }, out: { type: 'string' }, name: { type: 'string' }, dpr: { type: 'string' },
  wait: { type: 'string' }, 'wait-for': { type: 'string' }, 'no-mobile': { type: 'boolean' }, channel: { type: 'string' },
  timeout: { type: 'string' }, transparent: { type: 'boolean' }, 'scroll-wait': { type: 'string' },
}, HELP);

if (positionals.length !== 1) fail('indica uma URL ou ficheiro HTML. Ver --help.');
let target = positionals[0];
if (!/^[a-z]+:\/\//i.test(target)) {
  const [ficheiro, ...resto] = target.split('?');
  if (existsSync(ficheiro)) target = pathToFileURL(resolve(ficheiro)).href + (resto.length ? '?' + resto.join('?') : '');
  else if (/^(localhost|127\.|[\w-]+\.[\w.-]+)(:\d+)?(\/|$)/.test(target)) target = 'http://' + target;
  else fail(`não encontrei o ficheiro nem parece uma URL: ${target}`);
}

const viewports = (o.viewports || DEFAULT_VIEWPORTS).split(',').map((v) => {
  const m = v.trim().match(/^(\d+)x(\d+)$/);
  if (!m) fail(`viewport inválido "${v}" (formato 390x844)`);
  return { width: +m[1], height: +m[2] };
});
const theme = o.dark ? 'dark' : o.theme || 'light';
if (!['light', 'dark', 'both'].includes(theme)) fail(`--theme inválido: ${theme}`);
const themes = theme === 'both' ? ['light', 'dark'] : [theme];
const dpr = Number(o.dpr || 1);
const wait = Number(o.wait ?? 300);
const timeout = Number(o.timeout || 30000);
const scrollWait = Number(o['scroll-wait'] ?? 400);
if (!(dpr > 0) || !(wait >= 0) || !(timeout > 0) || !(scrollWait >= 0)) fail('valor numérico inválido em --dpr, --wait, --timeout ou --scroll-wait');
const outDir = resolve(o.out || 'screenshots');

function slug(u) {
  try {
    const url = new URL(u);
    const raw = url.protocol === 'file:' ? url.pathname.split('/').pop().replace(/\.[^.]+$/, '') : `${url.host}${url.pathname}`;
    return raw.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'pagina';
  } catch { return 'pagina'; }
}
const prefix = o.name || slug(target);

let playwright;
try {
  playwright = await import('playwright');
} catch {
  fail(`Playwright não está instalado em tools/.
Instala localmente (não global):
  cd "${fileURLToPath(new URL('.', import.meta.url))}" && npm run setup
ou, sem package.json:
  npm install --prefix tools playwright && npx --prefix tools playwright install chromium`);
}
const { chromium } = playwright;

async function launch() {
  if (o.channel) return chromium.launch({ channel: o.channel });
  try {
    return await chromium.launch();
  } catch (e) {
    if (/Executable doesn't exist|playwright install/i.test(e.message)) {
      process.stderr.write('aviso: Chromium do Playwright não instalado; a tentar o Google Chrome do sistema (--channel chrome).\n' +
        '        Para instalar: cd tools && npx playwright install chromium\n');
      return chromium.launch({ channel: 'chrome' });
    }
    throw e;
  }
}

mkdirSync(outDir, { recursive: true });
const browser = await launch().catch((e) => fail(`não consegui abrir o browser: ${e.message.split('\n')[0]}`));
const results = [];
try {
  for (const th of themes) {
    for (const vp of viewports) {
      const mobile = !o['no-mobile'] && vp.width < 600;
      const context = await browser.newContext({
        viewport: vp, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile,
        colorScheme: th, reducedMotion: o['reduced-motion'] ? 'reduce' : 'no-preference',
      });
      const page = await context.newPage();
      const consola = [];
      page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) consola.push(`${m.type()}: ${m.text()}`); });
      page.on('pageerror', (e) => consola.push(`pageerror: ${e.message}`));
      let status = null, erro = null;
      try {
        const resp = await page.goto(target, { waitUntil: 'networkidle', timeout });
        status = resp ? resp.status() : null;
        if (o['wait-for']) await page.waitForSelector(o['wait-for'], { state: 'visible', timeout });
        await page.evaluate(() => document.fonts && document.fonts.ready);
        if (wait) await page.waitForTimeout(wait);
        // O fullPage nativo não faz scroll: sem isto, imagens lazy e secções com reveal saem vazias.
        if (o['full-page'] && scrollWait) {
          let y = 0;
          for (let i = 0; i < 60; i++) {
            const altura = await page.evaluate(() => document.documentElement.scrollHeight);
            if (y >= altura - vp.height) break;
            y += Math.round(vp.height * 0.8);
            await page.evaluate((top) => window.scrollTo(0, top), y);
            await page.waitForTimeout(scrollWait);
          }
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.waitForLoadState('networkidle', { timeout }).catch(() => {});
          await page.waitForTimeout(scrollWait);
        }
      } catch (e) { erro = e.message.split('\n')[0]; }
      const file = join(outDir, `${prefix}_${vp.width}x${vp.height}_${th}${o['reduced-motion'] ? '_rm' : ''}${o['full-page'] ? '_full' : ''}${dpr !== 1 ? `@${dpr}x` : ''}.png`);
      let metrics = {};
      if (!erro) {
        await page.screenshot({ path: file, fullPage: !!o['full-page'], animations: o['reduced-motion'] ? 'disabled' : 'allow', omitBackground: !!o.transparent });
        metrics = await page.evaluate(() => ({
          titulo: document.title,
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
          clientWidth: document.documentElement.clientWidth,
        }));
      }
      results.push({
        ficheiro: erro ? null : file, viewport: `${vp.width}x${vp.height}`, tema: th, movimentoReduzido: !!o['reduced-motion'],
        paginaInteira: !!o['full-page'], dpr, mobile, status, erro,
        titulo: metrics.titulo, alturaDocumento: metrics.scrollHeight,
        overflowHorizontal: metrics.scrollWidth > metrics.clientWidth ? metrics.scrollWidth - metrics.clientWidth : 0,
        consola,
      });
      await context.close();
    }
  }
} finally {
  await browser.close();
}

if (o.json) console.log(JSON.stringify({ url: target, capturas: results }, null, 2));
else {
  console.log(`${target}\n`);
  console.log(table(results.map((r) => [
    r.viewport, r.tema, r.erro ? `ERRO: ${r.erro}` : r.ficheiro, r.status ?? '-',
    r.overflowHorizontal ? `${r.overflowHorizontal}px` : 'não', r.consola.length,
  ]), ['viewport', 'tema', 'ficheiro', 'HTTP', 'overflow horiz.', 'erros consola']));
  const msgs = [...new Set(results.flatMap((r) => r.consola))];
  if (msgs.length) console.log('\nConsola:\n' + msgs.map((m) => '  ' + m).join('\n'));
}
process.exit(results.some((r) => r.erro) ? 1 : 0);
