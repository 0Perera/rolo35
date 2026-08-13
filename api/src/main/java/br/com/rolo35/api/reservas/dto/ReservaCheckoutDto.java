package br.com.rolo35.api.reservas.dto;

import br.com.rolo35.api.reservas.StatusReserva;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Tudo que a tela de pagamento precisa pra se reconstruir sozinha a partir da URL. Diferente do
 * {@link ReservaDto} devolvido pela criação da reserva, que é enxuto porque quem o recebe acabou de
 * informar o que pediu — aqui o cliente pode estar chegando por um F5, sem nada em mãos.
 */
public record ReservaCheckoutDto(
        Long id,
        Long sessaoId,
        StatusReserva status,
        LocalDateTime expiresAt,
        String sessaoTitulo,
        String salaNome,
        LocalDateTime dataHora,
        BigDecimal preco,
        List<AssentoReservadoDto> assentos) {}
