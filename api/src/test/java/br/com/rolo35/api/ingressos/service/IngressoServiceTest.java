package br.com.rolo35.api.ingressos.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import br.com.rolo35.api.auth.Usuario;
import br.com.rolo35.api.auth.repository.UsuarioRepository;
import br.com.rolo35.api.ingressos.Ingresso;
import br.com.rolo35.api.ingressos.IngressoNaoEncontradoException;
import br.com.rolo35.api.ingressos.StatusIngresso;
import br.com.rolo35.api.ingressos.dto.IngressoPublicoDto;
import br.com.rolo35.api.ingressos.dto.IngressoResumoDto;
import br.com.rolo35.api.ingressos.repository.IngressoRepository;
import br.com.rolo35.api.ingressos.repository.IngressoResumoProjection;
import br.com.rolo35.api.sessoes.Sala;
import br.com.rolo35.api.sessoes.Sessao;
import br.com.rolo35.api.sessoes.repository.SalaRepository;
import br.com.rolo35.api.sessoes.repository.SessaoRepository;
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
class IngressoServiceTest {

    private static final String CLIENTE_EMAIL = "cliente1@rolo35.com.br";
    private static final Long CLIENTE_ID = 7L;

    @Mock
    private IngressoRepository ingressoRepository;

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private SessaoRepository sessaoRepository;

    @Mock
    private SalaRepository salaRepository;

    @Mock
    private CodigoIngressoService codigoIngressoService;

    private IngressoService ingressoService;

    private void setUp() {
        ingressoService = new IngressoService(
                ingressoRepository, usuarioRepository, sessaoRepository, salaRepository, codigoIngressoService);
    }

    private void stubCliente() {
        Usuario usuario = new Usuario();
        ReflectionTestUtils.setField(usuario, "id", CLIENTE_ID);
        ReflectionTestUtils.setField(usuario, "email", CLIENTE_EMAIL);
        given(usuarioRepository.findByEmail(CLIENTE_EMAIL)).willReturn(Optional.of(usuario));
    }

    private IngressoResumoProjection projecao(UUID id) {
        return new IngressoResumoProjection() {
            public UUID getId() {
                return id;
            }

            public String getStatus() {
                return "VALIDO";
            }

            public String getAssentoFileira() {
                return "A";
            }

            public Integer getAssentoNumero() {
                return 1;
            }

            public String getSessaoTitulo() {
                return "Sessão fixture";
            }

            public String getSessaoPosterUrl() {
                return "https://image.tmdb.org/poster.jpg";
            }

            public String getSalaNome() {
                return "Sala 1";
            }

            public LocalDateTime getDataHora() {
                return LocalDateTime.now().plusDays(1);
            }
        };
    }

    @Test
    void listarMinhasResolveUsuarioEMapeiaProjecaoParaDto() {
        setUp();
        stubCliente();
        UUID ingressoId = UUID.randomUUID();
        given(ingressoRepository.buscarPorCliente(CLIENTE_ID)).willReturn(List.of(projecao(ingressoId)));
        given(codigoIngressoService.gerar(ingressoId)).willReturn("codigo-gerado");

        List<IngressoResumoDto> resultado = ingressoService.listarMinhas(CLIENTE_EMAIL);

        assertThat(resultado).hasSize(1);
        assertThat(resultado.get(0).id()).isEqualTo(ingressoId);
        assertThat(resultado.get(0).codigo()).isEqualTo("codigo-gerado");
        assertThat(resultado.get(0).status()).isEqualTo(StatusIngresso.VALIDO);
    }

    @Test
    void listarMinhasDevolveListaVaziaQuandoClienteNaoTemIngresso() {
        setUp();
        stubCliente();
        given(ingressoRepository.buscarPorCliente(CLIENTE_ID)).willReturn(List.of());

        List<IngressoResumoDto> resultado = ingressoService.listarMinhas(CLIENTE_EMAIL);

        assertThat(resultado).isEmpty();
    }

    @Test
    void buscarPublicoComAssinaturaInvalidaLancaExcecaoSemTocarBanco() {
        setUp();
        UUID id = UUID.randomUUID();
        String codigo = id + ".assinatura-invalida";
        given(codigoIngressoService.extrairId(codigo)).willReturn(Optional.of(id));
        given(codigoIngressoService.validar(id, codigo)).willReturn(false);

        assertThatThrownBy(() -> ingressoService.buscarPublico(codigo)).isInstanceOf(IngressoNaoEncontradoException.class);

        verify(ingressoRepository, never()).findById(any(UUID.class));
    }

    @Test
    void buscarPublicoComAssinaturaValidaMasIngressoInexistenteLancaMesmaExcecao() {
        setUp();
        UUID id = UUID.randomUUID();
        String codigo = id + ".assinatura-valida";
        given(codigoIngressoService.extrairId(codigo)).willReturn(Optional.of(id));
        given(codigoIngressoService.validar(id, codigo)).willReturn(true);
        given(ingressoRepository.findById(id)).willReturn(Optional.empty());

        assertThatThrownBy(() -> ingressoService.buscarPublico(codigo)).isInstanceOf(IngressoNaoEncontradoException.class);
    }

    @Test
    void buscarPublicoComAssinaturaEIngressoValidosDevolveDtoSemDadoDoCliente() {
        setUp();
        UUID id = UUID.randomUUID();
        String codigo = id + ".assinatura-valida";
        given(codigoIngressoService.extrairId(codigo)).willReturn(Optional.of(id));
        given(codigoIngressoService.validar(id, codigo)).willReturn(true);
        Ingresso ingresso = new Ingresso(id, 50L, 10L, 1L, StatusIngresso.VALIDO, null, Instant.now());
        given(ingressoRepository.findById(id)).willReturn(Optional.of(ingresso));
        Sessao sessao = Sessao.builder()
                .id(1L)
                .organizadorId(1L)
                .salaId(1L)
                .tmdbId(550L)
                .titulo("Sessão fixture")
                .dataHora(LocalDateTime.now().plusDays(1))
                .preco(java.math.BigDecimal.TEN)
                .createdAt(Instant.now())
                .build();
        given(sessaoRepository.findById(1L)).willReturn(Optional.of(sessao));
        Sala sala = new Sala();
        ReflectionTestUtils.setField(sala, "nome", "Sala 1");
        given(salaRepository.findById(1L)).willReturn(Optional.of(sala));

        IngressoPublicoDto dto = ingressoService.buscarPublico(codigo);

        assertThat(dto.sessaoTitulo()).isEqualTo("Sessão fixture");
        assertThat(dto.salaNome()).isEqualTo("Sala 1");
        assertThat(dto.status()).isEqualTo(StatusIngresso.VALIDO);
    }
}
