# Pseudo-story CAP-10: Correções só de documentação

Status: ready-for-dev
Origem: `_bmad-output/specs/spec-backlog-hardening/SPEC.md` (CAP-10, Grupo B)

Sem RED/GREEN — nenhum dos 4 sub-itens muda código, só documentação. Cada um pode virar seu
próprio commit `docs:` ou serem bundlados num só.

## Sub-itens

### 1. Precedência entre "já utilizado" e "evento errado"

- [ ] Adicionar entrada em `docs/decisions.md`: o código já decide (checagem de sessão antes de
  status, em `PortariaService.validar()`) mas isso nunca foi registrado como decisão intencional.
  Documentar a ordem e o motivo (ver `business-rules-gaps.md`, item já catalogado).

### 2. `AD-11` desatualizado

- [ ] Editar `_bmad-output/planning-artifacts/architecture/architecture-rolo35-2026-08-10/ARCHITECTURE-SPINE.md`,
  seção `AD-11`: remover ou marcar como não-usados os códigos `RESERVA_NAO_ATIVA` e
  `EVENTO_ERRADO` como exemplo de erro HTTP — ambos hoje voltam `200` com campo `resultado`
  (decisões da Story 4.1 e 5.2, respectivamente). Adicionar nota linkando as duas decisões.

### 3. Grafo de dependência `AD-1` incompleto

- [ ] No mesmo arquivo, seção `AD-1`, atualizar o diagrama Mermaid adicionando as arestas
  `pagamentos --> sessoes` (via `AssentoSessaoRepository`) e `ingressos --> sessoes` (via `Sala`,
  `Sessao`, `SalaRepository`, `SessaoRepository`) — confirmadas no código, ausentes no diagrama
  atual.

### 4. AC citando campo "telefone" inexistente

- [ ] Em `_bmad-output/planning-artifacts/epics.md`, localizar o critério de aceite que menciona
  "sem telefone" (schema `usuarios` não tem essa coluna). Remover a cláusula ou marcar como
  aspiracional (campo que pode vir a existir) — decidir qual das duas ao editar.

## Task única — commit

- [ ] Fazer as 4 edições acima (podem ser um commit só, já que nenhuma muda código):
  `docs: corrige AD-11/AD-1 desatualizados, documenta precedência de validação, remove AC de
  telefone inexistente`
