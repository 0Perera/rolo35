# Pseudo-story CAP-13: Aumentar seed de sessões

Status: ready-for-dev
Origem: `_bmad-output/specs/spec-backlog-hardening/SPEC.md` (CAP-13, Grupo B)

## Story

As avaliador/desenvolvedor testando a aplicação,
I want ver mais sessões e filmes com múltiplos horários já no seed,
so that eu consigo testar visualmente conflito de horário, listagem e mapa de assentos em estados
variados sem montar dado manualmente.

## Acceptance Criteria

1. **Given** o seed aplicado **When** consultado `GET /api/sessoes` **Then** existem pelo menos 6
   sessões distintas.
2. **Given** o seed **When** filtrado por filme **Then** pelo menos 2 filmes diferentes têm mais de
   um horário/data de sessão disponível.
3. **Given** o seed novo **When** aplicado sobre um banco limpo **Then** nenhuma migration
   existente quebra, nenhum teste de integração que depende do seed (`SalaAssentoRepositorySmokeTest`
   e afins) quebra.
4. **Given** duas sessões do mesmo filme (mesmo `tmdbId`) **When** inseridas **Then** `titulo`,
   `sinopse`, `posterUrl`, `dataEstreia` são **idênticos** entre elas (evita o risco de
   inconsistência de snapshot mencionado na auditoria — mesmo que não seja um item de código desta
   spec, vale disciplina manual no INSERT).

## Tasks / Subtasks

- [ ] **Task 1 — Editar `V2__seed.sql`**
  - [ ] Adicionar sessões novas até totalizar ~6, distribuídas entre as salas já seedadas.
  - [ ] Garantir que 2 filmes (tmdbId reais, dados verdadeiros do TMDb pra manter fidelidade —
    seguir o padrão já usado nas sessões existentes) tenham 2+ horários/datas cada.
  - [ ] Conferir manualmente que os campos de snapshot (`titulo`, `sinopse`, `poster_url`,
    `data_estreia`) são idênticos entre as sessões do mesmo filme.
  - [ ] Rodar a suíte completa (`SalaAssentoRepositorySmokeTest`, `SessaoListagemRepositoryTest`,
    testes de concorrência que dependem de `salaRepository.findAll().get(0)`) e confirmar que nada
    quebra — atenção especial aos testes que pegam sala/sessão de fixture por posição, não por
    nome (já registrado como inconsistência conhecida em `deferred-work.md`).
  - [ ] Commit: `chore(seed): aumenta sessões pra 6 distintas, 2 filmes com múltiplos horários`

## Dev Notes

- Não é obrigatório resolver a inconsistência de "sala de fixture por posição" nos testes citada
  acima — só ficar atento se o seed novo mudar a ordem/quantidade de salas e algum teste desses
  passar a pegar a sala errada.
- Reaproveitar filmes já usados no seed atual quando possível, só adicionando mais sessões pra
  eles, em vez de introduzir filme novo — reduz risco de digitar `tmdbId`/dados errados à mão.
