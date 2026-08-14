# Pseudo-story CAP-3: Backstops de banco pros invariantes de `ingressos`

Status: ready-for-dev
Origem: `_bmad-output/specs/spec-backlog-hardening/SPEC.md` (CAP-3, Grupo A)

## Story

As mantenedor do sistema,
I want que o banco garanta, por constraint, os dois invariantes de não-duplicação de `ingressos`
que hoje só a aplicação garante,
so that `ingressos` fica no mesmo padrão de segurança dos outros dois invariantes de duplicação já
protegidos por constraint (venda dupla de assento, validação dupla de ingresso).

## Acceptance Criteria

1. **Given** uma migration nova **When** aplicada **Then** `ingressos` ganha FK composta
   `(sessao_id, assento_id) REFERENCES assento_sessao (sessao_id, assento_id)`.
2. **Given** a mesma ou outra migration **When** aplicada **Then** `ingressos` ganha
   `UNIQUE (reserva_id, assento_id)`.
3. **Given** a suíte de testes existente (`PagamentoServiceTest`, testes de integração de
   `ingressos`) **When** as migrations rodam **Then** nada quebra — o caminho de escrita atual já
   deriva sessão/assento sempre da mesma linha de `assento_sessao`, então as constraints não
   rejeitam nenhuma inserção legítima.
4. **Given** uma tentativa hipotética de inserir um ingresso com combinação sessão/assento que
   nunca existiu em `assento_sessao` **When** simulada num teste de integração (Testcontainers)
   **Then** o banco rejeita com violação de FK, não só a aplicação.

## Tasks / Subtasks

- [ ] **Task 1 — Migration com as duas constraints**
  - [ ] **[RED]** Teste de integração (Testcontainers, mesmo padrão de
    `SalaAssentoRepositorySmokeTest`/testes de concorrência já existentes) provando que, **antes**
    da migration, é possível inserir um `Ingresso` com `(sessao_id, assento_id)` que não existe em
    `assento_sessao` (via `INSERT` direto/JDBC no teste, contornando o service) — prova que hoje só
    a aplicação impede isso. Rodar e confirmar que passa (ou seja, confirma a ausência da
    constraint).
  - [ ] **[GREEN]** Criar `api/src/main/resources/db/migration/V7__backstops_ingressos.sql` (ajustar
    número pra próximo livre) com:
    ```sql
    ALTER TABLE ingressos
      ADD CONSTRAINT fk_ingressos_assento_sessao
      FOREIGN KEY (sessao_id, assento_id) REFERENCES assento_sessao (sessao_id, assento_id);

    ALTER TABLE ingressos
      ADD CONSTRAINT uq_ingressos_reserva_assento
      UNIQUE (reserva_id, assento_id);
    ```
  - [ ] Reverter o teste do passo RED pra provar que a mesma inserção agora **falha** com violação
    de constraint (vira o teste "positivo" que documenta a proteção nova).
  - [ ] Rodar toda a suíte de `pagamentos`/`ingressos`/concorrência e confirmar verde.

- [ ] **Task 2 — Bônus opcional (bundlar com CAP-9): `saveAll()` em vez de loop**
  - [ ] Se `PagamentoService.confirmar()` for tocado por qualquer motivo nesta task, aproveitar pra
    trocar o `assentoIds.stream().map(id -> ingressoRepository.save(...))` por
    `ingressoRepository.saveAll(...)`, consistente com o padrão batch já usado em
    `reivindicarVendido()`/`liberar()` na mesma classe. Não é obrigatório fazer nesta pseudo-story
    se não tocar o método por outro motivo — é o item CAP-9 do backlog, só faz sentido bundlar aqui
    por proximidade de arquivo.
  - [ ] Commit: `fix(ingressos): adiciona FK composta e UNIQUE faltantes contra assento_sessao`
    (Task 2, se feita, entra no mesmo commit ou em um `refactor:` separado — decisão de quem
    executar).

## Dev Notes

- Migration precisa checar o próximo número livre em `api/src/main/resources/db/migration/` no
  momento de rodar (V6 é a última hoje, `turno_portaria`).
- Não é esperado nenhum dado existente violar as constraints novas — seed e fluxo de aplicação já
  respeitam os dois invariantes; a migration só torna explícito no banco o que já era verdade na
  prática.
