# Ferramentas da Íris

Scripts de linha de comandos para cor, tipografia, tokens, capturas de ecrã, imagens e SVG. Todos têm `--help`, saída legível por defeito e `--json` para uso por agentes. As mensagens estão em português de Portugal.

Só `screenshot.mjs` tem dependências (Playwright). As restantes ferramentas Node usam apenas a biblioteca padrão; `image-audit.py` usa Pillow.

| Ferramenta | Para que serve | Dependências | Exemplo mínimo |
|---|---|---|---|
| `contrast.mjs` | Rácio WCAG 2.x e Lc APCA entre pares ou numa matriz de paleta, com passa/falha AA/AAA/UI e uso APCA recomendado | nenhuma | `node tools/contrast.mjs "#777" "#fff"` |
| `palette.mjs` | Rampa tonal OKLCH (50-950 ou n passos) a partir de uma semente, ajustada ao gamut sRGB, com contraste contra branco e preto; saída tabela, CSS ou DTCG | nenhuma | `node tools/palette.mjs "#2563eb" --format css` |
| `typescale.mjs` | Escala modular em rem, `clamp()` fluido entre dois viewports, line-heights sugeridos | nenhuma | `node tools/typescale.mjs --ratio major-third` |
| `tokens.mjs` | DTCG 2025.10 para CSS custom properties: aliases, `$ref`, `$root`, `$extends`, ciclos, modo escuro, `--lint` | nenhuma | `node tools/tokens.mjs tokens.json --lint` |
| `screenshot.mjs` | Capturas de uma URL ou ficheiro HTML em vários viewports, claro/escuro, reduced motion, página inteira; regista overflow horizontal e erros de consola | Playwright (local) | `node tools/screenshot.mjs http://localhost:3000 --theme both` |
| `padroes-gastos.mjs` | Deteta na página renderizada os 28 padrões gastos (Lucide, emojis, vidro, travessões, Inter/Geist, 3 cartões, bento, terminal, "não é X, é Y", demo em falta, roxo e preto, orbs, pontos, sparkles, setas e hover animados, arco-íris, texto em gradiente, pílula, eyebrows, hero centrado, zigzag, cabeçalho partido, prova social, fade-up, marquee, palavra a palavra, CTA duplicado), com evidência | Playwright (local) | `node tools/padroes-gastos.mjs https://example.com` |
| `image-audit.py` | Dimensões, formato, modo, alpha real, peso, cores dominantes, avisos de formato, tamanho e @2x | Python 3.9+, Pillow | `python3 tools/image-audit.py assets/` |
| `recorte/` | Recorta o sujeito de uma foto para PNG transparente com a segmentação do macOS Vision. Ver `recorte/README.md` | macOS 14+, swiftc | `tools/recorte/recorte foto.jpg recorte.png` |
| `svg-check.mjs` | viewBox, width/height, stroke-width, cores fixas vs currentColor, ids, lixo de editores, riscos; render PNG | `rsvg-convert` só para `--render` | `node tools/svg-check.mjs icons/*.svg --icon --grid 24` |
| `fonte/` (`traco.py`, `construir.py`, `especime.py`) | Cria fontes monoline/manuscritas proprietárias a partir de esqueletos de traço: tremor de caneta, expansão, potrace, OTF + WOFF2, features OpenType (calt, kern), página de espécime. Ver `skills/criar-fonte` | `uv` (fonttools, brotli, pillow), `potrace` | `uv run -q --python 3.12 --with fonttools --with brotli --with pillow python tools/fonte/construir.py <glifos.py>` |
| `blender.mjs` (+ `blender/`) | Executor de assets 3D no Blender sem janela: constrói a partir de um `.py` com `construir(ctx)`, renderiza frente, lado, 3/4 e cima com câmaras de pose conhecida, grelha 2x2, GLB e `inspecao.json` (caixas, contactos, chão, triângulos, cores). Peças e materiais toon em `blender/iris3d.py` | Blender 5.x, ffmpeg | `node tools/blender.mjs asset.py` |
| `codex-image.mjs` | Geração de imagem pelo image_gen do Codex CLI (subscrição ChatGPT, sem API key), com referências de estilo, paleta, transparência e sidecar JSON. Motor por defeito. Testado a 2026-10-03 | Codex autenticado | `node tools/codex-image.mjs --help` |
| `fal.mjs` | Cliente fal.ai com travão de custos: `price` e `search` grátis; `run` só mostra a estimativa sem `--yes`; regista gastos em `registo/fal-gastos.csv` | `FAL_KEY` em `.env` | `node tools/fal.mjs --help` |
| `gen-image.mjs` | Geração de imagem por API (Gemini, OpenAI, Recraft) com referências, paleta, quantização e sidecar JSON. Chamadas aos fornecedores ainda não testadas: não havia chaves. Pipeline em `docs/ilustracao/pipeline-de-consistencia.md` | `GEMINI_API_KEY`, `OPENAI_API_KEY` ou `RECRAFT_API_KEY` | `node tools/gen-image.mjs --help` |

