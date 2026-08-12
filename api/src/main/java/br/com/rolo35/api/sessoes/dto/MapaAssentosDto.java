package br.com.rolo35.api.sessoes.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record MapaAssentosDto(
        Long sessaoId,
        String titulo,
        String posterUrl,
        String salaNome,
        LocalDateTime dataHora,
        BigDecimal preco,
        List<AssentoMapaDto> assentos) {}
