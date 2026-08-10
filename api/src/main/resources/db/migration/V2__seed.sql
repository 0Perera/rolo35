-- Senhas em texto plano documentadas no README (seção Dados de teste).
INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES
    ('Organizador Rolo35', 'organizador@rolo35.com.br', '$2a$10$opn4ZXwT3eINEaBDXcu24OoJ7Bbv8yQGtieMQB2cl7zeutrBnByE2', 'ORGANIZADOR'),
    ('Cliente Um', 'cliente1@rolo35.com.br', '$2a$10$t1eBX9GJflavEbbaO9a63ORUUYPKgK0sd6Jlqqm215/u4iiSFbjQG', 'CLIENTE'),
    ('Cliente Dois', 'cliente2@rolo35.com.br', '$2a$10$t1eBX9GJflavEbbaO9a63ORUUYPKgK0sd6Jlqqm215/u4iiSFbjQG', 'CLIENTE'),
    ('Portaria Rolo35', 'portaria@rolo35.com.br', '$2a$10$TiTza50wHdFmDwnfsMvMCuTO6iaeuiyBhzYOrG0DCFH7ZYZyJXiv6', 'PORTARIA');

INSERT INTO salas (nome, linhas, colunas) VALUES
    ('Sala 1', 5, 8);

INSERT INTO assentos (sala_id, fileira, numero)
SELECT s.id, chr(64 + fileira_num), numero
FROM salas s
CROSS JOIN generate_series(1, 5) AS fileira_num
CROSS JOIN generate_series(1, 8) AS numero
WHERE s.nome = 'Sala 1';

INSERT INTO sessoes (organizador_id, sala_id, tmdb_id, titulo, poster_url, sinopse, data_estreia, data_hora, preco)
SELECT
    (SELECT id FROM usuarios WHERE email = 'organizador@rolo35.com.br'),
    s.id,
    550,
    'Clube da Luta (placeholder)',
    'https://image.tmdb.org/t/p/w500/placeholder.jpg',
    'Sinopse placeholder — integração real com TMDb chega na Story 1.2.',
    '1999-10-15',
    now() + interval '7 days',
    25.00
FROM salas s
WHERE s.nome = 'Sala 1';

INSERT INTO assento_sessao (sessao_id, assento_id, status)
SELECT sess.id, a.id, 'LIVRE'
FROM sessoes sess
JOIN salas s ON s.id = sess.sala_id
JOIN assentos a ON a.sala_id = s.id
WHERE sess.titulo = 'Clube da Luta (placeholder)';
