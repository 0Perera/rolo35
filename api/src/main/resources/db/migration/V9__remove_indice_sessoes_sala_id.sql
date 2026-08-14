-- Redundante desde a V3: idx_sessoes_sala_id_data_hora (sala_id, data_hora) já serve toda consulta
-- que idx_sessoes_sala_id (sala_id) serviria — sala_id é o prefixo à esquerda do composto, e o
-- Postgres usa índice composto por prefixo. Sobrando, ele só custa: mais uma estrutura pra manter a
-- cada INSERT/UPDATE em sessoes e mais uma opção pro planner considerar sem ganho nenhum.
DROP INDEX idx_sessoes_sala_id;

-- Nenhum índice novo em sessoes.organizador_id. Ele era candidato enquanto a listagem de gestão
-- filtrava por dono; depois do CAP-1 (sessão é recurso do cinema, não do organizador) a query varre
-- a tabela inteira de propósito, e organizador_id deixou de ser critério de busca em qualquer
-- caminho de produção — virou só registro de autoria. Índice em coluna que ninguém filtra é o mesmo
-- desperdício que este DROP acabou de resolver.
