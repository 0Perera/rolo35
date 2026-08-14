-- Código curto pro caminho de digitação manual na portaria: a câmera falha (luz, tela riscada,
-- celular sem bateria) e o fallback até aqui era digitar `uuid.assinatura` — 36 caracteres mais uma
-- assinatura Base64. Ninguém faz isso na frente de uma fila.
--
-- O QR e o link público continuam carregando o código HMAC completo, sem mudança: este código não
-- substitui aquele, existe ao lado dele.
ALTER TABLE ingressos ADD COLUMN codigo_curto VARCHAR(8);

-- Ingressos que já existiam recebem um código derivado do próprio id. Determinístico de propósito:
-- reexecutar a migration num banco restaurado produz o mesmo valor, e os 32 primeiros bits de um
-- UUID já são únicos na prática — se não forem, o índice abaixo falha alto em vez de deixar dois
-- ingressos com o mesmo código. O hexadecimal do UUID só usa 0-9A-F, que é subconjunto do alfabeto
-- Base32 Crockford usado na emissão nova.
UPDATE ingressos SET codigo_curto = upper(substr(replace(id::text, '-', ''), 1, 8))
WHERE codigo_curto IS NULL;

ALTER TABLE ingressos ALTER COLUMN codigo_curto SET NOT NULL;

-- UNIQUE porque o código é o critério de busca da validação manual: dois iguais fariam a portaria
-- liberar a poltrona errada. O índice serve as duas coisas — a unicidade e o lookup.
CREATE UNIQUE INDEX idx_ingressos_codigo_curto ON ingressos (codigo_curto);
