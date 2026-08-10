package br.com.rolo35.api.sessoes.repository;

import br.com.rolo35.api.sessoes.Sessao;
import java.time.LocalDateTime;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SessaoRepository extends JpaRepository<Sessao, Long> {

    @Query(value = """
        SELECT EXISTS (
          SELECT 1 FROM sessoes
          WHERE sala_id = :salaId
            AND data_hora < (CAST(:dataHora AS timestamp) + (INTERVAL '1 minute' * :bufferMinutos))
            AND (data_hora + (INTERVAL '1 minute' * :bufferMinutos)) > CAST(:dataHora AS timestamp)
        )""", nativeQuery = true)
    boolean existeConflitante(
            @Param("salaId") Long salaId, @Param("dataHora") LocalDateTime dataHora,
            @Param("bufferMinutos") int bufferMinutos);
}
