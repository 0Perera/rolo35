package br.com.rolo35.api.sessoes.repository;

import br.com.rolo35.api.sessoes.AssentoSessao;
import br.com.rolo35.api.sessoes.AssentoSessaoId;
import jakarta.persistence.LockModeType;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface AssentoSessaoRepository extends JpaRepository<AssentoSessao, AssentoSessaoId> {

    List<AssentoSessao> findByIdSessaoId(Long sessaoId);

    // ORDER BY assento_id é o mecanismo real de AD-3: evita deadlock entre duas reservas
    // concorrentes que pedem os mesmos assentos em ordem diferente — não é só estética.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query(
            """
            SELECT a FROM AssentoSessao a
            WHERE a.id.sessaoId = :sessaoId AND a.id.assentoId IN :assentoIds
            ORDER BY a.id.assentoId
            """)
    List<AssentoSessao> travarParaReserva(Long sessaoId, List<Long> assentoIds);

    // Mesmo mecanismo de travarParaReserva, pra todas as linhas da sessão — usado por
    // SessaoService.editar() antes de checar hold ativo/apagar numa troca de sala, fechando a
    // corrida em que um reservar() concorrente confirma um hold entre a leitura e o delete
    // (achado do code review da Story 3.2).
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query(
            """
            SELECT a FROM AssentoSessao a
            WHERE a.id.sessaoId = :sessaoId
            ORDER BY a.id.assentoId
            """)
    List<AssentoSessao> travarPorSessao(Long sessaoId);

    // @Modifying @Query em vez de save() de entidade recarregada: AssentoSessao é Persistable
    // sem setters (isNew() controlado só por @PostPersist/@PostLoad) — reconstruir a entidade
    // manualmente com o mesmo id forçaria isNew()=true e um INSERT sobre PK já existente.
    //
    // O WHERE de status/expiresAt é defesa em profundidade (achado do code review da Story 3.2):
    // o único call site atual (ReservaService.reservar) já confirma disponibilidade via
    // statusEfetivoLivre antes de chamar este método, mas o UPDATE em si não confiava nisso —
    // um futuro call site que pulasse essa checagem sobrescreveria um assento vendido/reservado
    // sem o banco reclamar. O retorno int (linhas afetadas) deixa o chamador perceber quando a
    // guarda recusou parte da atualização.
    @Modifying(clearAutomatically = true)
    @Query(
            """
            UPDATE AssentoSessao a SET a.status = 'RESERVADO', a.reservaId = :reservaId, a.expiresAt = :expiresAt
            WHERE a.id.sessaoId = :sessaoId AND a.id.assentoId IN :assentoIds
              AND (a.status = 'LIVRE' OR (a.status = 'RESERVADO' AND a.expiresAt < :agora))
            """)
    int reivindicar(Long sessaoId, List<Long> assentoIds, Long reservaId, LocalDateTime expiresAt, LocalDateTime agora);

    // Write path do pagamento aprovado (Story 4.1): a Reserva já foi travada via
    // ReservaRepository.findByIdForUpdate antes desta chamada. O WHERE por reservaId é defesa
    // em profundidade (achado do code review) — mesmo a Reserva já estando travada, o UPDATE em
    // si não confiava nisso; sem essa condição, um assentoIds calculado errado em algum call
    // site futuro sobrescreveria silenciosamente o assento de outra reserva. O retorno int
    // (linhas afetadas) deixa o chamador perceber quando a guarda recusou parte da atualização.
    //
    // flushAutomatically = true é obrigatório aqui: PagamentoService muta Reserva.status em
    // memória (reserva.confirmar()/recusar()) e chama save() ANTES deste método. Sem o flush
    // automático, clearAutomatically = true limpa o persistence context (entityManager.clear())
    // antes de qualquer flush do UPDATE pendente de Reserva — a mudança de status é descartada
    // silenciosamente, sem exceção, e a reserva volta ATIVA no banco (achado real: sem isso, o
    // PagamentoConcorrenciaConflitanteTest mostrava as duas chamadas concorrentes processando o
    // resultadoSimulado de cada uma como se a reserva nunca tivesse sido decidida).
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
            """
            UPDATE AssentoSessao a SET a.status = 'VENDIDO'
            WHERE a.id.sessaoId = :sessaoId AND a.id.assentoId IN :assentoIds AND a.reservaId = :reservaId
            """)
    int reivindicarVendido(Long sessaoId, List<Long> assentoIds, Long reservaId);

    // Write path do pagamento recusado (Story 4.1): libera a linha imediatamente, sem esperar o
    // TTL lazy de AD-4 — este caminho é escrita imediata, por decisão explícita da AC2. WHERE
    // por reservaId e flushAutomatically = true pelo mesmo motivo de reivindicarVendido() acima.
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
            """
            UPDATE AssentoSessao a SET a.status = 'LIVRE', a.reservaId = null, a.expiresAt = null
            WHERE a.id.sessaoId = :sessaoId AND a.id.assentoId IN :assentoIds AND a.reservaId = :reservaId
            """)
    int liberar(Long sessaoId, List<Long> assentoIds, Long reservaId);

    // LEFT JOIN em Reserva, não INNER: assento LIVRE tem reservaId null e precisa continuar na
    // lista. A coluna existe pra o mapa poder dizer "este hold é seu" — continua sendo uma query
    // só, sem N+1, que é o motivo desta projeção existir.
    @Query(
            """
            SELECT a.id AS assentoId, a.fileira AS fileira, a.numero AS numero,
                   asx.status AS status, asx.expiresAt AS expiresAt, r.clienteId AS clienteIdDoHold
            FROM AssentoSessao asx
            JOIN Assento a ON a.id = asx.id.assentoId
            LEFT JOIN Reserva r ON r.id = asx.reservaId
            WHERE asx.id.sessaoId = :sessaoId
            ORDER BY a.fileira, a.numero
            """)
    List<AssentoMapaProjection> buscarMapaPorSessao(Long sessaoId);

    // Libera tudo que uma reserva segura, sem precisar dos ids dos assentos. Usado quando o
    // cliente volta pra trocar de assento: a reserva nova cancela a anterior, e sem isso os
    // assentos abandonados ficavam presos até o TTL vencer — pra todo mundo, não só pra ele.
    //
    // O WHERE de status é defesa em profundidade, no mesmo espírito de liberar(): assento VENDIDO
    // nunca volta pra LIVRE por este caminho, mesmo que a reserva citada estivesse errada.
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
            """
            UPDATE AssentoSessao a SET a.status = 'LIVRE', a.reservaId = null, a.expiresAt = null
            WHERE a.reservaId = :reservaId AND a.status = 'RESERVADO'
            """)
    int liberarPorReserva(Long reservaId);

    // Leitura pura do contexto de checkout: os assentos de uma reserva já com título, sala, horário
    // e preço resolvidos. Uma query só, pelo mesmo motivo de buscarMapaPorSessao() — carregar as
    // linhas e resolver a sessão de cada uma depois seria N+1 numa tela que abre a cada F5.
    @Query(
            """
            SELECT a.id AS assentoId, a.fileira AS fileira, a.numero AS numero,
                   s.titulo AS sessaoTitulo, sa.nome AS salaNome, s.dataHora AS dataHora, s.preco AS preco
            FROM AssentoSessao asx
            JOIN Assento a ON a.id = asx.id.assentoId
            JOIN Sessao s ON s.id = asx.id.sessaoId
            JOIN Sala sa ON sa.id = s.salaId
            WHERE asx.reservaId = :reservaId
            ORDER BY a.fileira, a.numero
            """)
    List<ReservaCheckoutProjection> buscarAssentosDaReserva(Long reservaId);
}
