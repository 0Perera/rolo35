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
5. _(preencher: comando pra rodar o front, depois do scaffold Vite)_

> ⚠️ Em produção (deploy no Render, plano free), o serviço dorme após 15 min sem
> tráfego e leva ~1 min pra acordar no próximo request. O banco Postgres free
> também expira depois de um tempo — conferir prazo no dashboard do Render.

## Dados de teste

4 perfis semeados via `V2__seed.sql`, senha em texto plano abaixo (hash BCrypt no
banco):

| Papel | E-mail | Senha |
|---|---|---|
| Organizador | `organizador@rolo35.com.br` | `organizador123` |
| Cliente | `cliente1@rolo35.com.br` | `cliente123` |
| Cliente | `cliente2@rolo35.com.br` | `cliente123` |
| Portaria | `portaria@rolo35.com.br` | `portaria123` |

Também existe 1 sessão publicada de exemplo ("Clube da Luta (placeholder)" — dado
de filme fictício, integração real com TMDb é da Story 1.2), numa sala de 40
assentos (5 fileiras x 8 colunas), todos com status `LIVRE`.

## Uso de IA

_(preencher: ferramentas usadas, em que partes do projeto, o que foi revisado ou
reescrito manualmente)_

## O que não funciona / ficou de fora

_(preencher conforme o desenvolvimento avançar)_
