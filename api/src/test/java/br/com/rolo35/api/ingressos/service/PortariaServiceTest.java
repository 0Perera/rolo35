package br.com.rolo35.api.ingressos.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import br.com.rolo35.api.auth.Usuario;
import br.com.rolo35.api.auth.repository.UsuarioRepository;
import br.com.rolo35.api.ingressos.PortariaNaoEncontradaException;
import br.com.rolo35.api.ingressos.SessaoAtivaNaoSelecionadaException;
import br.com.rolo35.api.ingressos.TurnoPortaria;
import br.com.rolo35.api.ingressos.dto.SessaoAtivaDto;
import br.com.rolo35.api.ingressos.repository.IngressoRepository;
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
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
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
        return Sessao.builder()
                .id(id)
                .organizadorId(1L)
                .salaId(salaId)
                .tmdbId(550L)
                .titulo("Clube da Luta")
                .dataHora(LocalDateTime.now().plusDays(1))
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
        given(sessaoRepository.findById(SESSAO_ID)).willReturn(Optional.of(sessao(SESSAO_ID, 1L)));
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
        given(sessaoRepository.findById(outraSessaoId)).willReturn(Optional.of(sessao(outraSessaoId, 1L)));
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

    @Test
    void portariaInexistenteLancaPortariaNaoEncontrada() {
        setUp();
        given(usuarioRepository.findByEmail(PORTARIA_EMAIL)).willReturn(Optional.empty());

        assertThatThrownBy(() -> portariaService.selecionarSessao(PORTARIA_EMAIL, SESSAO_ID))
                .isInstanceOf(PortariaNaoEncontradaException.class);
    }
}
