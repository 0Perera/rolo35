package br.com.rolo35.api.pagamentos.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

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
import br.com.rolo35.api.pagamentos.dto.PagamentoDto;
import br.com.rolo35.api.reservas.Reserva;
import br.com.rolo35.api.reservas.StatusReserva;
import br.com.rolo35.api.reservas.repository.ReservaRepository;
import br.com.rolo35.api.sessoes.AssentoSessao;
import br.com.rolo35.api.sessoes.AssentoSessaoId;
import br.com.rolo35.api.sessoes.repository.AssentoSessaoRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class PagamentoServiceTest {

    private static final String CLIENTE_EMAIL = "cliente1@rolo35.com.br";
    private static final Long CLIENTE_ID = 7L;
    private static final Long SESSAO_ID = 1L;
    private static final Long RESERVA_ID = 50L;

    @Mock
    private ReservaRepository reservaRepository;

    @Mock
    private AssentoSessaoRepository assentoSessaoRepository;

    @Mock
    private IngressoRepository ingressoRepository;

    @Mock
    private CodigoIngressoService codigoIngressoService;

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private EntityManager entityManager;

    @Mock
    private Query query;

    private PagamentoService pagamentoService;

    private void setUp() {
        pagamentoService = new PagamentoService(
                reservaRepository, assentoSessaoRepository, ingressoRepository, codigoIngressoService,
                usuarioRepository, entityManager);
    }

    private void stubEntityManager() {
        given(entityManager.createNativeQuery(any(String.class))).willReturn(query);
    }

    private void stubCliente() {
        Usuario usuario = new Usuario();
        ReflectionTestUtils.setField(usuario, "id", CLIENTE_ID);
        ReflectionTestUtils.setField(usuario, "email", CLIENTE_EMAIL);
        ReflectionTestUtils.setField(usuario, "papel", "CLIENTE");
        given(usuarioRepository.findByEmail(CLIENTE_EMAIL)).willReturn(Optional.of(usuario));
    }

    private Reserva reservaAtiva(LocalDateTime expiresAt) {
        return new Reserva(RESERVA_ID, CLIENTE_ID, SESSAO_ID, StatusReserva.ATIVA, Instant.now(), expiresAt);
    }

    private AssentoSessao assentoDaReserva(Long assentoId) {
        return new AssentoSessao(new AssentoSessaoId(SESSAO_ID, assentoId), "RESERVADO", RESERVA_ID, LocalDateTime.now().plusMinutes(5));
    }

    @Test
    void aprovadoConfirmaReservaEmiteIngressosEMarcaAssentosVendidos() {
        setUp();
        stubEntityManager();
        stubCliente();
        List<Long> assentoIds = List.of(10L, 20L);
        given(reservaRepository.findByIdForUpdate(RESERVA_ID))
                .willReturn(Optional.of(reservaAtiva(LocalDateTime.now().plusMinutes(5))));
        given(assentoSessaoRepository.findByIdSessaoId(SESSAO_ID))
                .willReturn(List.of(assentoDaReserva(10L), assentoDaReserva(20L)));
        given(ingressoRepository.save(any(Ingresso.class))).willAnswer(invocation -> {
            Ingresso ingresso = invocation.getArgument(0);
            ReflectionTestUtils.setField(ingresso, "id", UUID.randomUUID());
            return ingresso;
        });
        given(codigoIngressoService.gerar(any(UUID.class))).willReturn("codigo-gerado");

        PagamentoDto dto = pagamentoService.confirmar(
                new ConfirmarPagamentoRequest(RESERVA_ID, ResultadoSimulado.APROVADO), CLIENTE_EMAIL);

        assertThat(dto.status()).isEqualTo(StatusReserva.CONFIRMADA);
        assertThat(dto.ingressos()).hasSize(2);
        verify(reservaRepository).save(any(Reserva.class));
        verify(assentoSessaoRepository).reivindicarVendido(SESSAO_ID, assentoIds);
    }

    @Test
    void recusadoRecusaReservaNaoEmiteIngressoELiberaAssentos() {
        setUp();
        stubEntityManager();
        stubCliente();
        List<Long> assentoIds = List.of(10L, 20L);
        given(reservaRepository.findByIdForUpdate(RESERVA_ID))
                .willReturn(Optional.of(reservaAtiva(LocalDateTime.now().plusMinutes(5))));
        given(assentoSessaoRepository.findByIdSessaoId(SESSAO_ID))
                .willReturn(List.of(assentoDaReserva(10L), assentoDaReserva(20L)));

        PagamentoDto dto = pagamentoService.confirmar(
                new ConfirmarPagamentoRequest(RESERVA_ID, ResultadoSimulado.RECUSADO), CLIENTE_EMAIL);

        assertThat(dto.status()).isEqualTo(StatusReserva.RECUSADA);
        assertThat(dto.ingressos()).isEmpty();
        verify(ingressoRepository, never()).save(any());
        verify(reservaRepository).save(any(Reserva.class));
        verify(assentoSessaoRepository).liberar(SESSAO_ID, assentoIds);
    }

    @Test
    void reservaDeOutroClienteLancaNaoAutorizadoSemTocarSave() {
        setUp();
        stubEntityManager();
        stubCliente();
        Reserva reservaDeOutroCliente = new Reserva(
                RESERVA_ID, 999L, SESSAO_ID, StatusReserva.ATIVA, Instant.now(), LocalDateTime.now().plusMinutes(5));
        given(reservaRepository.findByIdForUpdate(RESERVA_ID)).willReturn(Optional.of(reservaDeOutroCliente));

        assertThatThrownBy(() -> pagamentoService.confirmar(
                        new ConfirmarPagamentoRequest(RESERVA_ID, ResultadoSimulado.APROVADO), CLIENTE_EMAIL))
                .isInstanceOf(NaoAutorizadoException.class);

        verify(reservaRepository, never()).save(any());
    }

    @Test
    void reservaInexistenteLancaMesmaExcecaoDeNaoAutorizado() {
        setUp();
        stubEntityManager();
        stubCliente();
        given(reservaRepository.findByIdForUpdate(RESERVA_ID)).willReturn(Optional.empty());

        assertThatThrownBy(() -> pagamentoService.confirmar(
                        new ConfirmarPagamentoRequest(RESERVA_ID, ResultadoSimulado.APROVADO), CLIENTE_EMAIL))
                .isInstanceOf(NaoAutorizadoException.class);

        verify(reservaRepository, never()).save(any());
    }

    @Test
    void reservaAtivaComHoldVencidoLancaReservaExpiradaSemSave() {
        setUp();
        stubEntityManager();
        stubCliente();
        given(reservaRepository.findByIdForUpdate(RESERVA_ID))
                .willReturn(Optional.of(reservaAtiva(LocalDateTime.now().minusMinutes(1))));

        assertThatThrownBy(() -> pagamentoService.confirmar(
                        new ConfirmarPagamentoRequest(RESERVA_ID, ResultadoSimulado.APROVADO), CLIENTE_EMAIL))
                .isInstanceOf(ReservaExpiradaException.class);

        verify(reservaRepository, never()).save(any());
    }

    @Test
    void reservaJaConfirmadaDevolveRespostaPersistidaSemReprocessar() {
        setUp();
        stubEntityManager();
        stubCliente();
        Reserva reservaConfirmada =
                new Reserva(RESERVA_ID, CLIENTE_ID, SESSAO_ID, StatusReserva.CONFIRMADA, Instant.now(), LocalDateTime.now().plusMinutes(5));
        given(reservaRepository.findByIdForUpdate(RESERVA_ID)).willReturn(Optional.of(reservaConfirmada));
        Ingresso ingressoExistente =
                new Ingresso(UUID.randomUUID(), RESERVA_ID, 10L, SESSAO_ID, StatusIngresso.VALIDO, null, Instant.now());
        given(ingressoRepository.findByReservaId(RESERVA_ID)).willReturn(List.of(ingressoExistente));
        given(codigoIngressoService.gerar(any(UUID.class))).willReturn("codigo-gerado");

        PagamentoDto dto = pagamentoService.confirmar(
                new ConfirmarPagamentoRequest(RESERVA_ID, ResultadoSimulado.RECUSADO), CLIENTE_EMAIL);

        assertThat(dto.status()).isEqualTo(StatusReserva.CONFIRMADA);
        assertThat(dto.ingressos()).hasSize(1);
        verify(reservaRepository, never()).save(any());
        verify(assentoSessaoRepository, never()).reivindicarVendido(anyLong(), anyList());
        verify(assentoSessaoRepository, never()).liberar(anyLong(), anyList());
        verify(ingressoRepository, never()).save(any());
    }

    @Test
    void reservaJaRecusadaDevolveRespostaPersistidaSemIngressos() {
        setUp();
        stubEntityManager();
        stubCliente();
        Reserva reservaRecusada =
                new Reserva(RESERVA_ID, CLIENTE_ID, SESSAO_ID, StatusReserva.RECUSADA, Instant.now(), LocalDateTime.now().plusMinutes(5));
        given(reservaRepository.findByIdForUpdate(RESERVA_ID)).willReturn(Optional.of(reservaRecusada));

        PagamentoDto dto = pagamentoService.confirmar(
                new ConfirmarPagamentoRequest(RESERVA_ID, ResultadoSimulado.APROVADO), CLIENTE_EMAIL);

        assertThat(dto.status()).isEqualTo(StatusReserva.RECUSADA);
        assertThat(dto.ingressos()).isEmpty();
        verify(reservaRepository, never()).save(any());
        verify(ingressoRepository, never()).save(any());
    }
}