Estrutura interna: `lib/color.mjs` (conversões de cor, WCAG, APCA), `lib/dtcg.mjs` (leitura e validação DTCG), `lib/cli.mjs` (argumentos e tabelas), `test/` (testes e fixtures).

## Instalação

Nada a instalar para `contrast`, `palette`, `typescale`, `tokens` e `svg-check` (Node 20+; testado com Node 26).

`screenshot.mjs`, uma vez, dentro de `tools/` (nada é instalado globalmente com npm):

```sh
cd "tools" && npm run setup     # npm install + npx playwright install chromium
```

O pacote `playwright` (1.63.0, fixado em `package.json`) fica em `tools/node_modules` (cerca de 18 MB). O Chromium vai para a cache partilhada do Playwright (`~/Library/Caches/ms-playwright` no macOS). Nesta máquina a revisão necessária (chromium-1243, Chrome for Testing 153) já existia na cache, por isso não houve download. Para manter o browser dentro de `tools/`, instala com `PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium` e corre o script com a mesma variável. Se o Chromium do Playwright faltar, o script tenta o Google Chrome instalado (`--channel chrome`) e avisa.

`image-audit.py`: `python3 -m pip install --user Pillow` se faltar. `svg-check.mjs --render`: `brew install librsvg` para ter `rsvg-convert`.

## contrast.mjs

```sh
node tools/contrast.mjs "#777" "#fff"                                  # um par (texto, fundo)
node tools/contrast.mjs "oklch(55% 0.2 260)" white "#fff" "#1a1a1a"    # vários pares
node tools/contrast.mjs --matrix "#0b1f33" "#1d4ed8" "#e2e8f0" "#fff" --min aa
node tools/contrast.mjs --palette tokens.json --bg "#fff,#0b0b0b" --json
node tools/contrast.mjs "#6b7280" "#fff" --assert aa                   # exit 1 se falhar
```

Saída de exemplo:

```
texto  fundo  WCAG    AA     AA grande  AAA    AAA grande  UI 3:1  APCA      uso APCA recomendado
#777   #fff   4.48:1  falha  passa      falha  falha       passa   Lc 71.1   mínimo para texto de conteúdo que não é corrido (...)
```

- Aceita `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()`, `hsl()`, `oklch()`, `oklab()`, `color(srgb ...)` e os 148 nomes CSS.
- `--palette` aceita um array JSON, um objeto `{nome: cor}` ou um ficheiro DTCG (usa todos os tokens de cor, com aliases resolvidos).
- A ordem conta no APCA: texto primeiro. Lc negativo significa texto claro sobre fundo escuro.
- Texto com alpha é misturado sobre o fundo antes do cálculo (como o `alphaBlend` do apca-w3). Fundo com alpha é recusado.
- Limiares WCAG sem arredondamento: 4.48 falha 4.5. Texto grande: 24px ou 18.66px bold.
- Níveis APCA usados para o "uso recomendado": Lc 90, 75, 60, 45, 30, 15, segundo "APCA in a Nutshell" (modo Bronze simplificado). Não aplica a tabela completa de tamanho/peso por fonte.

## palette.mjs

```sh
node tools/palette.mjs "#2563eb"                                   # tabela com contraste
node tools/palette.mjs "oklch(65% 0.19 145)" --name success --format css
node tools/palette.mjs "#64748b" --name neutral --chroma 0.6 --format dtcg > neutral.tokens.json
node tools/palette.mjs "#facc15" --name warning --hue-shift -20     # amarelos escuros ficam menos "oliva"
```

Método (heurística própria, ajustável):

