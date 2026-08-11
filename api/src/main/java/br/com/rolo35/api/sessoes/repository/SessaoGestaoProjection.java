package br.com.rolo35.api.sessoes.repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public interface SessaoGestaoProjection {

    Long getId();

    Long getSalaId();

    String getSalaNome();

    String getTitulo();

    LocalDateTime getDataHora();

    BigDecimal getPreco();

    int getCapacidade();

    boolean getEditavel();
}
