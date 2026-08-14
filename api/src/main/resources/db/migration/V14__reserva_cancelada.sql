-- O cliente que voltava do checkout pra trocar de assento deixava o hold anterior de pé: saía
-- segurando dois conjuntos, e o abandonado ficava bloqueado até o TTL de 10min vencer — pra todo
-- mundo, não só pra ele. Agora uma reserva nova na mesma sessão cancela a anterior, e o estado
-- precisa de nome próprio no CHECK.
--
-- CANCELADA e não RECUSADA: RECUSADA é desfecho de pagamento simulado, houve tentativa e resposta.
-- Reaproveitar aquele valor faria o histórico do cliente registrar uma recusa que nunca existiu.
ALTER TABLE reservas DROP CONSTRAINT reservas_status_check;

ALTER TABLE reservas
    ADD CONSTRAINT reservas_status_check
    CHECK (status IN ('ATIVA', 'CONFIRMADA', 'RECUSADA', 'CANCELADA'));