1. Semente em OKLCH.
2. Luminosidade de `--lmax` 0.975 a `--lmin` 0.26 com curva `t^1.15` (passos mais finos nos claros). Por defeito a curva é deformada para que a semente coincida exatamente com o passo de L mais próxima (`--no-anchor` desliga).
3. Chroma relativa: a fração da chroma máxima sRGB que a semente usa em (L, H) é aplicada a cada passo, sem ultrapassar a chroma da semente.
4. Gamut mapping por bisseção da chroma, mantendo L e H.

A tabela mostra, por passo, o rácio WCAG contra branco e preto, o Lc da cor como texto sobre branco e sobre preto, e se o texto sobre a cor deve ser branco ou preto. A saída DTCG usa `colorSpace: "oklch"` com `hex` de fallback e passa no `tokens.mjs --lint` (verificado nos testes).

## typescale.mjs

```sh
node tools/typescale.mjs --base 16 --ratio major-third
node tools/typescale.mjs --base 16 --ratio 1.2 --max-base 18 --max-ratio 1.333 --format css
node tools/typescale.mjs --base 15 --ratio 1.25 --up 6 --down 1 --lh-grid 4 --json
```

Saída CSS de exemplo (fluido entre 360px e 1280px):

```css
--font-size-base: clamp(1rem, 0.9511rem + 0.2174vw, 1.125rem);
--font-size-4xl: clamp(2.4883rem, 1.6093rem + 3.907vw, 4.7348rem);
```

- Razões com nome: minor-second 1.067, major-second 1.125, minor-third 1.2, major-third 1.25, perfect-fourth 1.333, augmented-fourth 1.414, perfect-fifth 1.5, golden 1.618.
- O valor preferido do `clamp()` é `rem + vw`, para que o zoom continue a escalar o texto. Avisa quando max/min de um passo passa 2.5 (verificar zoom a 200%, WCAG 1.4.4) e quando um tamanho fica abaixo de 12px.
- Line-height sugerido é uma heurística: `1 + 8/px`, limitado a [1.1, 1.6]. `--lh-grid` arredonda a altura de linha a uma grelha em px.

## tokens.mjs

```sh
node tools/tokens.mjs tokens/base.json tokens/semantic.json --prefix ds
node tools/tokens.mjs tokens.json --dark tokens.dark.json --dark-selector '[data-theme="dark"]' --out tokens.css
node tools/tokens.mjs tokens.json --keep-refs                 # aliases como var(--alvo)
node tools/tokens.mjs tokens.json --lint --json
```

Suportado, de acordo com o Design Tokens Format Module 2025.10:

- `$value`, `$type` com herança do grupo mais próximo, `$description`, `$deprecated` (vira comentário no CSS), `$extensions`.
- Aliases `{grupo.token}`, inclusive dentro de valores compostos; JSON Pointer `{"$ref": "#/grupo/token/$value/components/0"}`.
- `$root` (referido como `{grupo.$root}`, emitido como `--grupo`), `$extends` em grupos (e o equivalente `$ref` ao nível do grupo).
- Cor como `{colorSpace, components, alpha?, hex?}`. Conversão própria para `srgb`, `srgb-linear`, `hsl`, `oklab`, `oklch`; outros espaços saem como `color(display-p3 ...)`, `lab()` ou `lch()` no modo `--color auto`, e usam o `hex` de fallback quando é preciso converter.
- Tipos: color, dimension, duration, number, fontFamily, fontWeight (palavras-chave mapeadas para números), cubicBezier, strokeStyle, border, transition, shadow (incluindo `inset` e listas), gradient (sai como lista de paragens, para usar dentro de `linear-gradient()`), typography (expandido em `-font-family`, `-font-size`, `-font-weight`, `-letter-spacing`, `-line-height`).
- Modo escuro: o segundo ficheiro é fundido por cima dos ficheiros base; saem os tokens definidos nele e todos os aliases cujo valor resolvido muda por consequência (ex. `button.background -> semantic.primary -> color.blue.500`).

`--lint` reporta (erro, exit 1): ciclos, referências partidas, nomes com `{`, `}` ou `.`, `$type` desconhecido, `colorSpace` inválido, componentes fora de [0,1], `hex` que não corresponde aos componentes, dimensões com unidade diferente de px/rem, cubicBezier com x fora de [0,1], compostos sem as propriedades obrigatórias. Avisos: cor em string (formato anterior a 2025.10), tipo indeterminado, propriedades `$` desconhecidas, nomes que só diferem em maiúsculas, uso de tokens obsoletos, referências embutidas em texto.

## screenshot.mjs

