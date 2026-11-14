# Calíope · a agente de design do Pedro Almeida

Cópia de leitura do método da Calíope, tal como corre a 14 nov 2026, partilhada com o Pedro Ganço para auditoria. O objetivo é simples: abrires exatamente o que nós temos e dizeres o que melhorarias primeiro.

O pedido de auditoria está em [`AUDIT-PROMPT.md`](AUDIT-PROMPT.md). Podes colá-lo na Íris ou noutro agente apontado a este repositório.

## Como a Calíope corre

```
Pedro (Slack #consilium, ou Claude Code no Mac)
        │
        ▼
Calíope = Claude Code + skill pa-caliope + perfil agent/AGENTS.md
        │  para cada ecrã novo chama pa-design-loop
        │  (brief → referências → "isto ou aquilo" → evals → 2 direções
        │   → build → checks de máquina → painel fresco → utilizadores sintéticos
        │   → no máximo 3 rondas → revisão do Pedro → lições)
        ▼
Vitrúvio constrói · Claudius revê código e QA · Calíope revê UI/UX em staging
```

- **Onde vive.** As skills são canónicas no Mac (`~/.agents/skills/`) e vão para a VPS (Hetzner) de hora a hora e no arranque de cada sessão, por rsync só de leitura, com carimbo `_LAST-SYNC`. O perfil e a memória vivem no vault do Pedro (Markdown, sincronizado por Syncthing).
- **Como trabalha em equipa.** É uma de seis agentes do Consilium. Cada uma é um bot de Slack que corre o `claude` CLI dentro da sua pasta, por isso o seu `AGENTS.md` carrega sozinho.
- **Memória.** `agent/lessons.md` é escrito todas as noites por um job que lê as correções que o Pedro repetiu. `agent/decisions.md` guarda as decisões dele, com data.
- **Laboratório.** Uma vez por semana, `agent/tools/skill-lab/` testa até três skills de design novas contra a campeã atual e contra nenhuma skill, às cegas, e propõe no máximo duas mudanças de método.

## O que está aqui

| Pasta | O que é |
|---|---|
| `skills/pa-caliope/` | A skill principal: método, ship gate, formato de revisão, perfis de marca, scripts (`qa.py`, e em `scripts/iris/` as tuas ferramentas, com a tua licença MIT) |
| `skills/pa-design-loop/` | O loop de design para superfícies novas: entrevista, evals, painel, utilizadores sintéticos, rubrica permanente |
| `agent/AGENTS.md` | O perfil: o que é dela, o que faz sozinha, o que pede ao Pedro, regras de mandato, voz |
| `agent/lessons.md`, `agent/decisions.md` | Memória escrita pelo job noturno e decisões do Pedro |
| `agent/reference-sources.md` | Onde procurar referências para cada tipo de trabalho |
| `agent/tools/` | Captura diária dos sites guardados pelo Pedro, gate do site, laboratório de skills |
| `agent/profiles/`, `agent/taste/` | Perfil de marca do Pedro e notas de gosto |
| `agent/experiments/` | Registo de experiências, no teu formato |

## O que ficou de fora

- Trabalho de clientes. Nomes de clientes aparecem como "Cliente A" e os caminhos dos projetos deles foram anonimizados.
- Imagens: avatares, direções, moodboards, assinaturas, relatórios.
- A biblioteca de sites guardados do Pedro e a cópia do kit da Íris (já é tua).
- Credenciais. Nenhuma chave, token ou `.env` foi copiado. A única "chave" é a falsa dos testes.

Os caminhos nos ficheiros (`2. Areas/...`, `~/.claude/...`) apontam para o vault e o Mac do Pedro. Não existem aqui, mas mostram de onde cada peça é lida.

## Correr as ferramentas

```bash
cd skills/pa-caliope/scripts/iris && npm install && npm test
python3 skills/pa-caliope/scripts/qa.py <pasta-ou-url> --routes / --shots /tmp/shots
```

## Como responder

Abre issues neste repositório, uma por melhoria, ou um único relatório. Se preferires, responde ao Pedro diretamente.

Partilhado em privado para revisão. Não é para redistribuir. As partes vindas da Íris mantêm a licença MIT original (`skills/pa-caliope/scripts/iris/LICENSE`).
