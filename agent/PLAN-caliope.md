# Calíope: a designer de IA (generalista desde 2026-10-23; a marca Pedro Almeida é um cliente)

> Estado: plano aprovado em conversa, por executar. Guardado em 2026-10-14 para retomar.
> Decisões fechadas: cenário 2 (designer primeiro, rebrand como produto zero dela); nome Calíope; repensar a identidade da raiz como ecossistema, não como site.

## Estado (2026-10-17)

Fase 0 em curso. Inventário feito em [00-as-is-audit.md](00-as-is-audit.md): 7 sítios com regras visuais, 4 looks diferentes, tensão aberta entre neobrutalismo da v2 e o brief calma/premium. Decisão do Pedro (2026-10-17): calma e premium ganha; o neobrutalismo da v2 só sobrevive peça a peça se justificar o lugar. Falta o Pedro enviar as referências: colar em `taste/references.md`. Pasta renomeada de brand-v3 para caliope em 2026-10-17. Pedro: a longo prazo pode haver `2. Areas/agentes/<nome>/`; secundário.

## Fase 1 (2026-10-17)

Esqueleto da skill `pa-caliope` criado em `~/.agents/skills/pa-caliope` (SKILL.md + agents/openai.yaml), validado e ligado ao Claude. Estado DRAFT: persona e regras por aprovar pelo Pedro. Ainda não existem: adaptador `~/.claude/agents/caliope.md`, adaptador Codex, perfil Hermes, scripts de verificação (contraste, screenshot, paleta). Referências: 6 admiradas, 0 detestadas (Pedro adiou).

## Fase 2 (2026-10-17)

Board com 3 direções x 4 peças reais em `directions/index.html` (A Ledger, B Editorial, C Terminal; gerado por `directions/build.py`). Copy real do site e do carrossel C030; o corpo do email é teste de layout, não copy aprovada. Verificado: render no browser e sem overflow nos 12 quadros; não verificado: mobile, contraste medido, versão dark do site. Falta o Pedro escolher (pode misturar por peça). Depois: Fase 3 (tokens + brand book).

## Fase 2b (2026-10-17)

Pedro escolheu a direção A (Ledger), com pedido: mais personalidade, interação, nuance, mais laranja, fontes próprias, iconografia, ilustrações, fotos IA dele. Nova referência: formulaxn.com. Board `directions/a-v2.html`: hero interativo (strike curious→native, spark segue o cursor, botão magnético, ticker de prova), 8 ícones próprios, linguagem de ilustração "blueprint", 3 candidatas de display (Archivo 62, Big Shoulders Display, Bricolage Grotesque), peças v2 com mais laranja, shot list de 4 fotos IA. Bloqueios: chave 21st (Pedro cria em 21st.dev/mcp e guarda em `~/.agency-secrets/21st.env`), fotos IA correm no Codex (ImageGen) ou Kie. Não verificado: mobile, contraste medido do laranja de fundo com texto ink.

## Mudança de âmbito: designer generalista (2026-10-23)

Pedido do Pedro, depois de usar a Calíope no redesign do Sadhana Intensive Companion: a Calíope deixa de ser "a designer da marca do Pedro" e passa a ser a designer de IA generalista (marca, UI, design gráfico) e o framework de design por defeito de todos os projetos de produto. A marca pessoal do Pedro é um cliente entre outros.

