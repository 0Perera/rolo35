---
title: 'Corrigir seed de salas e sessão (dado real do TMDb, mais salas)'
type: 'chore'
created: '2026-08-10'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: '4ae6465ff39661858c81a1e977ec2680003c1552'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `V2__seed.sql` tem um comentário datado citando a Story 1.2 (já
implementada), a sessão seed usa `poster_url`/`sinopse` fake/placeholder em
vez de dado real do TMDb, e só existe 1 sala (40 assentos) — pouco pra
exercitar mapa de assentos de tamanhos diferentes na Epic 3.

**Approach:** Reescrever `V2__seed.sql` com 3 salas de tamanhos variados
(Sala 1 aumentada, Sala 2 e Sala 3 novas) e trocar o dado da sessão seed
pelos valores reais já obtidos numa consulta ao TMDb (buscada uma vez fora da
aplicação, congelada no SQL — sem chamada em runtime). Ajustar os testes que
dependem desses valores hardcoded e a documentação do README.

## Boundaries & Constraints

**Always:**
- A sessão seed continua vinculada só à Sala 1 (não criar sessão nova pras salas 2/3).
- `tmdb_id` (550) e `data_estreia` (1999-10-15) já estavam corretos — só `poster_url`/`sinopse` mudam pros valores reais abaixo.
- Geração de `assentos` deve ser uma query genérica orientada por `linhas`/`colunas` de cada sala, não 3 blocos duplicados.
- Editar `V2__seed.sql` no lugar (não criar V4) — decisão já tomada com o usuário. Isso invalida o checksum do volume Postgres local já existente; não é assunto de README (ninguém mais tem esse volume), só um passo local do usuário depois da implementação.

**Ask First:** nenhuma decisão de arquitetura pendente — escopo já fechado com o usuário.

**Never:** criar `ApplicationRunner`/chamada TMDb em runtime pro seed (descartado); criar sessão nova pra Sala 2/3; abrir branch de épico.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Boot limpo (volume novo) | `docker compose up -d --build` | Flyway aplica V2 novo sem erro; 3 salas + assentos + 1 sessão criadas | N/A |
| Listagem pública | `GET /api/sessoes` | 1 sessão, sala "Sala 1", capacidade 80, poster/sinopse reais do TMDb | N/A |
| Gestão de salas | `GET /api/salas` (autenticado) | 3 salas: Sala 1 (80), Sala 2 (30), Sala 3 (140) | N/A |

</frozen-after-approval>

## Code Map

- `api/src/main/resources/db/migration/V2__seed.sql` -- seed a reescrever (salas/assentos/sessão)
- `api/src/test/java/br/com/rolo35/api/sessoes/SalaAssentoRepositorySmokeTest.java` -- assume 1 sala/40 assentos, quebra
- `api/src/test/java/br/com/rolo35/api/sessoes/repository/SessaoListagemRepositoryTest.java:68,84-86,92-93,102` -- usa `salaRepository.findAll().get(0)` e assume capacidade 40, quebra
- `README.md:44-52` -- seção "Dados de teste", precisa refletir o novo seed
- `docs/decisions.md` -- registrar a decisão desta correção (append)

## Tasks & Acceptance

**Execution:**
- [x] `api/src/main/resources/db/migration/V2__seed.sql` -- `INSERT INTO salas` com 3 linhas (Sala 1: 8x10=80; Sala 2: 5x6=30; Sala 3: 10x14=140); generalizar geração de `assentos` pra cobrir as 3 salas numa query orientada por `s.linhas`/`s.colunas`; trocar `poster_url` para `https://image.tmdb.org/t/p/w500/mCICnh7QBH0gzYaTQChBDDVIKdm.jpg` e `sinopse` para o texto real do TMDb (ver Design Notes); remover comentário datado da Story 1.2 -- corrige dado fake e amplia variedade de salas pra Epic 3
- [x] `api/src/test/java/br/com/rolo35/api/sessoes/SalaAssentoRepositorySmokeTest.java` -- `hasSize(1)`→`hasSize(3)`; buscar Sala 1 por nome (não `.get(0)`); atualizar `linhas`/`colunas`/contagem de assentos esperados (8/10/80) -- realinha com o seed novo, remove fragilidade de indexação por posição
- [x] `api/src/test/java/br/com/rolo35/api/sessoes/repository/SessaoListagemRepositoryTest.java` -- trocar `salaRepository.findAll().get(0).getId()` (linhas 68, 102) por busca determinística da "Sala 1"; atualizar `isEqualTo(40)` para `isEqualTo(80)` nas 4 asserções de capacidade/assentos livres (linhas 85-86, 93) -- mesma correção de fragilidade + novo valor
- [x] `README.md` -- seção "Dados de teste": novas 3 salas/tamanhos e filme real (Clube da Luta/Fight Club, 1999); nenhuma menção a `down -v` -- documentação alinhada ao dado real
- [x] `docs/decisions.md` -- nova entrada registrando por que o dado da sessão seed passou a vir de uma consulta real ao TMDb (buscada uma vez, congelada no SQL) em vez de fake, por que não virou `ApplicationRunner` em runtime, e por que `V2` foi editado no lugar em vez de nova migration -- histórico de decisão não-óbvia

