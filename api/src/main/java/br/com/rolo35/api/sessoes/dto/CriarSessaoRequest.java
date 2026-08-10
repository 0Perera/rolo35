package br.com.rolo35.api.sessoes.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record CriarSessaoRequest(
        Long salaId,
        Long tmdbId,
        String titulo,
        String posterUrl,
        String sinopse,
        String dataEstreia,
        LocalDateTime dataHora,
        BigDecimal preco) {
}
