#!/usr/bin/env node
// gen-image.mjs: gera uma imagem a partir de prompt + referências opcionais + paleta,
// guarda o ficheiro e um sidecar JSON (prompt, modelo, parâmetros, data, hash das referências).
//
// ESTADO: chamadas aos fornecedores NÃO TESTADAS (sem chaves no ambiente em 2026-10-02).
// Testado: parsing de argumentos, --dry-run, montagem do pedido, sidecar, quantização local (--quantize).
//
// Fornecedores:
//   gemini  (predefinido)  GEMINI_API_KEY   modelo predefinido: gemini-3.1-flash-image (Nano Banana 2; até 3 refs de estilo, 4 de personagem, 10 de objeto)
//   openai                 OPENAI_API_KEY   modelo predefinido: gpt-image-2.5-flare (refs via /v1/images/edits)
//   recraft                RECRAFT_API_KEY  modelo predefinido: recraftv4_1 (ou recraftv4_1_vector com --vector; aceita --style-id)
// IDs de modelo lidos na documentação oficial a 2026-10-02; confirmar antes de usar, mudam depressa.
//
// Uso:
//   node tools/gen-image.mjs --prompt "..." [--provider gemini|openai|recraft] [--model ID]
//     [--ref a.png --ref b.png] [--palette "#1d3557,#e63946,#f1faee"] [--quantize]
//     [--aspect 1:1|16:9|...] [--size 1024x1024 | 1K|2K|4K para gemini] [--style-id UUID] [--vector]
//     [--background transparent (openai)] [--seed N] [--n 1] [--out caminho/sem-extensao] [--project nome] [--dry-run]
//   Criar estilo Recraft a partir de referências aprovadas (devolve style_id):
//   node tools/gen-image.mjs --provider recraft --create-style --ref a.png --ref b.png [--style digital_illustration]
//
// Com --project nome, lê projects/<nome>/estilo/prompt-base.txt (se existir) e antepõe-no ao prompt,
// e lê projects/<nome>/estilo/parametros.json (se existir) como valores predefinidos.

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pastaProjeto, caminhoDoProjeto, destinoNovo } from './lib/projeto.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // fileURLToPath: a pasta tem espaços (com .pathname ficava %20 e --project nunca era lido)

function parseArgs(argv) {
  const a = { ref: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) continue;
    const key = k.slice(2);
    const flags = ['dry-run', 'quantize', 'vector', 'help', 'create-style'];
    if (flags.includes(key)) { a[key] = true; continue; }
    const v = argv[++i];
    if (key === 'ref') a.ref.push(v); else a[key] = v;
  }
  return a;
}

const exists = async (p) => access(p).then(() => true).catch(() => false);
const mimeOf = (p) => ({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[path.extname(p).toLowerCase()] || 'application/octet-stream');
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 16);

