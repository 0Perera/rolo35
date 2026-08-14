---
title: "Sprint Change Proposal — Story 1.3: de Autocadastro de Cliente para Cadastro de Usuário"
date: 2026-08-13
status: aprovado
---

## 1. Resumo do Issue

**Story afetada:** Story 1.3 (Epic 1), `_bmad-output/planning-artifacts/epics.md`.

**Problema:** a Story 1.3 estava definida como "Autocadastro de Cliente" — o endpoint só cria contas com papel `CLIENTE` e rejeita explicitamente qualquer outro papel enviado na requisição (`ORGANIZADOR`/`PORTARIA` só existiam via seed manual). Felipe decidiu que isso dificulta a avaliação e a testabilidade do sistema: quem for avaliar ou testar precisa conseguir criar conta de qualquer papel sem depender de credenciais de seed fixas.

**Tipo de issue:** novo requisito emergente do stakeholder (não é bug, má-interpretação nem pivot estratégico).

**Evidência:** pedido direto do usuário via `bmad-help`; a Story 1.3 hoje (`epics.md:210-234`, antes da edição) tem uma AC explícita afirmando "nunca cria ORGANIZADOR/PORTARIA por essa via".

**Estado no momento da mudança:** Story 1.3 ainda `backlog` no sprint (`sprint-status.yaml:54`) — nada implementado em `main`/branch atual. Existe uma implementação antiga (client-only) num branch órfão (`backup/retrofit-with-story-1-3`), não integrada e não reaproveitada.

## 2. Análise de Impacto

**Epic:** Epic 1 continua completável como planejado; só a Story 1.3 muda de escopo (não é add/remove de epic, não afeta ordem/prioridade dos demais).

**Outras stories/epics:** nenhum impacto — Epics 2–5 dependem apenas do papel já autenticado (Story 1.1), não de como a conta foi criada.

**PRD:** sem conflito. FR-1 (`prd.md:80-86`) já define "três papéis fixos por conta (`ORGANIZADOR`, `CLIENTE`, `PORTARIA`), sem acúmulo" — a mudança cabe dentro do que o PRD já autoriza. Nenhuma FR precisou de edição.

**Arquitetura:** sem conflito nem mudança de schema. `usuarios(id, nome, email, senha_hash, papel, created_at)` já é uma tabela única com `papel` discriminando os três papéis (`ARCHITECTURE-SPINE.md:219`). Consequência técnica (não estrutural): introduzir `enum Papel { ORGANIZADOR, CLIENTE, PORTARIA }` no back-end — hoje `papel` é `String` livre em `Usuario.java`.

**UX:** não existe documento UX dedicado no projeto; sem artefato formal a atualizar. Fica registrado que o front (`web/`) vai precisar de um seletor de papel na tela de cadastro quando a story for implementada.

**Outros artefatos:** `sprint-status.yaml` (chave renomeada) e `docs/decisions.md` (decisão registrada) — ambos já atualizados nesta proposta.

## 3. Caminho Recomendado

**Opção escolhida: Ajuste Direto** (Option 1) — editar a Story 1.3 existente dentro do Epic 1 atual.

- Rollback (Option 2): não se aplica — nada foi implementado em `main` pra reverter.
- Revisão de MVP (Option 3): não se aplica — a mudança não afeta o MVP nem os goals do PRD, já cabia dentro de FR-1.

**Esforço:** Baixo. **Risco:** Baixo.

## 4. Mudanças Detalhadas

### 4.1 — `epics.md` (Story 1.3) — ✅ aplicado

- Título: "Autocadastro de Cliente" → "Cadastro de Usuário".
- Nota de contexto: referência à decisão original de escopo + nova referência à decisão de ampliação.
- User story: passa a mencionar escolha de papel entre os três.
- AC1: cria conta com o papel informado (antes: sempre `CLIENTE`).
- AC3 (substituída): valida `papel` contra o enum de três valores e rejeita se ausente/inválido — revoga a AC anterior que proibia criar `ORGANIZADOR`/`PORTARIA` por essa via.
- AC2 (e-mail duplicado) e AC4 (validação de formato): mantidas sem alteração.

### 4.2 — `sprint-status.yaml` — ✅ aplicado

- Chave `1-3-autocadastro-de-cliente` → `1-3-cadastro-de-usuario`, status mantido `backlog`.

### 4.3 — `docs/decisions.md` — ✅ aplicado

- Nova entrada "Story 1.3 vira 'Cadastro de Usuário' com papel selecionável, não só autocadastro de cliente", com decisão e racional completos.

## 5. Handoff de Implementação

**Classificação do escopo da mudança:** **Minor** — ajuste direto de uma story ainda não implementada, sem impacto em PRD/arquitetura/outras stories.

**Roteamento:** Developer agent (via `bmad-create-story` para gerar o arquivo formal de story em `implementation-artifacts/`, seguido de `bmad-dev-story` para implementação TDD).

**Responsabilidades:**
- `bmad-create-story`: gera `implementation-artifacts/1-3-cadastro-de-usuario.md` a partir do `epics.md` já atualizado.
- `bmad-dev-story`: implementa seguindo TDD do projeto — testes cobrindo os 3 papéis válidos e o caso de papel ausente/inválido, introduzindo `enum Papel` no back-end e (se necessário) seletor de papel no front.

**Critério de sucesso:** endpoint de cadastro cria conta com qualquer um dos três papéis quando válido, rejeita papel fora do conjunto permitido com erro de campo, e os testes da story cobrem ambos os caminhos.

## 6. Conclusão

Mudança de escopo pontual e de baixo risco, totalmente contida na Story 1.3, sem necessidade de tocar PRD, arquitetura ou outras stories. Aprovada por Felipe em modo incremental, com cada edição revisada e aprovada individualmente antes de ser aplicada.
