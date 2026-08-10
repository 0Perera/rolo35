package br.com.rolo35.api.sessoes.repository;

import br.com.rolo35.api.sessoes.Assento;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AssentoRepository extends JpaRepository<Assento, Long> {

    List<Assento> findBySalaId(Long salaId);
}
