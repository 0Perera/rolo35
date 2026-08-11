# Rolo 35

Plataforma de eventos e ingressos com foco em cinema: catálogo de filmes, mapa de
assentos, pagamento simulado e ingresso com QR assinado.

## Status

🚧 Em desenvolvimento.

## Stack

- Back-end: Java + Spring Boot, PostgreSQL, Flyway
- Front-end: Vite + React, TypeScript, Tailwind CSS
- Metodologia: XP / TDD

## Como rodar

1. Clone o repositório.
2. Copie `.env.example` para `.env` (os valores padrão já servem pro dev local; troque
   se quiser).
3. Suba o banco + API: `docker compose up -d --build` (Flyway aplica o schema e o
   seed automaticamente no boot da API).
4. Health-check: `GET http://localhost:8080/actuator/health` deve responder `200`.
5. Front: `cd web`, copie `.env.example` pra `.env` (padrão já aponta pra API local),
   `npm install` e `npm run dev` — SPA sobe em `http://localhost:5173`.

> ⚠️ Em produção (deploy no Render, plano free), o serviço dorme após 15 min sem
> tráfego e leva ~1 min pra acordar no próximo request. O banco Postgres free
> também expira depois de um tempo — conferir prazo no dashboard do Render.

> ⚠️ **`TZ` é obrigatória no deploy.** O horário da sessão é wall-clock sem fuso: o
> organizador escolhe "20:00" e é isso que vai pro banco. API, banco e navegador
> precisam concordar sobre que "20:00" é esse. O `Dockerfile` e o compose já fixam
> `TZ=America/Sao_Paulo`; no Render, configure a mesma variável no serviço. Sem ela o
> container roda em UTC e rejeita como "no passado" qualquer horário nas próximas 3h.

## Dados de teste

4 perfis semeados via `V2__seed.sql`, senha em texto plano abaixo (hash BCrypt no
banco):

| Papel | E-mail | Senha |
|---|---|---|
| Organizador | `organizador@rolo35.com.br` | `organizador123` |
| Cliente | `cliente1@rolo35.com.br` | `cliente123` |
| Cliente | `cliente2@rolo35.com.br` | `cliente123` |
| Portaria | `portaria@rolo35.com.br` | `portaria123` |

Também existem 3 salas semeadas, com tamanhos variados: Sala 1 (8 fileiras x 10
colunas = 80 assentos), Sala 2 (5x6 = 30 assentos) e Sala 3 (10x14 = 140
assentos). Existe 1 sessão publicada de exemplo, na Sala 1 — "Clube da Luta"
(1999), com pôster e sinopse reais obtidos do TMDb — com todos os 80 assentos
dessa sessão livres. Salas 2 e 3 ainda não têm sessão vinculada; ficam
disponíveis pro organizador criar sessões manualmente durante o teste.

## Uso de IA

_(preencher: ferramentas usadas, em que partes do projeto, o que foi revisado ou
reescrito manualmente)_

## O que não funciona / ficou de fora

_(preencher conforme o desenvolvimento avançar)_
