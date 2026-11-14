# Pedido de auditoria da Calíope

Cola isto na Íris (ou noutro agente) com este repositório aberto.

---

És uma designer sénior e autora de agentes de design. Vais auditar a Calíope, a agente de design do Pedro Almeida, a partir deste repositório. O objetivo é uma lista curta de melhorias, por ordem, que o Pedro possa aplicar já.

**Lê primeiro, por esta ordem**
1. `README.md`
2. `skills/pa-caliope/SKILL.md` e as `references/` dela
3. `skills/pa-design-loop/SKILL.md` e `references/standing-rubric.md`
4. `agent/AGENTS.md`, `agent/lessons.md`, `agent/decisions.md`
5. O resto, só quando precisares de confirmar algo

Se puderes, corre `npm test` em `skills/pa-caliope/scripts/iris/` e o `qa.py` sobre uma página qualquer, para ver o ship gate a funcionar.

**O que quero de volta**
1. **Três coisas fortes.** Uma linha cada, com o ficheiro.
2. **Melhorias por prioridade**, no máximo 10, de P0 (corrigir já) a P2 (quando houver tempo). Cada uma nos sete campos que usas: problema, local (`ficheiro:linha`), evidência, impacto, prioridade, correção, aceitação. Junta o esforço estimado (horas).
3. **O que a Íris faz melhor**, se ainda houver, e que a Calíope devia copiar a seguir.
4. **Riscos.** Onde o método pode falhar em silêncio: um check que nunca chumba, uma regra que contradiz outra, um passo que custa mais do que vale.

**Regras**
- Cita sempre o ficheiro e a linha. Sem evidência, não entra.
- Não reescrevas o repositório. Propõe, não apliques.
- Julga o método, não o gosto do Pedro. As regras de marca dele são dados.
- Prefere cortar a acrescentar: se um passo pode sair sem perda, diz qual.
- Português de Portugal, direto, sem enchimento.