function parsePalette(s) {
  if (!s) return [];
  const list = s.split(/[,\s]+/).filter(Boolean).map((c) => c.startsWith('#') ? c : `#${c}`);
  for (const c of list) if (!/^#[0-9a-fA-F]{6}$/.test(c)) throw new Error(`Cor inválida na paleta: ${c} (usa #rrggbb)`);
  return list;
}
const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

function paletteClause(pal) {
  if (!pal.length) return '';
  return `\n\nColor constraint: use only these flat colors, no other hues, no gradients unless built from them: ${pal.join(', ')}.`;
}

async function loadProject(name) {
  if (!name) return { base: '', params: {} };
  const dir = path.join(pastaProjeto(ROOT, name), 'estilo');
  const basePath = path.join(dir, 'prompt-base.txt');
  const paramsPath = path.join(dir, 'parametros.json');
  const base = (await exists(basePath)) ? (await readFile(basePath, 'utf8')).trim() : '';
  const params = (await exists(paramsPath)) ? JSON.parse(await readFile(paramsPath, 'utf8')) : {};
  return { base, params, dir };
}

// ---------- fornecedores ----------

async function callGemini({ model, prompt, refs, aspect, size, key }) {
  const parts = [{ text: prompt }];
  for (const r of refs) parts.push({ inline_data: { mime_type: r.mime, data: r.buf.toString('base64') } });
  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { ...(aspect ? { aspectRatio: aspect } : {}), ...(/^[124]K$/.test(size || '') ? { imageSize: size } : {}) } },
  };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  return {
    request: { url, body: redactB64(body) },
    run: async () => {
      const res = await fetch(url, { method: 'POST', headers: { 'x-goog-api-key': key, 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
      const out = [];
      for (const p of json.candidates?.[0]?.content?.parts ?? []) {
        const d = p.inlineData || p.inline_data;
        if (d?.data) out.push({ buf: Buffer.from(d.data, 'base64'), ext: (d.mimeType || d.mime_type || 'image/png').split('/')[1] });
      }
      if (!out.length) throw new Error(`Gemini sem imagem na resposta: ${JSON.stringify(json).slice(0, 500)}`);
      return out;
    },
  };
}

async function callOpenAI({ model, prompt, refs, size, n, key, background }) {
  const edit = refs.length > 0;
  const url = `https://api.openai.com/v1/images/${edit ? 'edits' : 'generations'}`;
  const params = { model, prompt, size: size || '1024x1024', n: Number(n || 1), ...(background ? { background, output_format: 'png' } : {}) };
  return {
    request: { url, body: { ...params, image: refs.map((r) => r.name) } },
    run: async () => {
      let res;
      if (edit) {
        const fd = new FormData();
        for (const [k, v] of Object.entries(params)) fd.append(k, String(v));
        for (const r of refs) fd.append('image[]', new Blob([r.buf], { type: r.mime }), r.name);
        res = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${key}` }, body: fd });
      } else {
        res = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify(params) });
      }
      const json = await res.json();
      if (!res.ok) throw new Error(`OpenAI ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
      return json.data.map((d) => ({ buf: Buffer.from(d.b64_json, 'base64'), ext: 'png' }));
    },
  };
}

async function callRecraft({ model, prompt, size, n, key, styleId, style, vector, palette }) {
  const url = 'https://external.api.recraft.ai/v1/images/generations';
  const body = { prompt, model, n: Number(n || 1), size: size || '1024x1024', response_format: 'b64_json' };
  if (styleId) body.style_id = styleId; else if (style) body.style = style;
  if (palette.length) body.controls = { colors: palette.map((h) => ({ rgb: hexToRgb(h) })) };
  return {
    request: { url, body },
    run: async () => {
      const res = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(`Recraft ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
      return json.data.map((d) => ({ buf: Buffer.from(d.b64_json, 'base64'), ext: vector ? 'svg' : 'webp' }));
    },
  };
}

function redactB64(body) {
  return JSON.parse(JSON.stringify(body, (k, v) => (k === 'data' && typeof v === 'string' && v.length > 64 ? `<base64 ${v.length} chars>` : v)));
}

// Quantização à paleta do projeto via ImageMagick (sem dithering). Devolve caminho do ficheiro gerado.
function quantize(file, palette) {
  const tmp = mkdtempSync(path.join(tmpdir(), 'paleta-')); // ficheiro auxiliar fora da pasta de saída
  const palFile = path.join(tmp, 'paleta.png');
  const args = ['-size', '1x1'];
  for (const c of palette) args.push(`xc:${c}`);
  args.push('+append', palFile);
  execFileSync('magick', args);
  const out = destinoNovo(file.replace(/\.[^.]+$/, '.quant.png'));
  try { execFileSync('magick', [file, '-alpha', 'on', '-dither', 'None', '-remap', palFile, out]); } finally { rmSync(tmp, { recursive: true, force: true }); }
  return out;
}

// Cria um estilo Recraft privado a partir de até 10 imagens (POST /v1/styles). NÃO TESTADO.
async function createRecraftStyle(a) {
  const key = process.env.RECRAFT_API_KEY;
  if (!a.ref.length || a.ref.length > 10) throw new Error('--create-style exige 1 a 10 --ref');
  const fd = new FormData();
  fd.append('style', a.style || 'digital_illustration');
  for (const [i, r] of a.ref.entries()) {
    const buf = await readFile(path.resolve(r));
    fd.append(`file${i + 1}`, new Blob([buf], { type: mimeOf(r) }), path.basename(r));
  }
  if (a['dry-run']) return console.log(JSON.stringify({ url: 'https://external.api.recraft.ai/v1/styles', style: a.style || 'digital_illustration', files: a.ref }, null, 2));
  if (!key) throw new Error('Falta a variável de ambiente RECRAFT_API_KEY.');
  const res = await fetch('https://external.api.recraft.ai/v1/styles', { method: 'POST', headers: { authorization: `Bearer ${key}` }, body: fd });
  const json = await res.json();
  if (!res.ok) throw new Error(`Recraft ${res.status}: ${JSON.stringify(json).slice(0, 500)}`);
  console.log(JSON.stringify(json));
}

// ---------- main ----------

const HELP = `Uso: node tools/gen-image.mjs --prompt "..." [--provider gemini|openai|recraft] [--ref img]... [--palette "#hex,#hex"] [--quantize] [--project nome] [--out base] [--dry-run]
Quantizar uma imagem existente sem gerar: node tools/gen-image.mjs --quantize-only img.png --palette "#hex,..."`;

async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (a.help) return console.log(HELP);

  if (a['quantize-only']) {
    const pal = parsePalette(a.palette);
    if (!pal.length) throw new Error('--quantize-only exige --palette');
    return console.log(quantize(path.resolve(a['quantize-only']), pal));
  }

  const proj = await loadProject(a.project);
  // ref e out do parametros.json são dados do projeto: só valem dentro da pasta do projeto (os da linha de comandos ficam livres)
  const projRefs = [].concat(proj.params.ref || []).map((r) => caminhoDoProjeto(ROOT, a.project, r, 'ref'));
  const projOut = proj.params.out ? caminhoDoProjeto(ROOT, a.project, proj.params.out, 'out') : undefined;
  const p = { ...proj.params, ...(projOut ? { out: projOut } : {}), ...a };
  if (a['create-style']) return createRecraftStyle(a);
  if (!p.prompt) throw new Error('Falta --prompt. ' + HELP);

  const provider = p.provider || 'gemini';
  const defaults = { gemini: 'gemini-3.1-flash-image', openai: 'gpt-image-2.5-flare', recraft: p.vector ? 'recraftv4_1_vector' : 'recraftv4_1' };
  const envKey = { gemini: 'GEMINI_API_KEY', openai: 'OPENAI_API_KEY', recraft: 'RECRAFT_API_KEY' }[provider];
  if (!envKey) throw new Error(`Fornecedor desconhecido: ${provider}`);
  const model = p.model || defaults[provider];
  const palette = parsePalette(p.palette);
  const refPaths = [...projRefs, ...a.ref.map((r) => path.resolve(r))];
  const refs = await Promise.all(refPaths.map(async (rp) => {
    const buf = await readFile(rp);
    return { path: rp, name: path.basename(rp), mime: mimeOf(rp), buf, sha256: sha256(buf) };
  }));
  if (provider === 'recraft' && refs.length) console.error('Aviso: Recraft usa --style-id (estilo criado a partir das referências), as --ref são ignoradas neste pedido.');

  const fullPrompt = [proj.base, p.prompt].filter(Boolean).join('\n\n') + (provider === 'recraft' ? '' : paletteClause(palette));
  const key = process.env[envKey];
  const args = { model, prompt: fullPrompt, refs, aspect: p.aspect, size: p.size, n: p.n, key, styleId: p['style-id'], style: p.style, vector: !!p.vector, palette, background: p.background };
  const call = await ({ gemini: callGemini, openai: callOpenAI, recraft: callRecraft }[provider])(args);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = path.resolve(p.out || path.join('out', `${provider}-${stamp}`));
  await mkdir(path.dirname(base), { recursive: true });

  const sidecar = {
    tool: 'tools/gen-image.mjs', version: 1, date: new Date().toISOString(),
    provider, model, project: a.project || null,
    prompt_user: p.prompt, prompt_base: proj.base || null, prompt_full: fullPrompt,
    params: { aspect: p.aspect || null, size: p.size || null, background: p.background || null, n: Number(p.n || 1), seed: p.seed ?? null, style_id: p['style-id'] || null, vector: !!p.vector, quantize: !!p.quantize },
    palette, references: refs.map((r) => ({ path: path.relative(ROOT, r.path), sha256: r.sha256 })),
    request: call.request, outputs: [], tested_provider_call: false,
  };

  // escritas só para destinos novos ('wx' recusa ficheiro existente e ligação simbólica); verifica-se antes de gastar a chamada paga
  if (p['dry-run']) {
    await writeFile(destinoNovo(`${base}.dryrun.json`), JSON.stringify(sidecar, null, 2), { flag: 'wx' });
    return console.log(`dry-run: ${base}.dryrun.json`);
  }
  if (!key) throw new Error(`Falta a variável de ambiente ${envKey}.`);
  destinoNovo(`${base}.json`);
  for (const ext of ['png', 'jpg', 'webp', 'svg']) destinoNovo(`${base}.${ext}`);

  const images = await call.run();
  for (const [i, img] of images.entries()) {
    const file = `${base}${images.length > 1 ? `-${i + 1}` : ''}.${img.ext}`;
    await writeFile(destinoNovo(file), img.buf, { flag: 'wx' });
    const entry = { file: path.relative(ROOT, file), sha256: sha256(img.buf) };
    if (p.quantize && palette.length && img.ext !== 'svg') entry.quantized = path.relative(ROOT, quantize(file, palette));
    sidecar.outputs.push(entry);
  }
  sidecar.tested_provider_call = true;
  await writeFile(`${base}.json`, JSON.stringify(sidecar, null, 2), { flag: 'wx' });
  console.log(JSON.stringify(sidecar.outputs, null, 2));
}

main().catch((e) => { console.error(e.message); process.exit(1); });
