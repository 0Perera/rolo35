package br.com.rolo35.api.ingressos.dto;

import br.com.rolo35.api.ingressos.StatusIngresso;
import java.time.LocalDateTime;
import java.util.UUID;

public record IngressoResumoDto(
        UUID id,
        StatusIngresso status,
        String assentoFileira,
        Integer assentoNumero,
        String sessaoTitulo,
        String sessaoPosterUrl,
        String salaNome,
        LocalDateTime dataHora,
        String codigo,
        String codigoCurto) {}
