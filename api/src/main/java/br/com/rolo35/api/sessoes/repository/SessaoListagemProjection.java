package br.com.rolo35.api.sessoes.repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public interface SessaoListagemProjection {

    Long getId();

    String getSalaNome();

    Long getTmdbId();

    String getTitulo();

    String getPosterUrl();

    String getSinopse();

    // Precisa bater com o tipo do campo na entidade (LocalDate) — a projection não converte
    // pra java.sql.Date, e a incompatibilidade só estoura em runtime (500), não em compile time.
    LocalDate getDataEstreia();

    LocalDateTime getDataHora();

    BigDecimal getPreco();

    int getCapacidade();

    long getAssentosLivres();
}
