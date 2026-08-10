package br.com.rolo35.api.sessoes.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import br.com.rolo35.api.auth.Usuario;
import br.com.rolo35.api.auth.repository.UsuarioRepository;
import br.com.rolo35.api.sessoes.Assento;
import br.com.rolo35.api.sessoes.DataHoraNoPassadoException;
import br.com.rolo35.api.sessoes.Sala;
import br.com.rolo35.api.sessoes.SalaNaoEncontradaException;
import br.com.rolo35.api.sessoes.Sessao;
import br.com.rolo35.api.sessoes.SessaoConflitanteException;
import br.com.rolo35.api.sessoes.dto.CriarSessaoRequest;
import br.com.rolo35.api.sessoes.repository.AssentoRepository;
import br.com.rolo35.api.sessoes.repository.AssentoSessaoRepository;
import br.com.rolo35.api.sessoes.repository.SalaRepository;
import br.com.rolo35.api.sessoes.repository.SessaoRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class SessaoServiceTest {

    @Mock
    private SalaRepository salaRepository;

    @Mock
    private AssentoRepository assentoRepository;

    @Mock
    private SessaoRepository sessaoRepository;

    @Mock
    private AssentoSessaoRepository assentoSessaoRepository;

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private EntityManager entityManager;

    @Mock
    private Query query;

    private SessaoService sessaoService;

    @BeforeEach
    void setUp() {
        sessaoService = new SessaoService(
                salaRepository, assentoRepository, sessaoRepository, assentoSessaoRepository, usuarioRepository,
                entityManager);
    }

    private Sala salaCom(Long id, String nome, int linhas, int colunas) {
        Sala sala = new Sala();
        ReflectionTestUtils.setField(sala, "id", id);
        ReflectionTestUtils.setField(sala, "nome", nome);
        ReflectionTestUtils.setField(sala, "linhas", linhas);
        ReflectionTestUtils.setField(sala, "colunas", colunas);
        return sala;
    }

    private Usuario organizadorCom(Long id, String email) {
        Usuario usuario = new Usuario();
        ReflectionTestUtils.setField(usuario, "id", id);
        ReflectionTestUtils.setField(usuario, "email", email);
        ReflectionTestUtils.setField(usuario, "papel", "ORGANIZADOR");
        return usuario;
    }

    private Assento assentoCom(Long id, Long salaId, String fileira, int numero) {
        Assento assento = new Assento();
        ReflectionTestUtils.setField(assento, "id", id);
        ReflectionTestUtils.setField(assento, "salaId", salaId);
        ReflectionTestUtils.setField(assento, "fileira", fileira);
        ReflectionTestUtils.setField(assento, "numero", numero);
        return assento;
    }

    private CriarSessaoRequest requestValido() {
        return new CriarSessaoRequest(
                1L, 550L, "Clube da Luta", "http://poster", "sinopse", "1999-10-15",
                LocalDateTime.now().plusDays(30), new BigDecimal("25.00"));
    }

    @Test
    void criaSessaoComCapacidadeDerivadaDaSalaQuandoNaoHaConflito() {
        given(entityManager.createNativeQuery(any(String.class))).willReturn(query);
        Sala sala = salaCom(1L, "Sala 1", 5, 8);
        given(salaRepository.findByIdForUpdate(1L)).willReturn(Optional.of(sala));
        given(usuarioRepository.findByEmail("organizador@rolo35.com.br"))
                .willReturn(Optional.of(organizadorCom(10L, "organizador@rolo35.com.br")));
        given(sessaoRepository.existeConflitante(anyLong(), any(LocalDateTime.class), any(Integer.class)))
                .willReturn(false);
        given(sessaoRepository.save(any(Sessao.class))).willAnswer(invocation -> {
            Sessao sessao = invocation.getArgument(0);
            ReflectionTestUtils.setField(sessao, "id", 100L);
            return sessao;
        });
        List<Assento> assentos = List.of(
                assentoCom(1L, 1L, "A", 1), assentoCom(2L, 1L, "A", 2), assentoCom(3L, 1L, "A", 3),
                assentoCom(4L, 1L, "A", 4), assentoCom(5L, 1L, "A", 5), assentoCom(6L, 1L, "A", 6),
                assentoCom(7L, 1L, "A", 7), assentoCom(8L, 1L, "A", 8));
        given(assentoRepository.findBySalaId(1L)).willReturn(assentos);

        var resposta = sessaoService.criar(requestValido(), "organizador@rolo35.com.br");

        assertThat(resposta.capacidade()).isEqualTo(40);
        assertThat(resposta.salaNome()).isEqualTo("Sala 1");
        assertThat(resposta.organizadorId()).isEqualTo(10L);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<br.com.rolo35.api.sessoes.AssentoSessao>> captor = ArgumentCaptor.forClass(List.class);
        verify(assentoSessaoRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).hasSize(8);
        assertThat(captor.getValue()).allSatisfy(as -> assertThat(as.getStatus()).isEqualTo("LIVRE"));
    }

    @Test
    void rejeitaDataHoraNoPassadoSemTravarSala() {
        CriarSessaoRequest request = new CriarSessaoRequest(
                1L, 550L, "Clube da Luta", null, null, null, LocalDateTime.now().minusDays(1),
                new BigDecimal("25.00"));

        assertThatThrownBy(() -> sessaoService.criar(request, "organizador@rolo35.com.br"))
                .isInstanceOf(DataHoraNoPassadoException.class);

        verify(salaRepository, never()).findByIdForUpdate(any());
    }

    @Test
    void rejeitaSessaoConflitanteAposTravarSala() {
        given(entityManager.createNativeQuery(any(String.class))).willReturn(query);
        Sala sala = salaCom(1L, "Sala 1", 5, 8);
        given(salaRepository.findByIdForUpdate(1L)).willReturn(Optional.of(sala));
        given(usuarioRepository.findByEmail("organizador@rolo35.com.br"))
                .willReturn(Optional.of(organizadorCom(10L, "organizador@rolo35.com.br")));
        given(sessaoRepository.existeConflitante(anyLong(), any(LocalDateTime.class), any(Integer.class)))
                .willReturn(true);

        assertThatThrownBy(() -> sessaoService.criar(requestValido(), "organizador@rolo35.com.br"))
                .isInstanceOf(SessaoConflitanteException.class);

        verify(salaRepository).findByIdForUpdate(1L);
        verify(sessaoRepository, never()).save(any());
    }

    @Test
    void rejeitaSalaInexistente() {
        given(entityManager.createNativeQuery(any(String.class))).willReturn(query);
        given(salaRepository.findByIdForUpdate(1L)).willReturn(Optional.empty());
        given(usuarioRepository.findByEmail("organizador@rolo35.com.br"))
                .willReturn(Optional.of(organizadorCom(10L, "organizador@rolo35.com.br")));

        assertThatThrownBy(() -> sessaoService.criar(requestValido(), "organizador@rolo35.com.br"))
                .isInstanceOf(SalaNaoEncontradaException.class);
    }
}
