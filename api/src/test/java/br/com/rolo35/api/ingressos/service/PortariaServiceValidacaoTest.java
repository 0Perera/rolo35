package br.com.rolo35.api.ingressos.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import br.com.rolo35.api.auth.Usuario;
import br.com.rolo35.api.auth.repository.UsuarioRepository;
import br.com.rolo35.api.ingressos.Ingresso;
import br.com.rolo35.api.ingressos.ResultadoValidacao;
import br.com.rolo35.api.ingressos.SessaoAtivaNaoSelecionadaException;
import br.com.rolo35.api.ingressos.StatusIngresso;
import br.com.rolo35.api.ingressos.TurnoPortaria;
import br.com.rolo35.api.ingressos.dto.ValidacaoIngressoDto;
import br.com.rolo35.api.ingressos.repository.IngressoRepository;
import br.com.rolo35.api.ingressos.repository.TurnoPortariaRepository;
import br.com.rolo35.api.sessoes.Assento;
import br.com.rolo35.api.sessoes.Sessao;
import br.com.rolo35.api.sessoes.repository.AssentoRepository;
import br.com.rolo35.api.sessoes.repository.SalaRepository;
import br.com.rolo35.api.sessoes.repository.SessaoRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class PortariaServiceValidacaoTest {

    private static final String PORTARIA_EMAIL = "portaria@rolo35.com.br";
    private static final Long PORTARIA_ID = 4L;
    private static final Long SESSAO_ATIVA_ID = 1L;
    private static final String CODIGO = "codigo-qualquer";

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

    @Mock
    private Query lockTimeoutQuery;

    private PortariaService portariaService;

    private void setUp() {
        portariaService = new PortariaService(
                usuarioRepository, sessaoRepository, salaRepository, turnoPortariaRepository, ingressoRepository,
                assentoRepository, codigoIngressoService, entityManager);
    }

    private void stubSessaoAtiva() {
        Usuario usuario = new Usuario();
        ReflectionTestUtils.setField(usuario, "id", PORTARIA_ID);
        ReflectionTestUtils.setField(usuario, "email", PORTARIA_EMAIL);
        given(usuarioRepository.findByEmail(PORTARIA_EMAIL)).willReturn(Optional.of(usuario));
        given(turnoPortariaRepository.findById(PORTARIA_ID))
                .willReturn(Optional.of(new TurnoPortaria(PORTARIA_ID, SESSAO_ATIVA_ID, LocalDateTime.now())));
        given(sessaoRepository.findById(SESSAO_ATIVA_ID)).willReturn(Optional.of(sessao(SESSAO_ATIVA_ID, "Clube da Luta")));
    }

    private void stubLockTimeout() {
        given(entityManager.createNativeQuery("SET LOCAL lock_timeout = '3s'")).willReturn(lockTimeoutQuery);
    }

    private void stubSemSessaoAtiva() {
        Usuario usuario = new Usuario();
        ReflectionTestUtils.setField(usuario, "id", PORTARIA_ID);
        ReflectionTestUtils.setField(usuario, "email", PORTARIA_EMAIL);
        given(usuarioRepository.findByEmail(PORTARIA_EMAIL)).willReturn(Optional.of(usuario));
        given(turnoPortariaRepository.findById(PORTARIA_ID)).willReturn(Optional.empty());
    }

    private Sessao sessao(Long id, String titulo) {
        return Sessao.builder()
                .id(id)
                .organizadorId(1L)
                .salaId(1L)
                .tmdbId(550L)
                .titulo(titulo)
                .dataHora(LocalDateTime.now().plusDays(1))
                .preco(java.math.BigDecimal.TEN)
                .createdAt(Instant.now())
                .build();
    }

    private Ingresso ingresso(UUID id, Long sessaoId, StatusIngresso status) {
        return new Ingresso(id, 1L, 1L, sessaoId, status, null, Instant.now());
    }

    private Assento assento(Long id, String fileira, Integer numero) {
        Assento assento = new Assento();
        ReflectionTestUtils.setField(assento, "id", id);
        ReflectionTestUtils.setField(assento, "fileira", fileira);
        ReflectionTestUtils.setField(assento, "numero", numero);
        return assento;
    }

    @Test
    void semSessaoAtivaPropagaSemChamarCodigoOuIngressoRepository() {
        setUp();
        stubSemSessaoAtiva();

        assertThatThrownBy(() -> portariaService.validar(PORTARIA_EMAIL, CODIGO))
                .isInstanceOf(SessaoAtivaNaoSelecionadaException.class);

        verifyNoInteractions(codigoIngressoService, ingressoRepository);
    }

    @Test
    void codigoMalformadoRetornaInvalidoSemConsultarBanco() {
        setUp();
        stubSessaoAtiva();
        given(codigoIngressoService.extrairId(CODIGO)).willReturn(Optional.empty());

        ValidacaoIngressoDto dto = portariaService.validar(PORTARIA_EMAIL, CODIGO);

        assertThat(dto.resultado()).isEqualTo(ResultadoValidacao.INVALIDO);
        verify(ingressoRepository, never()).findByIdForUpdate(any());
    }

    @Test
    void assinaturaInvalidaRetornaInvalido() {
        setUp();
        stubSessaoAtiva();
        UUID id = UUID.randomUUID();
        given(codigoIngressoService.extrairId(CODIGO)).willReturn(Optional.of(id));
        given(codigoIngressoService.validar(id, CODIGO)).willReturn(false);

        ValidacaoIngressoDto dto = portariaService.validar(PORTARIA_EMAIL, CODIGO);

        assertThat(dto.resultado()).isEqualTo(ResultadoValidacao.INVALIDO);
        verify(ingressoRepository, never()).findByIdForUpdate(any());
    }

    @Test
    void assinaturaValidaMasIngressoNaoEncontradoRetornaInvalido() {
        setUp();
        stubSessaoAtiva();
        stubLockTimeout();
        UUID id = UUID.randomUUID();
        given(codigoIngressoService.extrairId(CODIGO)).willReturn(Optional.of(id));
        given(codigoIngressoService.validar(id, CODIGO)).willReturn(true);
        given(ingressoRepository.findByIdForUpdate(id)).willReturn(Optional.empty());

        ValidacaoIngressoDto dto = portariaService.validar(PORTARIA_EMAIL, CODIGO);

        assertThat(dto.resultado()).isEqualTo(ResultadoValidacao.INVALIDO);
    }

    @Test
    void sessaoDiferenteRetornaEventoErradoSemSalvar() {
        setUp();
        stubSessaoAtiva();
        stubLockTimeout();
        UUID id = UUID.randomUUID();
        given(codigoIngressoService.extrairId(CODIGO)).willReturn(Optional.of(id));
        given(codigoIngressoService.validar(id, CODIGO)).willReturn(true);
        Ingresso ingresso = ingresso(id, 999L, StatusIngresso.VALIDO);
        given(ingressoRepository.findByIdForUpdate(id)).willReturn(Optional.of(ingresso));
        given(assentoRepository.findById(1L)).willReturn(Optional.of(assento(1L, "A", 1)));

        ValidacaoIngressoDto dto = portariaService.validar(PORTARIA_EMAIL, CODIGO);

        assertThat(dto.resultado()).isEqualTo(ResultadoValidacao.EVENTO_ERRADO);
        assertThat(dto.assentoFileira()).isEqualTo("A");
        assertThat(dto.sessaoTitulo()).isEqualTo("Clube da Luta");
        verify(ingressoRepository, never()).save(any());
    }

    @Test
    void jaUtilizadoRetornaJaUtilizadoSemSalvarDeNovo() {
        setUp();
        stubSessaoAtiva();
        stubLockTimeout();
        UUID id = UUID.randomUUID();
        given(codigoIngressoService.extrairId(CODIGO)).willReturn(Optional.of(id));
        given(codigoIngressoService.validar(id, CODIGO)).willReturn(true);
        Ingresso ingresso = ingresso(id, SESSAO_ATIVA_ID, StatusIngresso.UTILIZADO);
        given(ingressoRepository.findByIdForUpdate(id)).willReturn(Optional.of(ingresso));
        given(assentoRepository.findById(1L)).willReturn(Optional.of(assento(1L, "A", 1)));

        ValidacaoIngressoDto dto = portariaService.validar(PORTARIA_EMAIL, CODIGO);

        assertThat(dto.resultado()).isEqualTo(ResultadoValidacao.JA_UTILIZADO);
        verify(ingressoRepository, never()).save(any());
    }

    @Test
    void ingressoValidoMudaParaUtilizadoESalva() {
        setUp();
        stubSessaoAtiva();
        stubLockTimeout();
        UUID id = UUID.randomUUID();
        given(codigoIngressoService.extrairId(CODIGO)).willReturn(Optional.of(id));
        given(codigoIngressoService.validar(id, CODIGO)).willReturn(true);
        Ingresso ingresso = ingresso(id, SESSAO_ATIVA_ID, StatusIngresso.VALIDO);
        given(ingressoRepository.findByIdForUpdate(id)).willReturn(Optional.of(ingresso));
        given(assentoRepository.findById(1L)).willReturn(Optional.of(assento(1L, "A", 1)));

        ValidacaoIngressoDto dto = portariaService.validar(PORTARIA_EMAIL, CODIGO);

        assertThat(dto.resultado()).isEqualTo(ResultadoValidacao.VALIDO);
        assertThat(ingresso.getStatus()).isEqualTo(StatusIngresso.UTILIZADO);
        verify(ingressoRepository).save(ingresso);
    }

    @Test
    void dtoNaoExpoeCampoDeCliente() {
        for (Field field : ValidacaoIngressoDto.class.getDeclaredFields()) {
            assertThat(field.getName().toLowerCase())
                    .doesNotContain("cliente")
                    .doesNotContain("email")
                    .doesNotContain("nome");
        }
        for (Method method : ValidacaoIngressoDto.class.getDeclaredMethods()) {
            assertThat(method.getName().toLowerCase())
                    .doesNotContain("cliente")
                    .doesNotContain("email");
        }
    }
}