- **Skill reescrita** (`~/.agents/skills/pa-caliope`): princípios agnósticos (contenção, um acento, diferenciar por layout e tipografia, evidência sobre decoração, verificar antes de reportar), método em 7 passos com **passo de referências obrigatório** antes de qualquer decisão (Mobbin, 21st quando instalado, sites de referência do projeto, galerias, uma referência fora da categoria, prática da comunidade), verificação em duas camadas (determinística com `impeccable detect` e contraste medido, depois screenshots por secção em telefone e desktop, de preferência por um subagente de contexto fresco). Usa o Impeccable como chão de craft em vez de duplicar as regras dele.
- **Perfil de marca por projeto**: as regras de marca vivem no projeto (`DESIGN.md` + `PRODUCT.md`), registo em `pa-caliope/references/brand-profiles.md`. As regras específicas do Pedro (lei do laranja, cores deprecadas, regras de 17 out, robertocortez.pt como topo) saíram da skill para [profiles/pedro-almeida.md](profiles/pedro-almeida.md), sem alterações de conteúdo.
- **Produção da marca do Pedro não muda**: `2. Areas/brand-v2/` continua a fonte de verdade até a v3 ser aprovada; deploys continuam por `pa-pedro-web-brand`.
- **Base de evidência**: [research/2026-10-23-design-agents-benchmark.md](research/2026-10-23-design-agents-benchmark.md) (5 canais, ~1,5 USD). O processo de juntar referências ficou embutido no `pa-research` como modo `--referencias`, reutilizável por qualquer skill.
- Backups das duas skills antes da mudança: `~/.agency-os-backups/skills-2026-10-23/`.
- **Ship gate obrigatório** (mesmo dia, feedback do Pedro no Sadhana: "links not working, bad maps, ui that is bland and boring", feedback que não quer voltar a dar). Antes de mostrar ou publicar: QA funcional com `pa-caliope/scripts/qa.py` (375 e 1280 px, todas as rotas; falha em erros JS, páginas vazias, scroll horizontal, links ou botões tapados, links internos mortos, imagens partidas, media que não arranca), revisão das screenshots contra as referências, passe de crítica com os três elementos mais fracos corrigidos ("é útil e tem personalidade?"), superfícies novas começam com 2 a 3 direções em mockup e passam por um path de preview antes de produção; um ecrã de cada vez. Testado num fixture partido (apanha tudo) e no build do Sadhana (passa sem falsos positivos).
- Fase 1 do plano original (adaptadores `.claude/agents/caliope.md`, Codex, Hermes, scripts de verificação além do `qa.py`) continua por fazer; o caminho de skill única mantém-se.

## Moodboard de decisão (2026-10-23)

Pedro pediu um moodboard para decidir com apoio visual. Publicado como artifact privado: https://claude.ai/artifact/5vXMof8gGudMyv5DXv9n9Z (fonte `moodboard/src/build.py`, gera `moodboard/moodboard.html`). 9 decisões: tipo de display, dose de laranja, superfície, marca-símbolo, linguagem de ilustração, tratamento de foto, ícones, nível de movimento, forma. As escolhas ficam na base de dados do artifact em `moodboard/picks` (`choices`, `notes`); ler com ArtifactData antes da Fase 3.

Escolhas do Pedro (lidas 2026-11-10): Bricolage, creme, faixas laranja, formas suaves, foto natural, movimento subtil, mascote, ícones pixel. Marca-símbolo: nenhuma ("podemos fazer melhor").

## Sistema de assinatura (2026-11-10)

Pedro: falta personalizar ícones, ilustração e marca; pixel como base, não como tudo; sofisticado e premium. Referências em `docs/references/2026-11-10-signature-system.md`. Três direções, cada uma com marca, 8 ícones, ilustração com regras e um slide aplicado: A Circuit Trishul (o pendente do avatar, pixel para pessoas e objetos, traços vetoriais com nós; recomendada), B Azulejo Pixel, C Builder's Cursor. Artifact privado https://claude.ai/artifact/93zLFNkSx8LGx5ihf72u8i (fonte `signature/src/build.py`); escolhas em `signature/picks` (`mark`, `icons`, `illustration`, `note`), mistura permitida. Verificado a 1280 e 375 px; `qa.py` e `impeccable detect` não corridos sobre este board.

## Porquê

A brand-v2 (EMBER, Ago 2026) está a funcionar mas não é diferenciada e o Pedro não está convencido dela. Existe deriva: regras visuais em 5 sítios (brand-v2, `pa-pedro-web-brand`, deck-builder vault-v4, content-factory, carousel `look1.css`), a skill web ainda com a paleta antiga no corpo, o `CLAUDE.md` do site a apontar para `~/Downloads`. Falta uma entidade que guarde, aplique e verifique o sistema.

Modelo de referência: o Pedro Ganço (farrusco.pt) construiu primeiro a "Iris" (6 h de skills, tools, refs, regras) e depois fez dois sites em horas. O trabalho a sério é a designer, não o site.

## Atributos da marca (ditos pelo Pedro)

Premium, diferenciação, zero AI slop. Personalidade, profissionalismo, sofisticação, inovação, calma, consistência, criatividade, pensamento fora da caixa. Quando "calma/premium" e "fora da caixa" colidem, ganha calma/premium.

