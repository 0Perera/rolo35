package br.com.rolo35.api.sessoes.dto;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.LocalDateTime;

public record EditarSessaoRequest(
        @NotNull Long salaId,
        @NotBlank String titulo,
        String sinopse,
        @NotNull LocalDateTime dataHora,
        @NotNull @Positive @Digits(integer = 8, fraction = 2) BigDecimal preco) {
}
