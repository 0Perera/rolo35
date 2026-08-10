package br.com.rolo35.api.sessoes.dto;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.LocalDateTime;

public record CriarSessaoRequest(
        @NotNull Long salaId,
        @NotNull Long tmdbId,
        @NotBlank String titulo,
        String posterUrl,
        String sinopse,
        String dataEstreia,
        @NotNull LocalDateTime dataHora,
        // Espelha a coluna preco NUMERIC(10,2): sem isso, escala maior é arredondada em
        // silêncio pelo Postgres e magnitude maior estoura o INSERT como erro interno.
        @NotNull @Positive @Digits(integer = 8, fraction = 2) BigDecimal preco) {
}
