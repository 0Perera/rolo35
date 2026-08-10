package br.com.rolo35.api.sessoes.dto;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDateTime;

public record SessaoListagemDto(
        Long id,
        String salaNome,
        Long tmdbId,
        String titulo,
        String posterUrl,
        String sinopse,
        Date dataEstreia,
        LocalDateTime dataHora,
        BigDecimal preco,
        int capacidade,
        boolean esgotada) {
}
