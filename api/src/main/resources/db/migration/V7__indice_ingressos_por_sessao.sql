-- O painel de turno da portaria (FR-21) conta e lista ingressos filtrando por sessao_id. Sem
-- índice, cada refresh do painel — que acontece a cada validação, na frente da fila — faz
-- sequential scan na tabela de ingressos. Mesma razão do V4, que indexou o caminho de
-- "Meus Ingressos".
CREATE INDEX idx_ingressos_sessao_id ON ingressos (sessao_id);
