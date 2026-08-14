# Pseudo-story CAP-5: `docker-compose up` sobe a aplicação inteira

Status: ready-for-dev
Origem: `_bmad-output/specs/spec-backlog-hardening/SPEC.md` (CAP-5, Grupo A)

## Story

As avaliador/desenvolvedor rodando o projeto localmente,
I want subir Postgres, API e front com um único comando,
so that eu não preciso lembrar de rodar `npm run dev` numa aba separada toda vez.

## Acceptance Criteria

1. **Given** o repositório limpo, com `.env` configurado **When** `docker compose up` é executado
   na raiz **Then** Postgres, API e front sobem, e o front (Vite) fica acessível na porta padrão
   configurada.
2. **Given** o front rodando via compose **When** ele faz uma chamada de API **Then** aponta pro
   serviço da API dentro da rede do compose (não `localhost` hardcoded, salvo se o compose já
   expõe a API em `localhost` pro browser — variável de ambiente de build precisa refletir isso).
3. **Given** o setup atual de dev (`npm run dev` separado) **When** alguém ainda quiser rodar assim
   **Then** continua funcionando — o serviço novo no compose não quebra o fluxo manual existente.
4. **Given** a mudança **When** commitada **Then** `docs/decisions.md` ganha entrada registrando a
   mudança de "front roda separado" pra "front no compose", com o motivo (avaliação/dev local mais
   simples, um comando só).

## Tasks / Subtasks

- [ ] **Task 1 — Serviço `web` no `docker-compose.yml`**
  - [ ] Adicionar serviço `web` ao `docker-compose.yml`: build a partir de `web/` (Dockerfile novo
    ou multi-stage — checar se `web/` já tem `Dockerfile`; se não, criar um simples baseado em
    `node:XX-alpine` rodando `npm run dev -- --host` ou servindo o build via `vite preview`,
    dependendo se o objetivo é dev-mode com hot-reload ou build de produção local).
  - [ ] Configurar a variável de ambiente de URL da API do front pra apontar pro serviço `api`
    dentro da rede do compose (ou pra `localhost:<porta-api>` se o browser acessa direto, fora da
    rede docker — depende de como o front resolve a URL hoje, checar `web/src/api/client.ts` ou
    equivalente).
  - [ ] `depends_on: api` no serviço `web`.
  - [ ] Testar manualmente: `docker compose down -v && docker compose up`, confirmar que os 3
    serviços sobem e o fluxo de login funciona ponta a ponta pelo front servido via compose.

- [ ] **Task 2 — Documentação e decisão**
  - [ ] Atualizar `README.md` §3.2/§3.3 (setup) pra refletir a opção nova de `docker compose up`
    subindo tudo, mantendo a opção antiga (`npm run dev` separado) documentada como alternativa.
  - [ ] Adicionar entrada em `docs/decisions.md`.
  - [ ] Commit: `feat(docker): sobe front junto no docker-compose, um comando pra aplicação
    inteira`

## Dev Notes

- Não precisa (nem deve) mudar o deploy de produção do front — isso é só ambiente local de
  desenvolvimento/avaliação. O front continua indo pra Vercel (ou pro que for decidido no CAP-6)
  em produção.
- Cuidado com hot-reload/volume mount: se o objetivo é dev-mode real (não só demo), montar
  `web/` como volume no serviço pra refletir mudança de código sem rebuild.
