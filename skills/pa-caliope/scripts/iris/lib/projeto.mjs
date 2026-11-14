// Validação de nomes de projeto e de caminhos que vêm de ficheiros de projeto (estilo/parametros.json).
// Os ficheiros de um projeto são dados: não podem fazer uma ferramenta ler ou escrever fora da pasta do projeto.
import { existsSync, lstatSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, basename, sep } from 'node:path';

// Nomes aceites: minha-marca, loja.pt, Evento_2026. Sem barras, sem "..", sem começar por ponto.
export function validarNomeProjeto(nome) {
  if (typeof nome !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(nome) || nome.includes('..')) {
    throw new Error(`Nome de projeto inválido: ${JSON.stringify(nome)} (só letras, números, ".", "_" e "-"; sem barras nem "..").`);
  }
  return nome;
}

export function pastaProjeto(root, nome) {
  validarNomeProjeto(nome);
  const dir = join(root, 'projects', nome);
  if (!dentro(join(root, 'projects'), dir)) throw new Error(`Projeto fora de projects/: ${nome}`);
  return dir;
}

// caminho real (resolve symlinks); se ainda não existe, resolve a pasta mais próxima que existe
function real(p) {
  let atual = resolve(p); const resto = [];
  while (!existsSync(atual)) { resto.unshift(basename(atual)); const pai = dirname(atual); if (pai === atual) break; atual = pai; }
  return join(realpathSync(atual), ...resto);
}

export function dentro(base, p) {
  const rel = relative(real(base), real(p));
  return rel === '' || (rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel));
}

// caminho vindo de um ficheiro do projeto: relativo à pasta do projeto (ex.: "estilo/referencias/aprovadas/a.png") e tem de cair dentro dela
export function caminhoDoProjeto(root, nome, p, campo) {
  const dir = pastaProjeto(root, nome);
  if (typeof p !== 'string' || !p) throw new Error(`${campo} do parametros.json inválido: ${JSON.stringify(p)}`);
  const abs = isAbsolute(p) ? p : resolve(dir, p);
  if (!dentro(dir, abs)) throw new Error(`${campo} do parametros.json fora do projeto ${nome}: ${p}`);
  return abs;
}

// destino de escrita tem de ser novo: recusa ficheiro existente e ligação simbólica (mesmo partida), que a escrita seguiria
export function destinoNovo(p) {
  let st = null; try { st = lstatSync(p); } catch { /* não existe: ok */ }
  if (st) throw new Error(`${st.isSymbolicLink() ? 'O destino é uma ligação simbólica' : 'O destino já existe'}: ${p}. Gera sempre para um ficheiro novo.`);
  return p;
}
