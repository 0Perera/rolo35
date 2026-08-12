package br.com.rolo35.api.ingressos.repository;

import java.time.LocalDateTime;
import java.util.UUID;

public interface IngressoResumoProjection {
    UUID getId();

    String getStatus();

    String getAssentoFileira();

    Integer getAssentoNumero();

    String getSessaoTitulo();

    String getSessaoPosterUrl();

    String getSalaNome();

    LocalDateTime getDataHora();
}