**Acceptance Criteria:**
- Given um volume Postgres novo (sem histórico de migration anterior), when `docker compose up -d --build` roda, then Flyway aplica `V2__seed.sql` sem erro de validação de checksum
- Given o banco seedado, when `GET /api/salas` é chamado autenticado, then retorna exatamente 3 salas com capacidades 80/30/140
- Given o banco seedado, when `GET /api/sessoes` é chamado, then retorna 1 sessão na "Sala 1" com `poster_url`/`sinopse` reais do TMDb (não mais placeholder)
- Given a suíte de testes da API, when `./mvnw -f api/pom.xml test` roda, then todos os testes passam, incluindo os 2 arquivos ajustados

## Design Notes

Dado real já obtido (consulta feita com o token real do projeto, endpoint
`GET /search/movie?query=Clube da Luta&language=pt-BR`, mesmo endpoint que
`TmdbClient.buscarPorTitulo` usa em produção):

```
tmdb_id:      550
titulo:       Clube da Luta
poster_url:   https://image.tmdb.org/t/p/w500/mCICnh7QBH0gzYaTQChBDDVIKdm.jpg
sinopse:      Um homem deprimido que sofre de insônia conhece um estranho vendedor
              de sabonetes chamado Tyler Durden. Eles formam um clube clandestino
              com regras rígidas onde lutam com outros homens cansados de suas
              vidas mundanas. Mas sua parceria perfeita é comprometida quando
              Marla chama a atenção de Tyler.
data_estreia: 1999-10-15
```

Geração de assentos genérica sugerida (substitui os 3 blocos hoje só de Sala 1):

```sql
INSERT INTO assentos (sala_id, fileira, numero)
SELECT s.id, chr(64 + f.fileira_num), n.numero
FROM salas s
CROSS JOIN LATERAL generate_series(1, s.linhas) AS f(fileira_num)
CROSS JOIN LATERAL generate_series(1, s.colunas) AS n(numero);
```

## Verification

**Commands:**
- `./mvnw -f api/pom.xml test` -- expected: build verde, incluindo `SalaAssentoRepositorySmokeTest` e `SessaoListagemRepositoryTest`
- `docker compose down -v && docker compose up -d --build` (local, só nesta máquina que já tinha o volume antigo) -- expected: sobe sem erro de Flyway
- `curl -s http://localhost:8080/api/sessoes | jq` -- expected: 1 sessão, `salaNome: "Sala 1"`, `capacidade: 80`, poster/sinopse reais

## Suggested Review Order

**Seed de salas e sessão (o dado)**

- Entrada: 3 salas de tamanhos variados, geração de assentos generalizada por sala via `LATERAL`.
  [`V2__seed.sql:11`](../../api/src/main/resources/db/migration/V2__seed.sql#L11)

- Dado real do TMDb congelado aqui (poster/sinopse), com nota de que não se atualiza sozinho.
  [`V2__seed.sql:22`](../../api/src/main/resources/db/migration/V2__seed.sql#L22)

- Comentário de aviso pro checksum do Flyway quebrar em volume local pré-existente.
  [`V2__seed.sql:2`](../../api/src/main/resources/db/migration/V2__seed.sql#L2)

**Testes realinhados ao seed novo**

- Cobertura das 3 salas (antes só Sala 1), busca por nome em vez de índice posicional.
  [`SalaAssentoRepositorySmokeTest.java:26`](../../api/src/test/java/br/com/rolo35/api/sessoes/SalaAssentoRepositorySmokeTest.java#L26)

- Capacidade da sessão de fixture atualizada de 40 pra 80, lookup de sala determinístico.
  [`SessaoListagemRepositoryTest.java:66`](../../api/src/test/java/br/com/rolo35/api/sessoes/repository/SessaoListagemRepositoryTest.java#L66)

**Documentação**

- README "Dados de teste" reflete as 3 salas e o filme real, sem menção a `down -v`.
  [`README.md:49`](../../README.md#L49)

- Decisão registrada: por que dado congelado em vez de `ApplicationRunner`, por que editar V2 no lugar.
  [`decisions.md:295`](../../docs/decisions.md#L295)
