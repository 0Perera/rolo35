package br.com.rolo35.api.reservas.repository;

import br.com.rolo35.api.reservas.Reserva;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReservaRepository extends JpaRepository<Reserva, Long> {}
