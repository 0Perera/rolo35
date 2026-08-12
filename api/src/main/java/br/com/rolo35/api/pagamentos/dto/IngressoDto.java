package br.com.rolo35.api.pagamentos.dto;

import java.util.UUID;

public record IngressoDto(UUID id, Long assentoId, String codigo) {}