## Fases

| Fase | O que sai | Pedro entra onde |
|---|---|---|
| 0. Gosto | Pasta de referências anotadas (8-12 que admira, 3 que detesta, uma frase cada), lista de proibições, os atributos traduzidos em regras de decisão | Manda referências e reage |
| 1. Esqueleto | Skill `pa-caliope` agnóstica, tools de gerar e verificar (imagem, paleta, contraste, tipografia, screenshot, SVG), persona | Aprova a persona |
| 2. Direções | 3 direções de identidade, cada uma declinada em 4 peças reais: hero do site, slide de carrossel, email, frame de vídeo | Escolhe uma, diz o que fica |
| 3. Sistema | BRAND v3: tokens DTCG, tipografia, componentes, motion, voz visual, mascote | Aprova o brand book |
| 4. Migração | Site, carrosséis, decks, email, vídeo, um de cada vez, todos a consumir uma fonte | Vê cada peça em produção |
| 5. Operação | Calíope no Slack, revê o que os outros motores produzem, auditoria mensal | Oversight |

## Onde vive

Não há formato de persona portável entre Claude (MD+YAML em `.claude/agents/`), Codex (TOML em `~/.codex/agents/`) e Hermes (`SOUL.md` + perfis). O comum é SKILL.md e AGENTS.md. Logo: Calíope é uma skill; a persona vive na skill; cada harness tem um adaptador de 10 linhas.

```
~/.agents/skills/pa-caliope/           fonte única (padrão atual das skills pa-)
  SKILL.md                             persona, método, regras de decisão
  references/                          brand v3, gosto, proibições, refs anotadas
  scripts/                             gen-image, palette, contrast, screenshot, svg-check, tokens
  assets/                              templates das 4 peças de teste
  agents/openai.yaml                   Codex
~/.claude/skills/pa-caliope            symlink
~/.claude/agents/caliope.md            adaptador Claude, `skills: [pa-caliope]`
~/.codex/agents/caliope.toml           adaptador Codex
~/.hermes/profiles/caliope/SOUL.md     adaptador Hermes (só a voz)
```

Gestão pelo `pa-manage-shared-skills`, estado `linked` no `skills:doctor`. Hermes lê pelo espelho horário já existente.

**Slack:** perfil Hermes próprio com bot `@Caliope`, no mesmo `hermes-gateway.service` (multi-perfil oficial, um app por perfil, routing por token). Canal `#design`, menção obrigatória, só o Pedro. Trabalho pesado (renders, migrações) corre no Mac via Claude Code; pedidos rápidos e revisões respondem no Slack pela VPS. Bug aberto no Hermes com bot-para-bot em threads: ela e o Hermeticus não conversam entre si por agora.

Ao criar o perfil e o bot: atualizar `agency/infra/inventario-infra.md`, `agency-os/diagrams/setup-as-is.spec.json`, o registo Notion Systems e o manifesto Slack em `agency/infra/slack/`.

## Tools (pesquisa 2026-10-14)

- Imagem: Codex `$imagegen` (gpt-image-2) para exploração; Recraft para ícones e ilustração em SVG real (estilo custom a partir de 3-5 refs); Nano Banana 2 para mascote (até 14 imagens de referência).
- Tokens: formato DTCG, build com Style Dictionary 5, lint de contraste com `npx @google/design.md lint`. O formato DESIGN.md (Google, Abr 2026) é candidato a formato do brand book: tokens em YAML, rationale em Markdown.
- Verificação: Playwright `toHaveScreenshot` + `@axe-core/playwright`, svglint, SVGO.
- Fonte própria com IA: não para texto de produção; só display ou logótipo, com kerning à mão. Texto: fonte licenciada com carácter.
- Referência de estrutura: `cathrynlavery/diagram-design` (um repo, manifests por host, onboarding por URL, perfis por cliente).

## Tools avaliadas

- [tools/21st-mcp.md](tools/21st-mcp.md): 21st MCP (ex-Magic), componentes React/Tailwind. Avaliado 2026-10-17, não instalado.

## Pontos em aberto

- Referências do Pedro (fase 0) ainda não enviadas.
- Decidir se o brand book v3 usa DESIGN.md ou um BRAND.md como a v2.
- Fonte de texto: escolher e licenciar.
- Destino do spec formal: `docs/superpowers/specs/2026-10-14-caliope-design.md` quando a fase 0 fechar.

