package br.com.rolo35.api.reservas.service;

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
import br.com.rolo35.api.reservas.AssentoEmDisputaException;
import br.com.rolo35.api.reservas.AssentoIndisponivelException;
import br.com.rolo35.api.reservas.ClienteNaoEncontradoException;
import br.com.rolo35.api.reservas.Reserva;
import br.com.rolo35.api.reservas.SelecaoAssentosInvalidaException;
import br.com.rolo35.api.reservas.StatusReserva;
import br.com.rolo35.api.reservas.dto.ReservaDto;
import br.com.rolo35.api.reservas.dto.ReservarAssentosRequest;
import br.com.rolo35.api.reservas.repository.ReservaRepository;
import br.com.rolo35.api.sessoes.AssentoSessao;
import br.com.rolo35.api.sessoes.AssentoSessaoId;
import br.com.rolo35.api.sessoes.repository.AssentoSessaoRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class ReservaServiceTest {

    private static final String CLIENTE_EMAIL = "cliente1@rolo35.com.br";
    private static final Long SESSAO_ID = 1L;

    @Mock
    private AssentoSessaoRepository assentoSessaoRepository;

    @Mock
    private ReservaRepository reservaRepository;

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private EntityManager entityManager;

    @Mock
    private Query query;

    private ReservaService reservaService;

    @BeforeEach
    void setUp() {
        reservaService = new ReservaService(assentoSessaoRepository, reservaRepository, usuarioRepository, entityManager);
    }

    private Usuario clienteCom(Long id, String email) {
        Usuario usuario = new Usuario();
        ReflectionTestUtils.setField(usuario, "id", id);
        ReflectionTestUtils.setField(usuario, "email", email);
        ReflectionTestUtils.setField(usuario, "papel", "CLIENTE");
        return usuario;
    }

    private AssentoSessao assentoLivre(Long assentoId) {
        return new AssentoSessao(new AssentoSessaoId(SESSAO_ID, assentoId), "LIVRE", null, null);
    }

    private AssentoSessao assentoReservado(Long assentoId, LocalDateTime expiresAt) {
        return new AssentoSessao(new AssentoSessaoId(SESSAO_ID, assentoId), "RESERVADO", 42L, expiresAt);
    }

    private void stubEntityManager() {
        given(entityManager.createNativeQuery(any(String.class))).willReturn(query);
    }

    private void stubCliente() {
        given(usuarioRepository.findByEmail(CLIENTE_EMAIL)).willReturn(Optional.of(clienteCom(7L, CLIENTE_EMAIL)));
    }

    @Test
    void reservaDeUmATreisAssentosLivresCriaHoldAtomicoParaTodos() {
        stubEntityManager();
        stubCliente();
        List<Long> assentoIds = List.of(10L, 20L, 30L);
        given(assentoSessaoRepository.travarParaReserva(SESSAO_ID, assentoIds))
                .willReturn(List.of(assentoLivre(10L), assentoLivre(20L), assentoLivre(30L)));
        given(reservaRepository.save(any(Reserva.class))).willAnswer(invocation -> {
            Reserva reserva = invocation.getArgument(0);
            ReflectionTestUtils.setField(reserva, "id", 99L);
            return reserva;
        });
        given(assentoSessaoRepository.reivindicar(
                        anyLong(), anyList(), anyLong(), any(LocalDateTime.class), any(LocalDateTime.class)))
                .willReturn(assentoIds.size());

        ReservaDto dto = reservaService.reservar(new ReservarAssentosRequest(SESSAO_ID, assentoIds), CLIENTE_EMAIL);

        assertThat(dto.id()).isEqualTo(99L);
        assertThat(dto.sessaoId()).isEqualTo(SESSAO_ID);
        assertThat(dto.status()).isEqualTo(StatusReserva.ATIVA);
        assertThat(dto.assentoIds()).containsExactlyElementsOf(assentoIds);
        verify(assentoSessaoRepository)
                .reivindicar(anyLong(), anyList(), anyLong(), any(LocalDateTime.class), any(LocalDateTime.class));
    }

    @Test
    void selecaoVaziaRejeitaAntesDeQualquerLock() {
        assertThatThrownBy(() -> reservaService.reservar(new ReservarAssentosRequest(SESSAO_ID, List.of()), CLIENTE_EMAIL))
                .isInstanceOf(SelecaoAssentosInvalidaException.class);

        verify(assentoSessaoRepository, never()).travarParaReserva(anyLong(), anyList());
        verify(assentoSessaoRepository, never()).reivindicar(anyLong(), anyList(), anyLong(), any(), any());
        verify(reservaRepository, never()).save(any());
    }

    @Test
    void selecaoComMaisDeSeisAssentosRejeitaAntesDeQualquerLock() {
        List<Long> seteAssentos = List.of(1L, 2L, 3L, 4L, 5L, 6L, 7L);

        assertThatThrownBy(
                        () -> reservaService.reservar(new ReservarAssentosRequest(SESSAO_ID, seteAssentos), CLIENTE_EMAIL))
                .isInstanceOf(SelecaoAssentosInvalidaException.class);

        verify(assentoSessaoRepository, never()).travarParaReserva(anyLong(), anyList());
        verify(reservaRepository, never()).save(any());
    }

    @Test
    void selecaoComAssentoDuplicadoRejeitaAntesDeQualquerLock() {
        List<Long> comDuplicado = List.of(1L, 2L, 2L);

        assertThatThrownBy(
                        () -> reservaService.reservar(new ReservarAssentosRequest(SESSAO_ID, comDuplicado), CLIENTE_EMAIL))
                .isInstanceOf(SelecaoAssentosInvalidaException.class);

        verify(assentoSessaoRepository, never()).travarParaReserva(anyLong(), anyList());
        verify(reservaRepository, never()).save(any());
    }

    @Test
    void assentoComHoldAtivoDeOutroClienteTornaSelecaoIndisponivelSemHoldParcial() {
        stubEntityManager();
        stubCliente();
        List<Long> assentoIds = List.of(10L, 20L);
        given(assentoSessaoRepository.travarParaReserva(SESSAO_ID, assentoIds))
                .willReturn(List.of(assentoLivre(10L), assentoReservado(20L, LocalDateTime.now().plusMinutes(5))));

        assertThatThrownBy(
                        () -> reservaService.reservar(new ReservarAssentosRequest(SESSAO_ID, assentoIds), CLIENTE_EMAIL))
                .isInstanceOf(AssentoIndisponivelException.class);

        verify(assentoSessaoRepository, never()).reivindicar(anyLong(), anyList(), anyLong(), any(), any());
        verify(reservaRepository, never()).save(any());
    }

    @Test
    void assentoQueNaoPertenceASessaoTornaSelecaoIndisponivel() {
        stubEntityManager();
        stubCliente();
        List<Long> assentoIds = List.of(10L, 20L);
        // travarParaReserva devolve só 1 linha das 2 pedidas (o outro assento não existe pra essa sessão)
        given(assentoSessaoRepository.travarParaReserva(SESSAO_ID, assentoIds)).willReturn(List.of(assentoLivre(10L)));

        assertThatThrownBy(
                        () -> reservaService.reservar(new ReservarAssentosRequest(SESSAO_ID, assentoIds), CLIENTE_EMAIL))
                .isInstanceOf(AssentoIndisponivelException.class);

        verify(assentoSessaoRepository, never()).reivindicar(anyLong(), anyList(), anyLong(), any(), any());
        verify(reservaRepository, never()).save(any());
    }

    @Test
    void holdVencidoContaComoLivreEPermiteNovaReserva() {
        stubEntityManager();
        stubCliente();
        List<Long> assentoIds = List.of(10L);
        given(assentoSessaoRepository.travarParaReserva(SESSAO_ID, assentoIds))
                .willReturn(List.of(assentoReservado(10L, LocalDateTime.now().minusMinutes(1))));
        given(reservaRepository.save(any(Reserva.class))).willAnswer(invocation -> {
            Reserva reserva = invocation.getArgument(0);
            ReflectionTestUtils.setField(reserva, "id", 100L);
            return reserva;
        });
        given(assentoSessaoRepository.reivindicar(
                        anyLong(), anyList(), anyLong(), any(LocalDateTime.class), any(LocalDateTime.class)))
                .willReturn(assentoIds.size());

        ReservaDto dto = reservaService.reservar(new ReservarAssentosRequest(SESSAO_ID, assentoIds), CLIENTE_EMAIL);

        assertThat(dto.id()).isEqualTo(100L);
        verify(assentoSessaoRepository)
                .reivindicar(anyLong(), anyList(), anyLong(), any(LocalDateTime.class), any(LocalDateTime.class));
    }

    @Test
    void clienteNaoEncontradoLancaExcecaoAntesDeQualquerLock() {
        given(usuarioRepository.findByEmail(CLIENTE_EMAIL)).willReturn(Optional.empty());

        assertThatThrownBy(
                        () -> reservaService.reservar(new ReservarAssentosRequest(SESSAO_ID, List.of(10L)), CLIENTE_EMAIL))
                .isInstanceOf(ClienteNaoEncontradoException.class);

        verify(assentoSessaoRepository, never()).travarParaReserva(anyLong(), anyList());
        verify(reservaRepository, never()).save(any());
    }

    @Test
    void reivindicarAtualizandoMenosLinhasQueOSelecionadoLancaAssentoIndisponivel() {
        stubEntityManager();
        stubCliente();
        List<Long> assentoIds = List.of(10L, 20L);
        given(assentoSessaoRepository.travarParaReserva(SESSAO_ID, assentoIds))
                .willReturn(List.of(assentoLivre(10L), assentoLivre(20L)));
        given(reservaRepository.save(any(Reserva.class))).willAnswer(invocation -> {
            Reserva reserva = invocation.getArgument(0);
            ReflectionTestUtils.setField(reserva, "id", 101L);
            return reserva;
        });
        // Guarda de status do próprio UPDATE recusou 1 das 2 linhas — mesmo com a checagem prévia
        // em Java já tendo aprovado os dois assentos, uma corrida entre a leitura e o UPDATE pode
        // ter mudado o status de uma delas.
        given(assentoSessaoRepository.reivindicar(
                        anyLong(), anyList(), anyLong(), any(LocalDateTime.class), any(LocalDateTime.class)))
                .willReturn(1);

        assertThatThrownBy(
                        () -> reservaService.reservar(new ReservarAssentosRequest(SESSAO_ID, assentoIds), CLIENTE_EMAIL))
                .isInstanceOf(AssentoIndisponivelException.class);
    }

    @Test
    void timeoutDeLockAoTravarViraAssentoEmDisputaNaoAssentoIndisponivel() {
        stubEntityManager();
        stubCliente();
        List<Long> assentoIds = List.of(10L);
        given(assentoSessaoRepository.travarParaReserva(SESSAO_ID, assentoIds))
                .willThrow(new PessimisticLockingFailureException("lock timeout"));

        assertThatThrownBy(
                        () -> reservaService.reservar(new ReservarAssentosRequest(SESSAO_ID, assentoIds), CLIENTE_EMAIL))
                .isInstanceOf(AssentoEmDisputaException.class);

        verify(reservaRepository, never()).save(any());
    }
}
