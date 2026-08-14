-- Cinco sessões a mais, pra que a vitrine mostre o que ela sabe fazer já no primeiro boot: filme
-- com mais de um horário (Matrix e Clube da Luta, cada um em duas datas/salas), preços diferentes
-- entre sessões (o "a partir de" da tela de filme só aparece quando divergem) e as três salas em
-- uso. Com uma sessão só, metade da listagem parecia sem função.
--
-- Migration nova em vez de editar a V2: aquele arquivo já rodou em qualquer banco existente, e
-- mudar seu conteúdo trocaria o checksum — o Flyway recusaria a subida seguinte.
--
-- Dados de filme reais, buscados uma vez no TMDb (mesmo endpoint que TmdbClient usa) e congelados
-- aqui, igual à V2. Não são atualizados se o TMDb mudar o conteúdo depois.

WITH dados (sala_nome, tmdb_id, titulo, poster_url, sinopse, data_estreia, horas_a_frente, preco) AS (
    VALUES
        -- Sala 1 já tem Clube da Luta em now() + 7 dias (V2). Estas 5h de distância respeitam o
        -- buffer de 4h que SessaoService aplica — um seed não deve criar estado que a própria
        -- aplicação recusaria criar.
        ('Sala 1', 603, 'Matrix',
         'https://image.tmdb.org/t/p/w500/lDqMDI3xpbB9UQRyeXfei0MXhqb.jpg',
         'O jovem programador Thomas Anderson é atormentado por estranhos pesadelos em que está sempre conectado por cabos a um imenso sistema de computadores do futuro. À medida que o sonho se repete, ele começa a desconfiar da realidade. Thomas conhece os misteriosos Morpheus e Trinity e descobre que é vítima de um sistema inteligente e artificial chamado Matrix, que manipula a mente das pessoas e cria a ilusão de um mundo real enquanto usa os cérebros e corpos dos indivíduos para produzir energia.',
         DATE '1999-03-31', 7 * 24 + 5, 30.00),
        ('Sala 2', 603, 'Matrix',
         'https://image.tmdb.org/t/p/w500/lDqMDI3xpbB9UQRyeXfei0MXhqb.jpg',
         'O jovem programador Thomas Anderson é atormentado por estranhos pesadelos em que está sempre conectado por cabos a um imenso sistema de computadores do futuro. À medida que o sonho se repete, ele começa a desconfiar da realidade. Thomas conhece os misteriosos Morpheus e Trinity e descobre que é vítima de um sistema inteligente e artificial chamado Matrix, que manipula a mente das pessoas e cria a ilusão de um mundo real enquanto usa os cérebros e corpos dos indivíduos para produzir energia.',
         DATE '1999-03-31', 8 * 24, 22.00),
        ('Sala 3', 550, 'Clube da Luta',
         'https://image.tmdb.org/t/p/w500/mCICnh7QBH0gzYaTQChBDDVIKdm.jpg',
         'Um homem deprimido que sofre de insônia conhece um estranho vendedor de sabonetes chamado Tyler Durden. Eles formam um clube clandestino com regras rígidas onde lutam com outros homens cansados de suas vidas mundanas. Mas sua parceria perfeita é comprometida quando Marla chama a atenção de Tyler.',
         DATE '1999-10-15', 9 * 24, 28.00),
        ('Sala 2', 598, 'Cidade de Deus',
         'https://image.tmdb.org/t/p/w500/gfnXixcGC060QcG6JPxN6AMdVsq.jpg',
         'Buscapé é um jovem morador da Cidade de Deus que cresce em meio à violência. Com medo de se tornar um bandido, enxerga na fotografia uma oportunidade de ter uma vida digna.',
         DATE '2002-08-30', 9 * 24 + 6, 25.00),
        ('Sala 3', 27205, 'A Origem',
         'https://image.tmdb.org/t/p/w500/9e3Dz7aCANy5aRUQF745IlNloJ1.jpg',
         'Cobb é um ladrão habilidoso que comete espionagem corporativa infiltrando-se no subconsciente de seus alvos durante o estado de sono. Impedido de retornar para sua família, ele recebe a oportunidade de se redimir ao realizar uma tarefa aparentemente impossível: plantar uma ideia na mente do herdeiro de um império. Para realizar o crime perfeito, ele conta com a ajuda do parceiro Arthur, o discreto Eames e a arquiteta de sonhos Ariadne. Juntos, eles correm para que o inimigo não antecipe seus passos.',
         DATE '2010-07-15', 10 * 24, 35.00)
),
novas AS (
    INSERT INTO sessoes (organizador_id, sala_id, tmdb_id, titulo, poster_url, sinopse, data_estreia, data_hora, preco)
    SELECT
        (SELECT id FROM usuarios WHERE email = 'organizador@rolo35.com.br'),
        s.id, d.tmdb_id, d.titulo, d.poster_url, d.sinopse, d.data_estreia,
        -- Hora cheia, pra que a listagem não abra com horários quebrados no minuto em que o banco
        -- subiu. O truncamento encurta a distância pra sessão da V2 em até 59min, o que ainda deixa
        -- as duas da Sala 1 a 4h ou mais uma da outra.
        date_trunc('hour', now()) + (d.horas_a_frente * INTERVAL '1 hour'),
        d.preco
    FROM dados d
    JOIN salas s ON s.nome = d.sala_nome
    RETURNING id, sala_id
)
INSERT INTO assento_sessao (sessao_id, assento_id, status)
SELECT n.id, a.id, 'LIVRE'
FROM novas n
JOIN assentos a ON a.sala_id = n.sala_id;
