# Pseudo-story CAP-6: Deploy completo no Render

Status: ready-for-dev
Origem: `_bmad-output/specs/spec-backlog-hardening/SPEC.md` (CAP-6, Grupo A)

## Story

As avaliador acessando a aplicação publicada,
I want acessar o front sem depender de dois provedores diferentes,
so that a avaliação é mais simples e o front fica sempre disponível (sem o sleep que afeta a API
free do Render).

## Acceptance Criteria

1. **Given** um `render.yaml` na raiz do repo **When** aplicado via Render Blueprint **Then** sobe
   3 serviços: Postgres gerenciado, Web Service (API), Static Site (front).
2. **Given** o Static Site do front **When** acessado **Then** não sofre o sleep de 15min que afeta
   o Web Service free — fica sempre disponível.
3. **Given** o Web Service da API **When** acessado após período de inatividade **Then** continua
   com o comportamento de sleep/wake já documentado (isso não muda, só o front deixa de sofrer o
   mesmo problema).
4. **Given** a mudança **When** commitada **Then** README §3.7 é atualizado pra refletir o novo
   cenário de deploy (API + front + banco todos no Render, front sem sleep).

## Tasks / Subtasks

- [ ] **Task 1 — `render.yaml` com os 3 serviços**
  - [ ] Criar `render.yaml` na raiz:
    ```yaml
    databases:
      - name: rolo35-db
        plan: free

    services:
      - type: web
        name: rolo35-api
        runtime: docker
        dockerfilePath: ./api/Dockerfile
        envVars:
          - key: DATABASE_URL
            fromDatabase:
              name: rolo35-db
              property: connectionString
          # + demais envVars já usadas hoje (TMDB_API_TOKEN, JWT secret, TICKET_HMAC_SECRET, CORS)

      - type: web
        name: rolo35-web
        runtime: static
        buildCommand: cd web && npm install && npm run build
        staticPublishPath: web/dist
        envVars:
          - key: VITE_API_URL
            value: https://rolo35-api.onrender.com
    ```
    (ajustar nomes de env vars pro que já existe em `.env.example`/`application.properties`.)
  - [ ] Configurar CORS na API (`SecurityConfig.corsAllowedOrigins`) pra aceitar o domínio do
    Static Site novo.
  - [ ] Testar deploy real (ou ao menos validar a sintaxe do blueprint) antes de considerar
    concluído — deploy é o tipo de mudança que só se prova rodando de verdade.

- [ ] **Task 2 — Documentação**
  - [ ] Atualizar README §3.7 (Deploy e limitações do plano free): API continua com sleep de
    15min; front (Static Site) não dorme mais; banco continua com o prazo de expiração do Render
    free a conferir no dashboard.
  - [ ] Adicionar entrada em `docs/decisions.md` sobre a migração de front-na-Vercel pra
    front-no-Render (Static Site), com o motivo (front sempre disponível, um provedor só,
    blueprint único).
  - [ ] Commit: `feat(deploy): blueprint Render com API, front e banco num só arquivo`

## Dev Notes

- Isso **substitui** o deploy do front na Vercel — decidir explicitamente se a Vercel é
  descontinuada ou mantida como opção alternativa documentada. Recomendo descontinuar pra não
  manter dois pipelines de deploy no README.
- Requer conta/projeto Render configurado — parte manual (criar o Blueprint no dashboard) não é
  automatizável só com o `render.yaml` commitado; documentar o passo manual no README também.
