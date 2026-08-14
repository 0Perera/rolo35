# Pseudo-story CAP-8: Janela de tempo pra portaria ativar sessão do turno

Status: ready-for-dev
Origem: `_bmad-output/specs/spec-backlog-hardening/SPEC.md` (CAP-8, Grupo B) — decisão já resolvida.

## Story

As usuário PORTARIA,
I want só conseguir ativar como "sessão do turno" uma sessão que está de fato prestes a
acontecer ou em andamento,
so that eu não ative por engano uma sessão de semana passada ou de daqui a um mês.

## Decisão já tomada

Janela: **-30min / +2h** a partir de `dataHora`, como **constante própria**, separada do buffer de
4h já usado pro conflito de sala (são conceitos diferentes — não reaproveitar).

## Acceptance Criteria

1. **Given** uma sessão cujo `dataHora` está entre 30min no futuro e 2h no passado a partir de
   agora **When** `POST /api/portaria/turno` seleciona essa sessão **Then** aceita normalmente.
2. **Given** uma sessão fora dessa janela (mais de 30min no futuro, ou mais de 2h no passado)
   **When** selecionada **Then** a API rejeita com erro claro (novo código, ex.:
   `SESSAO_FORA_DA_JANELA_DO_TURNO`).
3. **Given** a sessão já ativa de um turno anterior, ainda dentro da janela **When** a portaria
   reconsulta `GET /api/portaria/turno` **Then** nada muda no comportamento já existente.

## Tasks / Subtasks

- [ ] **Task 1 — Guard em `PortariaService.selecionarSessao()`**
  - [ ] **[RED]** Em `api/src/test/java/br/com/rolo35/api/ingressos/service/PortariaServiceTest.java`,
    casos novos: sessão 40min no futuro → rejeita; sessão 3h no passado → rejeita; sessão 10min no
    futuro → aceita; sessão 1h30 no passado → aceita. Rodar e confirmar falha (comportamento atual
    aceita tudo).
  - [ ] **[GREEN]** Criar `api/src/main/java/br/com/rolo35/api/ingressos/SessaoForaDaJanelaDoTurnoException.java`.
    Em `PortariaService.selecionarSessao()`, adicionar guard usando constantes próprias
    (`JANELA_TURNO_ANTES_MINUTOS = 30`, `JANELA_TURNO_DEPOIS_HORAS = 2`) — nomes explícitos pra não
    confundir com o buffer de conflito de sala de `SessaoService`.
  - [ ] Registrar o novo código de erro no `GlobalExceptionHandler`.
  - [ ] Commit: `fix(portaria): restringe seleção de sessão do turno a janela -30min/+2h`

## Dev Notes

- Não reaproveitar nenhuma constante de `SessaoService` — são domínios diferentes (conflito de
  sala vs. janela operacional da portaria), mesmo que o valor pareça parecido.
- Ver `docs/decisions.md` — a entrada desta decisão já deve existir ou precisa ser adicionada no
  mesmo commit, citando a janela escolhida e o motivo (evitar ativação por engano de sessão fora
  de contexto).
