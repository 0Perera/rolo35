package br.com.rolo35.api.sessoes.repository;

import br.com.rolo35.api.sessoes.AssentoSessao;
import br.com.rolo35.api.sessoes.AssentoSessaoId;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AssentoSessaoRepository extends JpaRepository<AssentoSessao, AssentoSessaoId> {
}