```sh
node tools/screenshot.mjs http://localhost:3000 --theme both --full-page
node tools/screenshot.mjs tools/test/fixtures/page.html --viewports 390x844 --dark --reduced-motion --dpr 2 --out /tmp/shots
node tools/screenshot.mjs localhost:5173/settings --wait-for "[data-ready]" --json
```

- Viewports por defeito: 390x844, 768x1024, 1280x800, 1440x900. Larguras abaixo de 600px emulam móvel (`isMobile`, touch); `--no-mobile` desliga.
- `--transparent` grava o PNG com fundo transparente (a página não pode pintar fundo em `html` e `body`). Ficheiros locais aceitam query string (`pagina.html?x=1`).
- Nomes previsíveis: `<prefixo>_<L>x<A>_<light|dark>[_rm][_full][@<dpr>x].png`, ex. `localhost-3000_390x844_dark_rm_full.png`. O prefixo vem da URL (ou `--name`).
- Espera `networkidle`, `document.fonts.ready` e mais `--wait` ms (300 por defeito). Com `--reduced-motion` também desliga animações CSS no momento da captura.
- Por captura regista estado HTTP, título, altura do documento, overflow horizontal em px e mensagens de erro/aviso da consola. Exit 1 se alguma navegação falhar.

## image-audit.py

```sh
python3 tools/image-audit.py assets/hero.png
python3 tools/image-audit.py assets/ --display-width 600 --json
```

Por imagem: formato, modo, dimensões, proporção, MP, peso, bits por píxel, frames, canal alpha e transparência real (percentagem de píxeis não opacos), perfil ICC, orientação EXIF, cores únicas aproximadas e cores dominantes (median cut sobre miniatura, tons quase iguais fundidos, píxeis transparentes ignorados).

Avisos e dicas: PNG fotográfico sem transparência (sugere JPEG/WebP/AVIF), canal alpha inútil, JPEG com poucas cores (sugere PNG/WebP lossless/SVG), GIF animado, CMYK, 16 bits, perfil não sRGB, orientação EXIF, maior lado acima de `--max-dim` (2560), peso acima de `--max-bytes` (500 KB), compressão pouco agressiva, falta de variante `@2x`, `@2x` com dimensões que não são o dobro da 1x, resolução insuficiente ou excessiva para `--display-width`.

## svg-check.mjs

```sh
node tools/svg-check.mjs icons/*.svg --icon --grid 24
node tools/svg-check.mjs ilustracao.svg --render /tmp/render --sizes 64,256 --bg "#ffffff"
```

