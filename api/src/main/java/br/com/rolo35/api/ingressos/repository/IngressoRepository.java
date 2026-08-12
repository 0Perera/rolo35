package br.com.rolo35.api.ingressos.repository;

import br.com.rolo35.api.ingressos.Ingresso;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IngressoRepository extends JpaRepository<Ingresso, UUID> {

    List<Ingresso> findByReservaId(Long reservaId);
}
