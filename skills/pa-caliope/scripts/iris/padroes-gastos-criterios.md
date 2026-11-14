# Padrões gastos

Padrões visuais e de copy que perderam impacto por excesso de uso em sites feitos à pressa com LLMs. Lista base (1 a 17) e extras (18 a 28), 2026-10-21.

Regra de trabalho: estes padrões não são proibidos. São **detetados e reportados**, e a decisão de assumir a rota ou variar toma-se com o utilizador, caso a caso. Um padrão gasto pode ser a escolha certa quando há uma razão escrita no projeto; o problema é chegar lá por reflexo.

Como detetar: `node tools/padroes-gastos.mjs <url>` na página renderizada (percorre a página, lê DOM, CSS e texto, devolve sim, ver ou não com evidência). Depois confirmar na captura: o detetor não vê hover que não esteja em CSS legível, nem páginas internas.

## Regras rápidas

1. Em avaliações e na revisão de implementações, incluir sempre uma secção "Padrões gastos" com o resultado do detetor e o que foi confirmado na captura.
2. Em propostas de direção visual, dizer que padrões da lista a direção usa e porquê. Se não usa nenhum, dizer também.
3. Aplica-se ao que se faz de novo (páginas, componentes, direções, revisões de implementações novas).
4. Um padrão já assumido num projeto fica registado em `projects/<nome>/decisoes.md` com a razão; deixa de se reportar nesse projeto, exceto se o uso se alastrar.
5. Reportar não é corrigir: não mudar nada nesta lista sem a decisão do utilizador.
6. Antes de substituir, aplicar o teste da remoção (abaixo). Muitas vezes a alternativa certa é tirar, e não trocar por outro efeito.
7. Agrupar por causa: vidro, orbs, roxo e grelha de pontos juntos são um só achado ("SaaS genérico"), não quatro.

## Os 28 padrões

| # | Padrão | Porque está gasto | Quando pode fazer sentido | Alternativas |
|---|---|---|---|---|
| 1 | Ícones Lucide | Biblioteca por defeito do shadcn e da maioria dos geradores; traço 2, cantos redondos, 24 px, sempre iguais | Interfaces de ferramenta densas, onde o ícone tem de passar despercebido | Ajustar o traço ao peso do texto (`componentes-e-estados.md` §7), outra família com caráter que sirva a marca, ou ícones próprios (`skills/icones-svg`). Menos ícones: muitos só enfeitam um título |
| 2 | Emojis | Substituto barato de ícone e de tom; dependem da plataforma e leem-se como pressa | Conteúdo social e mensagens pessoais, onde são linguagem e não decoração | Ícones da marca, ilustração própria, ou nada |
| 3 | Liquid glass | Moda da Apple em 2025-26 copiada sem a matéria por trás; custa legibilidade e desempenho | Quando há matéria rica atrás (foto, mapa, vídeo) e a hierarquia de camadas é real. Ver `skills/liquid-glass-web` | Superfície opaca com borda fina, ou cor sólida da marca |
| 4 | Travessões (— e – a fazer de —) | Sinal clássico de texto gerado. Proibido em muitas regras de escrita | Nunca em texto corrido. En dash só em intervalos (10–15) | Vírgula, dois pontos, parênteses ou duas frases |
| 5 | Inter, Geist, Space Grotesk | Defaults do Tailwind, Vercel e geradores; não dizem nada da marca | Inter em UI densa com números (tem bons algarismos tabulares), Geist Mono em código | Família escolhida pelo assunto (`fundamentos/tipografia.md`). Também muito vistas: Manrope, Poppins, Plus Jakarta Sans, DM Sans, Instrument Serif, Fraunces |
| 6 | 3 cartões de feature em linha | Ícone, título e duas linhas, três vezes: o bloco que todos os templates trazem | Quando o conteúdo tem mesmo três itens paralelos de igual peso (três planos, três organizadores) | Lista com hierarquia, um item principal e dois secundários, comparação, exemplo real do produto, ou uma frase só |
| 7 | Bento grid | Espalhado desde as keynotes da Apple; células vazias ou de enchimento | Quando cada célula tem conteúdo diferente e um papel na composição | Grelha regular, uma composição editorial, ou uma só peça forte |
| 8 | Janela de terminal | Três semáforos e `$ npx` para parecer técnico, mesmo quando o público não usa terminal | Produto para programadores em que o comando é mesmo o primeiro passo | Mostrar o resultado em vez do comando; bloco de código simples sem a moldura de janela |
| 9 | "Não é X, é Y" | Fórmula de copy gerado (paralelismo negativo) | Quase nunca. Só se X for uma ideia que o público tem mesmo e é preciso desfazer | Dizer o que é, com um facto concreto |
| 10 | Sem demo real | "Product screenshot", "coming soon", placeholders onde devia estar o produto | Antes do lançamento, se for assumido e com data | Captura real, vídeo curto, demo interativa, ou um exemplo concreto. Sem produto para mostrar, a secção sai |
| 11 | Roxo e preto | Média dos templates de IA de 2023-26 | Marca que já é roxa por razão própria | Paleta derivada do assunto (`fundamentos/cor.md`) |
| 12 | Orbs radiais | Manchas de luz desfocadas atrás do título: decoração sem conteúdo | Quase nunca. Talvez como luz de um objeto real da cena | Imagem real ou gerada do assunto, cor sólida, ou espaço vazio |
| 13 | Grelha de pontos | Fundo "técnico" por defeito | Ferramentas de desenho ou de diagramas, onde a grelha é a superfície de trabalho | Fundo liso, textura da marca, papel |
| 14 | Ícones de brilho (sparkles) | O ícone de "IA" de todos os produtos; não diz o que acontece | Nunca como único sinal: o utilizador tem de perceber a ação | Verbo concreto ("Resumir", "Sugerir nomes"), ícone da ação real |
| 15 | Setas animadas | A seta do CTA que avança 2 a 4 px no hover, em todos os botões | Numa só ligação de avançar, se a marca tiver pouco movimento noutro lado | Seta estática, ou feedback de cor e sublinhado |
| 16 | Animações de hover | Cartões que sobem, crescem ou ganham sombra ao passar o rato, em tudo | Elementos que se arrastam ou se escolhem, onde o movimento diz "isto mexe" | Mudança de cor, borda ou sublinhado. O feedback de hover é necessário; o gasto é o movimento em todos os elementos |
| 17 | Cor arco-íris | Gradientes de muitas cores e texto em gradiente para parecer "IA" ou "criativo" | Marcas cuja identidade é mesmo o espectro, ou dados com escala de cor | Uma cor de acento, ou gradiente de duas cores próximas da marca |
| 18 | Texto em gradiente no título | Atalho para "premium" em todas as landings de IA; baixa o contraste e some em modo de alto contraste | Num só destaque curto, em marcas cuja cor é um gradiente | Cor sólida da marca, peso ou tamanho |
| 19 | Pílula acima do título | "Novo: versão 2" em todos os heros, mesmo sem novidade | Quando há mesmo uma novidade com data e ligação | Novidade numa linha de texto ou numa faixa própria; ou nada |
| 20 | Eyebrows em maiúsculas espaçadas em todas as secções | Ritmo de template: etiqueta, título, parágrafo, repetido | Manuais e sistemas editoriais indexados, onde a etiqueta orienta | Títulos que dizem o essencial sozinhos; variar a entrada das secções (frase, imagem, número, citação) |
| 21 | Hero centrado com gradiente e dois botões | Composição média de todos os geradores | Manifestos, lançamentos, utilitários em que a pesquisa é a primeira ação | Abrir com o objeto mais característico do assunto, ou com a própria ferramenta |
| 22 | Zigzag de imagem e texto | Três ou mais secções seguidas que só mudam de lado | Passos de um processo com imagem própria cada um, se o ritmo variar | Uma secção larga, galeria, comparação, diagrama ou uma pausa só de texto |
| 23 | Cabeçalho partido em dois sem razão | Título grande à esquerda, parágrafo curto a flutuar à direita | Quando a segunda coluna tem papel (ação, dado, imagem) | Empilhar título e texto |
| 24 | Prova social de teatro | Logótipos, métricas e testemunhos para parecer estabelecido | Só se for real e verificável. Inventada é sempre achado de prioridade alta, não preferência | Prova verdadeira ao lado da afirmação que sustenta; sem prova, a secção sai |
| 25 | Fade-up em todas as secções | Conteúdo escondido até ao scroll, com a mesma entrada em tudo | Um só momento orquestrado, com estado final visível em movimento reduzido | Conteúdo visível em repouso; movimento só em resposta a ação |
| 26 | Marquee | Faixa de logótipos ou palavras em movimento contínuo | Quase nunca: movimento sem fim distrai e precisa de pausa (WCAG 2.2.2) | Lista estática, grelha, ou uma frase |
| 27 | Texto revelado palavra a palavra | Títulos partidos em palavras que entram uma a uma | Peças de vídeo e momentos únicos, nunca no texto que tem de ser lido já | Título inteiro, sem animação |
| 28 | CTA duplicado | "Começar", "Experimentar" e "Criar conta" a levar ao mesmo sítio | Níveis de compromisso diferentes, com destinos diferentes | Um só rótulo por intenção |

