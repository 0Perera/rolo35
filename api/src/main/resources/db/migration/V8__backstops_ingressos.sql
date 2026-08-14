-- Dois invariantes de não-duplicação que até aqui só existiam no código de PagamentoService.
-- Enquanto ele for o único caminho de emissão, nada muda; o backstop existe pro dia em que não
-- for (script de correção, endpoint novo, bug de concorrência) — o mesmo raciocínio da PK
-- composta de assento_sessao, que já protege a reserva no banco e não só no service.

-- 1. O ingresso passa a apontar pra uma linha real do mapa daquela sessão, não pra um par
-- (sessão, assento) qualquer. As FKs separadas de sessao_id e assento_id continuam existindo e
-- não cobrem isto: cada uma valida sua coluna isolada, então um assento da Sala 2 num ingresso de
-- sessão da Sala 1 passava pelas duas. Também impede que assento_sessao perca uma linha que
-- sustenta ingresso emitido — hoje SessaoService.editar() já recusa troca de sala com ingresso
-- confirmado, e agora o banco recusa junto.
ALTER TABLE ingressos
    ADD CONSTRAINT fk_ingressos_assento_sessao
    FOREIGN KEY (sessao_id, assento_id) REFERENCES assento_sessao (sessao_id, assento_id);

-- 2. Uma reserva não emite dois ingressos pro mesmo assento. É o que o .map() sobre assentoIds de
-- PagamentoService.confirmar() garante hoje por construção (a lista vem de assento_sessao, sem
-- repetição possível), e o que uma reexecução parcial da emissão quebraria em silêncio: o cliente
-- veria dois canhotos do mesmo lugar e a portaria, dois VALIDO pra uma poltrona só.
ALTER TABLE ingressos
    ADD CONSTRAINT uq_ingressos_reserva_assento UNIQUE (reserva_id, assento_id);
