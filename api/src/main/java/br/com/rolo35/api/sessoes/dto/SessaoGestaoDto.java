package br.com.rolo35.api.sessoes.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record SessaoGestaoDto(
        Long id,
        Long salaId,
        String salaNome,
        String titulo,
        String sinopse,
        LocalDateTime dataHora,
        BigDecimal preco,
        int capacidade,
        boolean editavel) {
}
