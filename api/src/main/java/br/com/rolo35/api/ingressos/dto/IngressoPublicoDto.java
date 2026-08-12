package br.com.rolo35.api.ingressos.dto;

import br.com.rolo35.api.ingressos.StatusIngresso;
import java.time.LocalDateTime;

public record IngressoPublicoDto(String sessaoTitulo, String salaNome, LocalDateTime dataHora, StatusIngresso status) {}
