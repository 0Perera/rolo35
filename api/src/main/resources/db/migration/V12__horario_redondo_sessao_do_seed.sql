-- A sessão da V2 nasce em `now() + interval '7 days'`, sem truncar: ela herda o minuto, o segundo e
-- o microssegundo em que o banco subiu, e a vitrine abre anunciando algo como "19/08 · 01:28".
-- Nenhum cinema exibe às 01:28:01, e o horário quebrado aparece em tudo que fala daquela sessão —
-- card, compra, canhoto, link público do ingresso.
--
-- A V10 já resolvia isso pras sessões dela com `date_trunc('hour', now())`; a V2 é anterior e ficou
-- de fora. Corrigir na origem exigiria editar a V2, o que troca o checksum e faz o Flyway recusar a
-- subida em qualquer banco onde ela já rodou — daí a correção vir como migration nova, que também
-- conserta os bancos existentes em vez de valer só pra quem criar um do zero.
--
-- O alvo é identificado por ter segundos/microssegundos no horário, não por título ou id: sessão
-- criada pela aplicação vem de um <input type="datetime-local">, que só produz hora e minuto, então
-- `data_hora` com segundo não-zero é assinatura de linha semeada por `now()`. Um filtro por
-- `titulo = 'Clube da Luta'` pegaria junto qualquer sessão real com o mesmo filme, e um por id
-- assumiria que a sequência começa em 1.
UPDATE sessoes alvo
SET data_hora = date_trunc('day', alvo.data_hora)
    -- 20h é horário de sessão de cinema de verdade. A alternativa das 14h existe pro caso de a
    -- sessão da V10 na mesma sala já ocupar a janela de 4h em volta das 20h (o buffer de
    -- SessaoService, que depende da hora em que o banco subiu): um seed não deve deixar o banco num
    -- estado que a própria aplicação recusaria criar. As 14h ficam a 6h das 20h, fora da janela.
    + CASE
        WHEN EXISTS (
            SELECT 1
            FROM sessoes outra
            WHERE outra.sala_id = alvo.sala_id
              AND outra.id <> alvo.id
              AND outra.data_hora > date_trunc('day', alvo.data_hora) + INTERVAL '16 hours'
              AND outra.data_hora < date_trunc('day', alvo.data_hora) + INTERVAL '24 hours'
        ) THEN INTERVAL '14 hours'
        ELSE INTERVAL '20 hours'
      END
WHERE date_trunc('minute', alvo.data_hora) <> alvo.data_hora;
