-- Mais três sessões, uma por sala, pra estender a vitrine além dos dez dias que a V2 e a V10 cobrem
-- e trazer três filmes que não se confundem com os já semeados. Nenhuma delas repete um tmdb_id
-- existente: os dois filmes com mais de um horário continuam sendo Matrix e Clube da Luta.
--
-- Migration nova em vez de editar a V10, pelo motivo de sempre: aquele arquivo já rodou em qualquer
-- banco existente, e mudar seu conteúdo trocaria o checksum — o Flyway recusaria a subida seguinte.
--
-- Dados de filme reais, buscados uma vez no TMDb (o mesmo catálogo que TmdbClient consulta) e
-- congelados aqui, igual à V2 e à V10. Não são atualizados se o TMDb mudar o conteúdo depois. Uma
-- correção: a sinopse pt-BR de "De Volta para o Futuro" traz "máquino do tempo" no TMDb, e o erro
-- de digitação apareceria no card, no detalhe do filme e na busca — está grafado "máquina" abaixo.

WITH dados (sala_nome, tmdb_id, titulo, poster_url, sinopse, data_estreia, dias_a_frente, hora, preco) AS (
    VALUES
        -- Do décimo primeiro dia em diante, ou seja, depois de tudo que a V2 e a V10 semearam (a
        -- sessão mais distante delas está no décimo dia). Nenhuma destas cai dentro do buffer de 4h
        -- que SessaoService exige entre duas sessões da mesma sala — um seed não deve criar estado
        -- que a própria aplicação recusaria criar.
        ('Sala 1', 105, 'De Volta para o Futuro',
         'https://image.tmdb.org/t/p/w500/i996T0lI1fGtFEowiH3V6eZthL0.jpg',
         'Marty McFly, um típico adolescente americano dos anos 80, acidentalmente é enviado de volta ao ano de 1955 em um carro modificado para ser uma máquina do tempo, inventada por um cientista louco.',
         DATE '1985-07-03', 11, 20, 26.00),
        ('Sala 2', 1339713, 'Obsessão',
         'https://image.tmdb.org/t/p/w500/wUc6IDf5ChjM1UyQye21qFBeJY0.jpg',
         'Sem grandes pretensões, um romântico incurável compra um brinquedo que promete realizar desejos únicos. Ele quebra o artefato misterioso enquanto pede para conquistar a crush e consegue exatamente o que desejava, mas descobre que a consequência é sinistra.',
         DATE '2026-05-14', 12, 20, 24.00),
        ('Sala 3', 1359, 'Psicopata Americano',
         'https://image.tmdb.org/t/p/w500/4AiFo2MwU62mTtuZ7VH16tlZcmo.jpg',
         'Em Nova York, em 1987, o belo jovem profissional Patrick Bateman tem uma segunda vida como um horrível assassino em série durante a noite.',
         DATE '2000-04-14', 13, 22, 32.00)
),
novas AS (
    INSERT INTO sessoes (organizador_id, sala_id, tmdb_id, titulo, poster_url, sinopse, data_estreia, data_hora, preco)
    SELECT
        (SELECT id FROM usuarios WHERE email = 'organizador@rolo35.com.br'),
        s.id, d.tmdb_id, d.titulo, d.poster_url, d.sinopse, d.data_estreia,
        -- Ancorado no início do dia, não na hora em que o banco subiu: assim o horário é o mesmo em
        -- qualquer boot e é horário de cinema de verdade (20h, e 22h pra sessão da madrugada), do
        -- mesmo jeito que a V12 corrigiu a sessão da V2.
        date_trunc('day', now())
            + (d.dias_a_frente * INTERVAL '1 day')
            + (d.hora * INTERVAL '1 hour'),
        d.preco
    FROM dados d
    JOIN salas s ON s.nome = d.sala_nome
    RETURNING id, sala_id
)
INSERT INTO assento_sessao (sessao_id, assento_id, status)
SELECT n.id, a.id, 'LIVRE'
FROM novas n
JOIN assentos a ON a.sala_id = n.sala_id;