## Teste da remoção

Antes de propor substituto para um padrão detetado:

1. Nomear o elemento.
2. Dizer em que trabalho ajuda: informação, estado, ação, hierarquia ou marca.
3. Retirá-lo mentalmente (ou na captura) e ver o que se perde.
4. Só corrigir se se perder alguma coisa; nesse caso, recuperar essa coisa da forma mais simples.
5. Não compensar a remoção com um efeito novo.

## Grupos com uma só causa

Reportar como um achado: "SaaS genérico" (eyebrow, título-frase enorme, roxo, luzes radiais, vidro, ícones em azulejo, bento, copy vaga); "apocalipse de cartões" (cartão de secção com cartões dentro, pílulas, bordas e sombras redundantes); "teatro de movimento" (conteúdo escondido em repouso, reveals iguais, marquee, hover a crescer, sem caminho de movimento reduzido); "sofisticação falsa" (micro-etiquetas em mono, grelha decorativa, dashboard falso, métricas inventadas, moldura de browser).

## Armadilhas

- Trocar um padrão gasto pelo seguinte da moda (sair do roxo para o creme com serifa display, que já é o novo default).
- Tratar a lista como proibição e empobrecer o projeto: a decisão é do utilizador, com a razão escrita.
- Confiar só no detetor: dá falsos positivos ("Fecham em breve" é um prazo, não uma demo em falta) e falsos negativos (hover em CSS de outra origem, ícones desenhados à mão no estilo Lucide).
- Reportar cada ocorrência como achado separado.

## Fontes

- Lista base, 2026-10-21.
- ConardLi/garden-skills, `web-design-engineer/references/failure-patterns.md` (MIT), lido a 2026-10-21: nomes de padrões (zigzag, split-header, trust theater, CTA duplication).
- MengTo/Skills, `ui/no-ai-design-slop` (MIT), lido a 2026-10-21: teste da remoção e grupos de causa. Reescritos.
- `docs/geracao-com-llms/estado-da-arte-ui.md` §4 para as fontes sobre tells de UI gerada.
