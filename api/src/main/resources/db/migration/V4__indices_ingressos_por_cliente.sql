-- Suporta o filtro/join de IngressoRepository.buscarPorCliente() (Story 4.2): busca reservas por
-- cliente_id, depois ingressos pela reserva encontrada. Sem esses índices, as duas tabelas
-- sofrem sequential scan a cada chamada de "Meus Ingressos".
CREATE INDEX idx_reservas_cliente_id ON reservas (cliente_id);
CREATE INDEX idx_ingressos_reserva_id ON ingressos (reserva_id);
