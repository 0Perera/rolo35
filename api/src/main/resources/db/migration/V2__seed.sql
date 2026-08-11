-- Senhas em texto plano documentadas no README (seção Dados de teste).
-- Se este arquivo já tinha rodado antes numa versão anterior (checksum diferente),
-- o Flyway rejeita a nova subida: rode `docker compose down -v` antes do próximo boot.
INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES
    ('Organizador Rolo35', 'organizador@rolo35.com.br', '$2a$10$opn4ZXwT3eINEaBDXcu24OoJ7Bbv8yQGtieMQB2cl7zeutrBnByE2', 'ORGANIZADOR'),
    ('Cliente Um', 'cliente1@rolo35.com.br', '$2a$10$t1eBX9GJflavEbbaO9a63ORUUYPKgK0sd6Jlqqm215/u4iiSFbjQG', 'CLIENTE'),
    ('Cliente Dois', 'cliente2@rolo35.com.br', '$2a$10$t1eBX9GJflavEbbaO9a63ORUUYPKgK0sd6Jlqqm215/u4iiSFbjQG', 'CLIENTE'),
    ('Portaria Rolo35', 'portaria@rolo35.com.br', '$2a$10$TiTza50wHdFmDwnfsMvMCuTO6iaeuiyBhzYOrG0DCFH7ZYZyJXiv6', 'PORTARIA');

-- Três salas de tamanhos variados, pra exercitar o mapa de assentos com capacidades diferentes.
INSERT INTO salas (nome, linhas, colunas) VALUES
    ('Sala 1', 8, 10),
    ('Sala 2', 5, 6),
    ('Sala 3', 10, 14);

INSERT INTO assentos (sala_id, fileira, numero)
SELECT s.id, chr(64 + f.fileira_num), n.numero
FROM salas s
CROSS JOIN LATERAL generate_series(1, s.linhas) AS f(fileira_num)
CROSS JOIN LATERAL generate_series(1, s.colunas) AS n(numero);

-- Dado real obtido uma vez via TMDb (GET /search/movie?query=Clube da Luta&language=pt-BR,
-- o mesmo endpoint que TmdbClient.buscarPorTitulo usava em produção nesta data) e
-- congelado aqui — não é atualizado automaticamente se o TMDb mudar o conteúdo depois.
INSERT INTO sessoes (organizador_id, sala_id, tmdb_id, titulo, poster_url, sinopse, data_estreia, data_hora, preco)
SELECT
    (SELECT id FROM usuarios WHERE email = 'organizador@rolo35.com.br'),
    s.id,
    550,
    'Clube da Luta',
    'https://image.tmdb.org/t/p/w500/mCICnh7QBH0gzYaTQChBDDVIKdm.jpg',
    'Um homem deprimido que sofre de insônia conhece um estranho vendedor de sabonetes chamado Tyler Durden. Eles formam um clube clandestino com regras rígidas onde lutam com outros homens cansados de suas vidas mundanas. Mas sua parceria perfeita é comprometida quando Marla chama a atenção de Tyler.',
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
WHERE sess.titulo = 'Clube da Luta';