## Nomes considerados (para não repetir)

Vitrúvia, Tágide, Lume, Inês, Sagres, Arrábida, Azulejo, Lívia, Minerva, Atena, Pauta, Régua, Traço, Hécate, Métis, Têmis, Aspásia, Hipátia, Octávia, Aurea, Harmonia, Venustas, Firmitas, Utilitas, Forma, Lumen, Ratio, Modus, Linea, Signum, Decor, Opus, Vox, Musa. Escolhido: **Calíope**, a musa chefe, da eloquência e da épica.

## Sistema de assinatura, ronda 2 (2026-11-11)

Pedro: o trishul "looks awkward"; o resto melhor mas precisa de mais personalidade. Mandou referências de carrosséis (gradientes ember, creme, mascote desenhado em cada slide), guardadas em `taste/img/2026-11-11-carousel-refs-*.webp` e notas em `taste/references.md`. Ronda 2: 4 marcas (Signed P a partir da assinatura real + bloco cursor laranja, recomendada; Mascot badge; Trishul redesenhado; Terminal da v2), mascote do Pedro gerado com Codex a partir de `brand-v2/mascote/fotos-base` em dois níveis (Painted, Caricature), paleta EMBER + novo tom Ember deep `#4A130B` para o gradiente, 4 slides aplicados com toggle do mascote. Artifact privado https://claude.ai/artifact/P5vxuoVVNPSo49vukG36xN (fonte `signature/src/v2/build2.py`, assets em `signature/src/v2/`); escolhas em `signature/picks-v2`. Só 2 poses de caricatura por agora; mais poses depois da escolha do nível.

## Sistema de assinatura, ronda 3 (2026-11-11)

Feedback do Pedro à ronda 2: o P funciona mas deve ser PA; o mascote desenhado não parece ele (há tentativas anteriores a readaptar); os gradientes estão pesados.

- Marca: PA recortado diretamente da assinatura real (P e A de `brand-v2/signature`), em três variantes: Signed PA, PA + bloco laranja (recomendada), PA seal (laranja, para 32 px e abaixo). Fonte em `signature/src/v3/pa-ink.png` e `pa-cream.png`.
- Mascote: refeito a partir do v5 de `brand-v2/mascote/versoes` e da capa Weekly Learnings (pixel-realism), com fotos para a cara. Proporções reais, sem caricatura. Três poses: a apresentar, a construir (portátil), braços cruzados.
- Gradientes: Dawn (cream com canto laranja), Peach, Ink com um só brilho (só no CTA). O Ember glow da ronda 2 fica como "antes".
- Board: https://claude.ai/artifact/R8bs77UKKdZDDBY4XDCezo, escolhas em `signature/picks-v3`. Build: `signature/src/v3/build3.py`.
- Por fazer: qa.py e impeccable detect não corridos; o render ainda é mais pintura do que pixel.

**Estado (2026-11-12): em pausa.** O Pedro gostou ("yes ok") mas fica guardado para mais tarde. Antes de retomar, alinhar com o estilo novo dos carrosséis (`2. Areas/content/instagram/drafts/test-run-top10-skills/`, direção B Papel):
- Já coincide: tokens EMBER, Archivo + JetBrains Mono, laranja só para destaques.
- A ajustar: o header dos carrosséis usa a foto real do Pedro, não uma marca. O PA entra como selo pequeno (avatar alternativo ou rodapé), não substitui a foto.
- A ajustar: o Papel usa creme com grelha, borda a tinta e sombra dura, sem gradiente. O Dawn só entra na capa, se entrar; o Ink com brilho corresponde à direção A Noite.
- O mascote serve para o CTA ou o último slide, com borda a tinta, não como fundo de capa.

## Personal Brand 2027: kickoff (2026-11-14)

Pedro asked for the definitive personal brand across every surface, as teamwork, with Calíope also coaching him on the brand itself. This supersedes the parked round 3 as the path to v3. Audit, references, a 58-question interview and a 7-step plan are in [brand-2027/README.md](brand-2027/README.md) and on the kickoff page https://claude.ai/artifact/GnXeJxJ2Y3fZrZg9z5Qg3E. Waiting on: his interview answers and the AI image example he said he would send. brand-v2 stays in production until he approves the core.
