package br.com.rolo35.api.ingressos.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import br.com.rolo35.api.auth.Usuario;
import br.com.rolo35.api.auth.repository.UsuarioRepository;
import br.com.rolo35.api.ingressos.PortariaNaoEncontradaException;
import br.com.rolo35.api.ingressos.SessaoAtivaNaoSelecionadaException;
import br.com.rolo35.api.ingressos.SessaoForaDaJanelaDoTurnoException;
import br.com.rolo35.api.ingressos.StatusIngresso;
import br.com.rolo35.api.ingressos.TurnoPortaria;
import br.com.rolo35.api.ingressos.dto.PainelTurnoDto;
import br.com.rolo35.api.ingressos.dto.SessaoAtivaDto;
import br.com.rolo35.api.ingressos.repository.IngressoRepository;
import br.com.rolo35.api.ingressos.repository.LeituraTurnoProjection;
import br.com.rolo35.api.ingressos.repository.TurnoPortariaRepository;
import br.com.rolo35.api.sessoes.Sala;
import br.com.rolo35.api.sessoes.Sessao;
import br.com.rolo35.api.sessoes.SessaoNaoEncontradaException;
import br.com.rolo35.api.sessoes.repository.AssentoRepository;
import br.com.rolo35.api.sessoes.repository.SalaRepository;
import br.com.rolo35.api.sessoes.repository.SessaoRepository;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class PortariaServiceTest {

    private static final String PORTARIA_EMAIL = "portaria@rolo35.com.br";
    private static final Long PORTARIA_ID = 4L;
    private static final Long SESSAO_ID = 1L;

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private SessaoRepository sessaoRepository;

    @Mock
    private SalaRepository salaRepository;

    @Mock
    private TurnoPortariaRepository turnoPortariaRepository;

    @Mock
    private IngressoRepository ingressoRepository;

    @Mock
    private AssentoRepository assentoRepository;

    @Mock
    private CodigoIngressoService codigoIngressoService;

    @Mock
    private EntityManager entityManager;

    private PortariaService portariaService;

    private void setUp() {
        portariaService = new PortariaService(
                usuarioRepository, sessaoRepository, salaRepository, turnoPortariaRepository, ingressoRepository,
                assentoRepository, codigoIngressoService, entityManager);
    }

    private void stubPortaria() {
        Usuario usuario = new Usuario();
        ReflectionTestUtils.setField(usuario, "id", PORTARIA_ID);
        ReflectionTestUtils.setField(usuario, "email", PORTARIA_EMAIL);
        given(usuarioRepository.findByEmail(PORTARIA_EMAIL)).willReturn(Optional.of(usuario));
    }

    private Sessao sessao(Long id, Long salaId) {
        return sessaoComDataHora(id, salaId, LocalDateTime.now().plusDays(1));
    }

    private Sessao sessaoComDataHora(Long id, Long salaId, LocalDateTime dataHora) {
        return Sessao.builder()
                .id(id)
                .organizadorId(1L)
                .salaId(salaId)
                .tmdbId(550L)
                .titulo("Clube da Luta")
                .dataHora(dataHora)
                .preco(java.math.BigDecimal.TEN)
                .createdAt(Instant.now())
                .build();
    }

    private Sala sala(Long id, String nome) {
        Sala sala = new Sala();
        ReflectionTestUtils.setField(sala, "id", id);
        ReflectionTestUtils.setField(sala, "nome", nome);
        return sala;
    }

    @Test
    void selecionarSessaoSemTurnoPrevioCriaNovaLinha() {
        setUp();
        stubPortaria();
        given(sessaoRepository.findById(SESSAO_ID))
                .willReturn(Optional.of(sessaoComDataHora(SESSAO_ID, 1L, LocalDateTime.now().plusMinutes(10))));
        given(salaRepository.findById(1L)).willReturn(Optional.of(sala(1L, "Sala 1")));

        SessaoAtivaDto dto = portariaService.selecionarSessao(PORTARIA_EMAIL, SESSAO_ID);

        ArgumentCaptor<TurnoPortaria> captor = ArgumentCaptor.forClass(TurnoPortaria.class);
        verify(turnoPortariaRepository).save(captor.capture());
        assertThat(captor.getValue().getUsuarioId()).isEqualTo(PORTARIA_ID);
        assertThat(captor.getValue().getSessaoId()).isEqualTo(SESSAO_ID);
        assertThat(dto.sessaoId()).isEqualTo(SESSAO_ID);
        assertThat(dto.titulo()).isEqualTo("Clube da Luta");
        assertThat(dto.salaNome()).isEqualTo("Sala 1");
    }

    @Test
    void selecionarSessaoComTurnoExistenteAtualizaMesmaLinha() {
        setUp();
        stubPortaria();
        Long outraSessaoId = 2L;
        given(sessaoRepository.findById(outraSessaoId))
                .willReturn(Optional.of(sessaoComDataHora(outraSessaoId, 1L, LocalDateTime.now().plusMinutes(10))));
        given(salaRepository.findById(1L)).willReturn(Optional.of(sala(1L, "Sala 1")));

        portariaService.selecionarSessao(PORTARIA_EMAIL, outraSessaoId);

        ArgumentCaptor<TurnoPortaria> captor = ArgumentCaptor.forClass(TurnoPortaria.class);
        verify(turnoPortariaRepository).save(captor.capture());
        assertThat(captor.getValue().getUsuarioId()).isEqualTo(PORTARIA_ID);
        assertThat(captor.getValue().getSessaoId()).isEqualTo(outraSessaoId);
    }

    @Test
    void selecionarSessaoComSessaoInexistenteLancaSemSalvar() {
        setUp();
        stubPortaria();
        given(sessaoRepository.findById(SESSAO_ID)).willReturn(Optional.empty());

        assertThatThrownBy(() -> portariaService.selecionarSessao(PORTARIA_EMAIL, SESSAO_ID))
                .isInstanceOf(SessaoNaoEncontradaException.class);

        verify(turnoPortariaRepository, never()).save(any());
    }

    @Test
    void selecionarSessaoMuitoNoFuturoLancaSemSalvar() {
        setUp();
        stubPortaria();
        given(sessaoRepository.findById(SESSAO_ID))
                .willReturn(Optional.of(sessaoComDataHora(SESSAO_ID, 1L, LocalDateTime.now().plusHours(3))));

        assertThatThrownBy(() -> portariaService.selecionarSessao(PORTARIA_EMAIL, SESSAO_ID))
                .isInstanceOf(SessaoForaDaJanelaDoTurnoException.class);

        verify(turnoPortariaRepository, never()).save(any());
    }

    @Test
    void selecionarSessaoMuitoNoPassadoLancaSemSalvar() {
        setUp();
        stubPortaria();
        given(sessaoRepository.findById(SESSAO_ID))
                .willReturn(Optional.of(sessaoComDataHora(SESSAO_ID, 1L, LocalDateTime.now().minusHours(3))));

        assertThatThrownBy(() -> portariaService.selecionarSessao(PORTARIA_EMAIL, SESSAO_ID))
                .isInstanceOf(SessaoForaDaJanelaDoTurnoException.class);

        verify(turnoPortariaRepository, never()).save(any());
    }

    @Test
    void selecionarSessaoDentroDaJanelaAceita() {
        setUp();
        stubPortaria();
        given(sessaoRepository.findById(SESSAO_ID))
                .willReturn(Optional.of(sessaoComDataHora(SESSAO_ID, 1L, LocalDateTime.now().minusHours(1))));
        given(salaRepository.findById(1L)).willReturn(Optional.of(sala(1L, "Sala 1")));

        SessaoAtivaDto dto = portariaService.selecionarSessao(PORTARIA_EMAIL, SESSAO_ID);

        assertThat(dto.sessaoId()).isEqualTo(SESSAO_ID);
        verify(turnoPortariaRepository).save(any());
    }

    @Test
    void sessaoAtivaSemTurnoLancaSessaoAtivaNaoSelecionada() {
        setUp();
        stubPortaria();
        given(turnoPortariaRepository.findById(PORTARIA_ID)).willReturn(Optional.empty());

        assertThatThrownBy(() -> portariaService.sessaoAtiva(PORTARIA_EMAIL))
                .isInstanceOf(SessaoAtivaNaoSelecionadaException.class);
    }

    @Test
    void sessaoAtivaComTurnoDevolveDtoSemCamposInternos() {
        setUp();
        stubPortaria();
        given(turnoPortariaRepository.findById(PORTARIA_ID))
                .willReturn(Optional.of(new TurnoPortaria(PORTARIA_ID, SESSAO_ID, LocalDateTime.now())));
        given(sessaoRepository.findById(SESSAO_ID)).willReturn(Optional.of(sessao(SESSAO_ID, 1L)));
        given(salaRepository.findById(1L)).willReturn(Optional.of(sala(1L, "Sala 1")));

        SessaoAtivaDto dto = portariaService.sessaoAtiva(PORTARIA_EMAIL);

        assertThat(dto.sessaoId()).isEqualTo(SESSAO_ID);
        assertThat(dto.titulo()).isEqualTo("Clube da Luta");
        assertThat(dto.salaNome()).isEqualTo("Sala 1");
        assertThat(dto.dataHora()).isNotNull();
    }

    @Test
    void obterSessaoAtivaOuLancarDevolveEntidadeESessaoNaoSelecionadaLancaMesmaExcecao() {
        setUp();
        stubPortaria();
        given(turnoPortariaRepository.findById(PORTARIA_ID))
                .willReturn(Optional.of(new TurnoPortaria(PORTARIA_ID, SESSAO_ID, LocalDateTime.now())));
        given(sessaoRepository.findById(SESSAO_ID)).willReturn(Optional.of(sessao(SESSAO_ID, 1L)));

        Sessao sessao = portariaService.obterSessaoAtivaOuLancar(PORTARIA_EMAIL);

        assertThat(sessao.getId()).isEqualTo(SESSAO_ID);
    }

    @Test
    void obterSessaoAtivaOuLancarSemTurnoLancaSessaoAtivaNaoSelecionada() {
        setUp();
        stubPortaria();
        given(turnoPortariaRepository.findById(PORTARIA_ID)).willReturn(Optional.empty());

        assertThatThrownBy(() -> portariaService.obterSessaoAtivaOuLancar(PORTARIA_EMAIL))
                .isInstanceOf(SessaoAtivaNaoSelecionadaException.class);
    }

    private void stubTurnoAtivo() {
        stubPortaria();
        given(turnoPortariaRepository.findById(PORTARIA_ID))
                .willReturn(Optional.of(new TurnoPortaria(PORTARIA_ID, SESSAO_ID, LocalDateTime.now())));
        given(sessaoRepository.findById(SESSAO_ID)).willReturn(Optional.of(sessao(SESSAO_ID, 1L)));
    }

    private LeituraTurnoProjection leitura(UUID ingressoId, String fileira, int numero) {
        LeituraTurnoProjection projecao = mock(LeituraTurnoProjection.class);
        given(projecao.getIngressoId()).willReturn(ingressoId);
        given(projecao.getAssentoFileira()).willReturn(fileira);
        given(projecao.getAssentoNumero()).willReturn(numero);
        given(projecao.getValidadoEm()).willReturn(LocalDateTime.now());
        return projecao;
    }

    // O denominador é ingressos emitidos, não capacidade da sala: numa sessão de 62 vendidos com
    // 37 dentro, "37/120" leria como sala vazia e mandaria o operador o recado errado.
    @Test
    void painelContaValidadosSobreEmitidosDaSessaoDoTurno() {
        setUp();
        stubTurnoAtivo();
        given(ingressoRepository.countBySessaoIdAndStatus(SESSAO_ID, StatusIngresso.UTILIZADO))
                .willReturn(37L);
        given(ingressoRepository.countBySessaoId(SESSAO_ID)).willReturn(62L);
        given(ingressoRepository.buscarLeiturasDoTurno(eq(SESSAO_ID), any(Pageable.class)))
                .willReturn(List.of());

        PainelTurnoDto painel = portariaService.painelDoTurno(PORTARIA_EMAIL);

        assertThat(painel.validados()).isEqualTo(37L);
        assertThat(painel.emitidos()).isEqualTo(62L);
    }

    // O código completo é credencial assinada (AD-8). Se o painel listasse ele inteiro, a tela de
    // conferência viraria uma fonte de ingressos válidos pra quem olhasse por cima do ombro.
    @Test
    void painelExpoeApenasPrefixoDoCodigoNuncaOCodigoAssinadoInteiro() {
        setUp();
        stubTurnoAtivo();
        UUID ingressoId = UUID.fromString("a3f91c7e-0000-4000-8000-000000000001");
        // Montado fora do given(): construir um mock dentro de uma cadeia de stubbing faz o
        // Mockito enxergar as duas stubagens como uma só e falhar com UnfinishedStubbing.
        LeituraTurnoProjection leitura = leitura(ingressoId, "D", 7);
        given(ingressoRepository.buscarLeiturasDoTurno(eq(SESSAO_ID), any(Pageable.class)))
                .willReturn(List.of(leitura));

        PainelTurnoDto painel = portariaService.painelDoTurno(PORTARIA_EMAIL);

        assertThat(painel.leituras()).hasSize(1);
        assertThat(painel.leituras().get(0).codigoCurto()).isEqualTo("A3F91C");
        assertThat(painel.leituras().get(0).codigoCurto()).doesNotContain(ingressoId.toString());
        assertThat(painel.leituras().get(0).assentoFileira()).isEqualTo("D");
        assertThat(painel.leituras().get(0).assentoNumero()).isEqualTo(7);
    }

    // Mesma regra da FR-17 do resto da portaria: sem turno escolhido não há o que acompanhar, e o
    // painel não pode inventar uma sessão nem devolver o painel de outra.
    @Test
    void painelSemTurnoSelecionadoLancaMesmaExcecaoDaValidacao() {
        setUp();
        stubPortaria();
        given(turnoPortariaRepository.findById(PORTARIA_ID)).willReturn(Optional.empty());

        assertThatThrownBy(() -> portariaService.painelDoTurno(PORTARIA_EMAIL))
                .isInstanceOf(SessaoAtivaNaoSelecionadaException.class);
    }

    // Leitura pura: consultar o painel não pode encostar no caminho que transiciona
    // VALIDO -> UTILIZADO (AD-9), nem no lock que o protege.
    @Test
    void painelNaoEscreveNemTravaNada() {
        setUp();
        stubTurnoAtivo();
        given(ingressoRepository.buscarLeiturasDoTurno(eq(SESSAO_ID), any(Pageable.class)))
                .willReturn(List.of());

        portariaService.painelDoTurno(PORTARIA_EMAIL);

        verify(ingressoRepository, never()).save(any());
        verify(ingressoRepository, never()).findByIdForUpdate(any());
        verify(entityManager, never()).createNativeQuery(any(String.class));
    }

    @Test
    void portariaInexistenteLancaPortariaNaoEncontrada() {
        setUp();
        given(usuarioRepository.findByEmail(PORTARIA_EMAIL)).willReturn(Optional.empty());

        assertThatThrownBy(() -> portariaService.selecionarSessao(PORTARIA_EMAIL, SESSAO_ID))
                .isInstanceOf(PortariaNaoEncontradaException.class);
    }
}
