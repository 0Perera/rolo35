-- Suporta o filtro de AssentoSessaoRepository.buscarAssentosDaReserva(): a coluna reserva_id de
-- assento_sessao passa a ser critério de busca de produção (retomada do checkout), e não só campo
-- gravado pelos UPDATEs de reserva/pagamento. Sem o índice, cada abertura da tela de pagamento
-- varre a tabela inteira. Mesmo raciocínio da V4.
CREATE INDEX idx_assento_sessao_reserva_id ON assento_sessao (reserva_id);
