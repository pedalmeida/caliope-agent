# 2026-10-04: armadilhas do codex-image em lote

- Em zsh os arrays começam em 1: `refs[$((i%4))]` deu referência vazia em 1 de cada 4 chamadas (EISDIR). Usar bash explícito ou índices 1-based.
- Se o ficheiro de destino já existe, o Codex pode limitar-se a devolver o caminho (3 s, sem gerar). Apagar ou mudar o nome do destino antes de regenerar.
- Num lote de 6 em paralelo, uma geração saiu como folha de contacto das outras imagens da pasta. Gerar para uma pasta só com o ficheiro de destino, ou pedir "draw a new image; do not reuse existing files".
- 27 gerações numa sessão esgotaram a quota do Codex (reposição em cerca de 2 h).

## 2026-10-13: codex exec em segundo plano fica preso
Lançado à mão com `&` numa shell sem terminal, o `codex exec` escreve "Reading additional input from stdin..." e espera para sempre. Redirecionar sempre `< /dev/null`. O `tools/codex-image.mjs` não sofre disto (usa spawnSync). Para usar a foto de uma pessoa como referência de semelhança, chamar o codex diretamente: o script descreve todas as `--ref` como referências de estilo.

## 2026-10-13: animar um gesto sem gerar vários fotogramas
Gerar fotogramas separados muda a cara entre eles. Melhor: gerar uma pose (ex.: a acenar), recortar a parte que mexe com uma máscara, rodá-la à volta da articulação com `magick -distort SRT "x,y 1 ângulo"` e compor sobre o resto. ±11° esconde bem a junção no pulso; ±13° já mostra a quebra da linha.

## 2026-10-13: Codex vs Nano Banana Pro (fal) num retrato em linha com manchas
Mesmo prompt, foto mais 2 referências de um projeto. O Codex respeitou melhor as manchas parciais e a semelhança. O Nano Banana Pro (0,15 USD/imagem) encheu as roupas de cor e deixou o cabelo vazio (lê-se grisalho). Para este estilo, a fal não compensa.

## 2026-10-18: halo branco com --transparent
Em composições com muito vazio (sobretudo `--size landscape`), o Codex devolveu um halo branco semitransparente à volta das figuras (cerca de 3% dos píxeis com alpha parcial). Pedir "no glow, no halo" no prompt não chegou. Correção pós-geração que preserva a linha e os pontos escuros: píxeis com 0 < alpha < 235 e luminância média > 150 passam a alpha 0. Verificar sempre compondo sobre fundo escuro, porque sobre branco o halo é invisível.

## 2026-10-18: nota de processo (não é do Codex)
Em Python, `open(f, 'w').write(transformar(open(f).read()))` apaga o ficheiro antes de o ler: o `open(f, 'w')` é avaliado primeiro e trunca. Ler sempre para uma variável e só depois abrir para escrita.
