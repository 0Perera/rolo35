CREATE TABLE turno_portaria (
    usuario_id BIGINT PRIMARY KEY REFERENCES usuarios (id),
    sessao_id BIGINT NOT NULL REFERENCES sessoes (id),
    selecionado_em TIMESTAMP NOT NULL DEFAULT now()
);
