package br.com.rolo35.api.pagamentos.dto;

import br.com.rolo35.api.reservas.StatusReserva;
import java.util.List;

public record PagamentoDto(StatusReserva status, List<IngressoDto> ingressos) {}
