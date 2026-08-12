package br.com.rolo35.api.sessoes.repository;

import br.com.rolo35.api.sessoes.AssentoSessao;
import br.com.rolo35.api.sessoes.AssentoSessaoId;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface AssentoSessaoRepository extends JpaRepository<AssentoSessao, AssentoSessaoId> {

    List<AssentoSessao> findByIdSessaoId(Long sessaoId);

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