Verifica viewBox (erro se faltar), width/height e coerência de proporção, stroke-width por ficheiro e no conjunto, cores fixas vs `currentColor`, ids duplicados (erro) e não referenciados, `<metadata>`, comentários, namespaces e atributos de Inkscape/Sodipodi/Illustrator/Sketch/Figma, `<g>` vazios ou redundantes, números com 4+ casas decimais, `<script>` e atributos `on*` (erro), `<foreignObject>`, href externo, raster embutido, `<title>`/`aria-*`, tamanho em bytes e gzip. `--icon` acrescenta regras de ícone (viewBox quadrado, `currentColor`). `--render` gera PNG com `rsvg-convert` em vários tamanhos, substituindo `currentColor` por `--color` (#111111 por defeito).

O parser é um tokenizador por expressões regulares: serve para SVG de editores e de bibliotecas de ícones, mas não valida XML.

## Testes

```sh
cd tools && npm test        # node --test test/*.test.mjs
```

38 testes, todos a passar em 2026-10-02 (Node 26.0.0, Python 3.9.6, Pillow 11.3.0, Playwright 1.63.0, macOS).

| Área | O que se verifica |
|---|---|
| WCAG 2 | `#777`/`#fff` = 4.4776 (falha AA), `#767676`/`#fff` passa 4.5, preto/branco = 21, simetria |
| APCA | Os 9 vetores oficiais de `apca-w3/test/index.js` (ex. `#888` sobre `#fff` = Lc 63.056469930209424, `#fff` sobre `#888` = -68.541, `#0006` sobre `#fff` = 54.622), com tolerância 1e-9 |
| OKLCH | `#ff0000` = oklch(0.62796 0.25768 29.23) (ver nota em Fontes); branco L=1 C=0; ida e volta sRGB/OKLCH preserva o hex; `rgb()`, `hsl()`, `oklch()`, `color()` e nomes dão o mesmo vermelho |
| Gamut | `oklch(0.7 0.37 150)` é mapeada mantendo L e H, e +0.002 de chroma já sai de sRGB |
| palette | 11 passos, semente preservada, L monótona; saída DTCG passa no lint e converte para CSS |
| typescale | o `clamp()` dá exatamente o tamanho mínimo a 360px e o máximo a 1280px |
| tokens | `$root`, `$extends`, `$ref`, compostos, modo escuro com aliases indiretos; lint apanha 11 tipos de problema no fixture `tokens.broken.json` |
| svg-check | ícone limpo sem avisos; ícone de Inkscape com erros (viewBox, ids duplicados, `onclick`) e avisos; render PNG |
| image-audit | PNG fotográfico, alpha real, cor dominante exata, `@2x` incoerente |
| screenshot | ficheiro local em 2 viewports, escuro + reduced motion, nomes previsíveis, overflow detetado, erro de consola capturado |
| todas | `--help` sai com 0 |

## Limitações

- APCA: implementa o contraste (0.0.98G-4g) e os níveis simplificados; não aplica a tabela de lookup por tamanho e peso de fonte, nem as variantes Display P3 do apca-w3. O APCA continua em beta e não é requisito normativo; para conformidade legal conta o WCAG 2.x.
- Cores fora de sRGB são mapeadas por redução de chroma (simples). Não implementa o algoritmo de gamut mapping descrito no CSS Color 4, por isso o resultado pode diferir ligeiramente do que um browser mostra.
- `tokens.mjs` não converte display-p3, lab, lch, hwb, a98-rgb, prophoto-rgb, rec2020 nem xyz por conta própria: emite a função CSS nativa ou usa o `hex` de fallback. Não gera `@property`, nem formatos para outras plataformas (para isso, Style Dictionary).
- A curva da paleta e o line-height da escala são heurísticas, não normas. Validar no contexto (fonte, marca, conteúdo).
- `screenshot.mjs` só usa Chromium (ou Chrome do sistema). Páginas com animações em JavaScript podem precisar de `--wait` ou `--wait-for`.
- Com `--full-page`, o `screenshot.mjs` percorre a página vista a vista antes de capturar (`--scroll-wait`, 400 ms por defeito). Sem isso, secções com reveal ao scroll saíam em branco (testado a 2026-10-21; as imagens `loading=lazy` carregavam nos dois casos).
- `svg-check.mjs` não otimiza (não substitui o SVGO), só diagnostica.

## Fontes

Consultadas a 2026-10-02.

- APCA-W3, código e constantes 0.0.98G-4g, biblioteca 0.1.9: https://github.com/Myndex/apca-w3 (`src/apca-w3.js`, `README.md`, `test/index.js`)
- APCA in a Nutshell (níveis Lc por uso): https://git.apcacontrast.com/documentation/APCA_in_a_Nutshell.html
- Design Tokens Format Module 2025.10: https://www.designtokens.org/tr/2025.10/format/
- Design Tokens Color Module 2025.10: https://www.designtokens.org/tr/2025.10/color/
- WCAG 2.2, definições de relative luminance (limiar 0.04045, coeficientes 0.2126/0.7152/0.0722), contrast ratio e large scale text: https://www.w3.org/TR/WCAG22/
- OKLab, matrizes de conversão de Björn Ottosson (copiadas tal como publicadas): https://bottosson.github.io/posts/oklab/
- Playwright: versão 1.63.0 e revisão do Chromium (1243) confirmadas localmente com `npm view playwright version` e `npx playwright install --dry-run chromium`, não na documentação web.

Não confirmado nesta sessão: o valor oklch de referência de `#ff0000` usado nos testes foi calculado com as matrizes acima e coincide com o valor habitualmente citado (0.628 0.2577 29.23), mas não foi conferido numa fonte publicada.

## cena3d.mjs (2026-11-07)
Renderiza uma página HTML (three.js, canvas, CSS) para PNG, frames ou MP4, com relógio controlado (sem quadros perdidos). A página define `window.cena = { pronto, desenhar(t) }`. three.js fixo em `node_modules/three` (0.170.0), importado por `/tools/node_modules/three/...` (a raiz servida é o estúdio). Precisa de Playwright e ffmpeg.
```bash
node tools/cena3d.mjs pagina.html --png saida.png --t 1.5
node tools/cena3d.mjs pagina.html --mp4 saida.mp4 --dur 6 --fps 30 [--hash claro] [--size 1080x1920]
```
Cores exatas com MeshToonMaterial: luz ambiente + direcional a somar π (o three divide por π desde a r155), luz quase de frente.

## Blender (2026-11-07)
Blender 5.2.3 LTS instalado por Homebrew (`brew install --cask blender`). Binário: `/Applications/Blender.app/Contents/MacOS/Blender`. Correr sempre sem janela, por script: `Blender -b -P script.py -- <args>`. Teste em `tools/blender/teste.py` (cubo com bisel, `eevee`, `cycles` ou `workbench`).
Medido num Mac M4 com 32 GB, 800x800: EEVEE 4,7 s na primeira vez e 1,0 s depois; Cycles por Metal (GPU de 10 núcleos) a 64 amostras, 131 s na primeira vez (compila os kernels Metal, uma vez só) e 3,5 s depois. O nome do motor no Blender 5 é `BLENDER_EEVEE` (não `BLENDER_EEVEE_NEXT`). O MCP comunitário do Blender não se usa (ver `reports/Animação 3D para agentes LLM.md`).

### Executor (`blender.mjs`, `blender/executor.py`, `blender/iris3d.py`)
Um asset 3D é um script `.py` que se vai editando e corrigindo, sem nunca o regenerar de raiz. Cada execução produz o que é preciso para o avaliar:
```bash
node tools/blender.mjs projects/<p>/.../asset.py                       # 4 vistas EEVEE 512, grelha, GLB, inspeção (~2 s)
node tools/blender.mjs asset.py --motor workbench --size 256           # mais rápido, cores lisas
node tools/blender.mjs asset.py --vistas tres-quartos --size 1600 --motor cycles --amostras 128 --sem-glb   # final
node tools/blender.mjs asset.py --param tema=escuro                    # parâmetros chegam a construir(ctx)['params']
```
- Contrato: `def construir(ctx)`, com a frente a olhar para -Y e Z para cima; devolve opcionalmente `{'contactos': [[a, b], ...], 'chao': [...], 'ignorar': [prefixos], 'unidade_m': 0.001}`. A saída vai para `<pasta do asset>/runs/<data-hora>/` ou `--out` (nova ou vazia).
- Vistas: `frente`, `lado` (de +X), `cima` e `tras` são ortográficas, com `px_por_unidade`; `tres-quartos` é em perspetiva (35° para a direita e 20° acima, lente de 50 mm). A pose de cada câmara fica no JSON, junto com a caixa 2D de cada objeto em píxeis.
- Inspeção: caixa 3D de cada objeto sem o contorno, contactos (`toca`, `afastado` com a distância, `interseta` com a penetração), assentamento no chão, triângulos e cores hex dos materiais. Os modificadores `contorno*` ficam desligados ao medir.
- `iris3d.py` tem estas peças:
  - `bloco`: um prisma de frente plana e cantos arredondados, com bisel;
  - `tubo`: um tubo ao longo de uma curva quadrática;
  - `esfera`, `cilindro` e `cubo_arredondado`;
  - `svg_fragmento`: passa elementos SVG para malhas planas, e cada traço vira uma fita com pontas redondas;
  - `contorno`: um casco invertido, feito com Solidify;
  - os materiais `material_toon`, `material_plano` e `fundo`.
  Os materiais funcionam por emissão: a face de frente dá a cor exata do token com view transform Standard, que o executor impõe, e EEVEE, Cycles e o three.js dão o mesmo resultado.
- GLB: antes de exportar, os materiais toon passam a Principled com a cor do token. No three.js, troca-se pelo nome (`toon #E2501C` dá `MeshToonMaterial`). O contorno sai de uma face só e funciona como casco invertido sem mais código. Uma página com GLTFLoader que faz esta troca e se renderiza com `cena3d.mjs` chega para ter vídeo do mesmo modelo.
- Armadilhas resolvidas:
  - o importador SVG do Blender converte 1 px em 1/90 de polegada, fecha os caminhos de traço e ignora `stroke`;
  - as malhas convertidas de curvas precisam de normais ponderadas (WeightedNormal, depois do Solidify), senão o toon faz manchas;
  - `bpy.data.objects.new` com um nome ocupado acrescenta `.001`.
- Tempos (Mac M4): mascote com 14 mil triângulos, 4 vistas EEVEE a 512 em 2 s no total; 3/4 em Cycles a 1200 e 64 amostras em 6 s. Testes: `node --test test/blender.test.mjs` (saltam sem Blender).
