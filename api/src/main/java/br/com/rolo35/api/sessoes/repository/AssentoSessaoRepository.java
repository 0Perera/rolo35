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

    // @Modifying @Query em vez de save() de entidade recarregada: AssentoSessao é Persistable
    // sem setters (isNew() controlado só por @PostPersist/@PostLoad) — reconstruir a entidade
    // manualmente com o mesmo id forçaria isNew()=true e um INSERT sobre PK já existente.
    @Modifying(clearAutomatically = true)
    @Query(
            """
            UPDATE AssentoSessao a SET a.status = 'RESERVADO', a.reservaId = :reservaId, a.expiresAt = :expiresAt
            WHERE a.id.sessaoId = :sessaoId AND a.id.assentoId IN :assentoIds
            """)
    void reivindicar(Long sessaoId, List<Long> assentoIds, Long reservaId, LocalDateTime expiresAt);

    @Query(
            """
            SELECT a.id AS assentoId, a.fileira AS fileira, a.numero AS numero,
                   asx.status AS status, asx.expiresAt AS expiresAt
            FROM AssentoSessao asx JOIN Assento a ON a.id = asx.id.assentoId
            WHERE asx.id.sessaoId = :sessaoId
            ORDER BY a.fileira, a.numero
            """)
    List<AssentoMapaProjection> buscarMapaPorSessao(Long sessaoId);
}
