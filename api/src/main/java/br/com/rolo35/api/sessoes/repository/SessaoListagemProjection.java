package br.com.rolo35.api.sessoes.repository;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDateTime;

public interface SessaoListagemProjection {

    Long getId();

    String getSalaNome();

    Long getTmdbId();

    String getTitulo();

    String getPosterUrl();

    String getSinopse();

    Date getDataEstreia();

    LocalDateTime getDataHora();

    BigDecimal getPreco();

    int getCapacidade();

    long getAssentosLivres();
}
