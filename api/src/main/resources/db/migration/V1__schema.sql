CREATE TABLE usuarios (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    papel VARCHAR(20) NOT NULL CHECK (papel IN ('ORGANIZADOR', 'CLIENTE', 'PORTARIA')),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uk_usuarios_email UNIQUE (email)
);

CREATE INDEX idx_usuarios_email ON usuarios (email);

CREATE TABLE salas (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    linhas INTEGER NOT NULL,
    colunas INTEGER NOT NULL
);

CREATE TABLE assentos (
    id BIGSERIAL PRIMARY KEY,
    sala_id BIGINT NOT NULL REFERENCES salas (id),
    fileira VARCHAR(5) NOT NULL,
    numero INTEGER NOT NULL,
    CONSTRAINT uk_assentos_sala_posicao UNIQUE (sala_id, fileira, numero)
);

CREATE TABLE sessoes (
    id BIGSERIAL PRIMARY KEY,
    organizador_id BIGINT NOT NULL REFERENCES usuarios (id),
    sala_id BIGINT NOT NULL REFERENCES salas (id),
    tmdb_id BIGINT NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    poster_url VARCHAR(500),
    sinopse TEXT,
    data_estreia DATE,
    data_hora TIMESTAMP NOT NULL,
    preco NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessoes_data_hora ON sessoes (data_hora);
CREATE INDEX idx_sessoes_sala_id ON sessoes (sala_id);

CREATE TABLE reservas (
    id BIGSERIAL PRIMARY KEY,
    cliente_id BIGINT NOT NULL REFERENCES usuarios (id),
    sessao_id BIGINT NOT NULL REFERENCES sessoes (id),
    status VARCHAR(20) NOT NULL CHECK (status IN ('ATIVA', 'CONFIRMADA', 'RECUSADA')),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    expires_at TIMESTAMP
);

CREATE TABLE assento_sessao (
    sessao_id BIGINT NOT NULL REFERENCES sessoes (id),
    assento_id BIGINT NOT NULL REFERENCES assentos (id),
    status VARCHAR(20) NOT NULL CHECK (status IN ('LIVRE', 'RESERVADO', 'VENDIDO')),
    reserva_id BIGINT REFERENCES reservas (id),
    expires_at TIMESTAMP,
    PRIMARY KEY (sessao_id, assento_id)
);

CREATE TABLE ingressos (
    id UUID PRIMARY KEY,
    reserva_id BIGINT NOT NULL REFERENCES reservas (id),
    assento_id BIGINT NOT NULL REFERENCES assentos (id),
    sessao_id BIGINT NOT NULL REFERENCES sessoes (id),
    status VARCHAR(20) NOT NULL CHECK (status IN ('VALIDO', 'UTILIZADO')),
    validated_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);
