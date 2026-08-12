package br.com.rolo35.api.pagamentos.service;

import br.com.rolo35.api.auth.Usuario;
import br.com.rolo35.api.auth.repository.UsuarioRepository;
import br.com.rolo35.api.ingressos.Ingresso;
import br.com.rolo35.api.ingressos.StatusIngresso;
import br.com.rolo35.api.ingressos.repository.IngressoRepository;
import br.com.rolo35.api.ingressos.service.CodigoIngressoService;
import br.com.rolo35.api.pagamentos.NaoAutorizadoException;
import br.com.rolo35.api.pagamentos.ReservaExpiradaException;
import br.com.rolo35.api.pagamentos.ResultadoSimulado;
import br.com.rolo35.api.pagamentos.dto.ConfirmarPagamentoRequest;
import br.com.rolo35.api.pagamentos.dto.IngressoDto;
import br.com.rolo35.api.pagamentos.dto.PagamentoDto;
import br.com.rolo35.api.reservas.ClienteNaoEncontradoException;
import br.com.rolo35.api.reservas.Reserva;
import br.com.rolo35.api.reservas.StatusReserva;
import br.com.rolo35.api.reservas.repository.ReservaRepository;
import br.com.rolo35.api.sessoes.repository.AssentoSessaoRepository;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PagamentoService {

    private final ReservaRepository reservaRepository;
    private final AssentoSessaoRepository assentoSessaoRepository;
    private final IngressoRepository ingressoRepository;
    private final CodigoIngressoService codigoIngressoService;
    private final UsuarioRepository usuarioRepository;
    private final EntityManager entityManager;

    public PagamentoService(
            ReservaRepository reservaRepository, AssentoSessaoRepository assentoSessaoRepository,
            IngressoRepository ingressoRepository, CodigoIngressoService codigoIngressoService,
            UsuarioRepository usuarioRepository, EntityManager entityManager) {
        this.reservaRepository = reservaRepository;
        this.assentoSessaoRepository = assentoSessaoRepository;
        this.ingressoRepository = ingressoRepository;
        this.codigoIngressoService = codigoIngressoService;
        this.usuarioRepository = usuarioRepository;
        this.entityManager = entityManager;
    }

    @Transactional
    public PagamentoDto confirmar(ConfirmarPagamentoRequest request, String clienteEmail) {
        Usuario cliente =
                usuarioRepository.findByEmail(clienteEmail).orElseThrow(ClienteNaoEncontradoException::new);

        entityManager.createNativeQuery("SET LOCAL lock_timeout = '3s'").executeUpdate();
        // Reserva de outro cliente e reserva inexistente caem na mesma exceção/resposta (AC3) —
        // por design, não revelar se o reservaId existe ou de quem é.
        Reserva reserva = reservaRepository.findByIdForUpdate(request.reservaId())
                .filter(r -> r.getClienteId().equals(cliente.getId()))
                .orElseThrow(NaoAutorizadoException::new);

        if (reserva.getStatus() != StatusReserva.ATIVA) {
            // Idempotência: já decidido por uma chamada anterior (ou concorrente que venceu o
            // lock primeiro). Não reprocessa resultadoSimulado — devolve o que já é verdade.
            return montarResposta(reserva);
        }
        if (reserva.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new ReservaExpiradaException();
        }

        List<Long> assentoIds = assentoSessaoRepository.findByIdSessaoId(reserva.getSessaoId()).stream()
                .filter(a -> reserva.getId().equals(a.getReservaId()))
                .map(a -> a.getId().getAssentoId())
                .toList();

        if (request.resultadoSimulado() == ResultadoSimulado.APROVADO) {
            reserva.confirmar();
            reservaRepository.save(reserva);
            List<Ingresso> ingressos = assentoIds.stream()
                    .map(assentoId -> ingressoRepository.save(new Ingresso(
                            null, reserva.getId(), assentoId, reserva.getSessaoId(), StatusIngresso.VALIDO, null,
                            Instant.now())))
                    .toList();
            assentoSessaoRepository.reivindicarVendido(reserva.getSessaoId(), assentoIds);
            return new PagamentoDto(StatusReserva.CONFIRMADA, paraDto(ingressos));
        }

        reserva.recusar();
        reservaRepository.save(reserva);
        assentoSessaoRepository.liberar(reserva.getSessaoId(), assentoIds);
        return new PagamentoDto(StatusReserva.RECUSADA, List.of());
    }

    private PagamentoDto montarResposta(Reserva reserva) {
        if (reserva.getStatus() == StatusReserva.CONFIRMADA) {
            return new PagamentoDto(StatusReserva.CONFIRMADA, paraDto(ingressoRepository.findByReservaId(reserva.getId())));
        }
        return new PagamentoDto(reserva.getStatus(), List.of());
    }

    private List<IngressoDto> paraDto(List<Ingresso> ingressos) {
        return ingressos.stream()
                .map(ingresso -> new IngressoDto(
                        ingresso.getId(), ingresso.getAssentoId(), codigoIngressoService.gerar(ingresso.getId())))
                .toList();
    }
}
