// Utilitários de CLI partilhados (sem dependências: usa node:util parseArgs).
import { parseArgs } from 'node:util';

export function cli(options, help, argv = process.argv.slice(2)) {
  let parsed;
  try {
    parsed = parseArgs({ args: argv, options: { help: { type: 'boolean', short: 'h' }, json: { type: 'boolean' }, ...options }, allowPositionals: true, strict: true });
  } catch (e) {
    fail(`${e.message.replace(/^.*?: /, '')}\nUsa --help para ver as opções.`);
  }
  if (parsed.values.help) { process.stdout.write(help.trimStart() + '\n'); process.exit(0); }
  return parsed;
}

export function fail(msg, code = 2) {
  process.stderr.write(`erro: ${msg}\n`);
  process.exit(code);
}

// Tabela de texto alinhada (ignora códigos ANSI no cálculo da largura).
const strip = (s) => String(s).replace(/\x1b\[[0-9;]*m/g, '');
export function table(rows, header) {
  const all = header ? [header, ...rows] : rows;
  const w = all[0].map((_, i) => Math.max(...all.map((r) => strip(r[i] ?? '').length)));
  const line = (r) => r.map((c, i) => String(c ?? '') + ' '.repeat(w[i] - strip(c ?? '').length)).join('  ').trimEnd();
  const out = all.map(line);
  if (header) out.splice(1, 0, w.map((n) => '-'.repeat(n)).join('  ').trimEnd());
  return out.join('\n');
}

// Amostra de cor no terminal (truecolor), desligada se não for TTY ou com NO_COLOR.
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
export function swatch(rgb) {
  if (!useColor) return '';
  const [r, g, b] = rgb.map((c) => Math.round(c * 255));
  return `\x1b[48;2;${r};${g};${b}m    \x1b[0m`;
}
export const ok = (b) => (b ? 'passa' : 'falha');
