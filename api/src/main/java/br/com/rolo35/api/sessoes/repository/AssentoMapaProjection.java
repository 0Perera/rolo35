package br.com.rolo35.api.sessoes.repository;

import java.time.LocalDateTime;

public interface AssentoMapaProjection {

    Long getAssentoId();

    String getFileira();

    Integer getNumero();

    String getStatus();

    LocalDateTime getExpiresAt();
}
