package br.com.rolo35.api.sessoes.controller;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.rolo35.api.common.GlobalExceptionHandler;
import br.com.rolo35.api.common.PaginaDto;
import br.com.rolo35.api.sessoes.DataHoraNoPassadoException;
import br.com.rolo35.api.sessoes.SessaoComIngressoConfirmadoException;
import br.com.rolo35.api.sessoes.SessaoConflitanteException;
import br.com.rolo35.api.sessoes.SessaoNaoEncontradaException;
import br.com.rolo35.api.sessoes.dto.AssentoMapaDto;
import br.com.rolo35.api.sessoes.dto.CriarSessaoRequest;
import br.com.rolo35.api.sessoes.dto.EditarSessaoRequest;
import br.com.rolo35.api.sessoes.dto.MapaAssentosDto;
import br.com.rolo35.api.sessoes.dto.SessaoGestaoDto;
import br.com.rolo35.api.sessoes.dto.SessaoListagemDto;
import br.com.rolo35.api.sessoes.dto.SessaoResponse;
import br.com.rolo35.api.sessoes.service.SessaoService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.CannotAcquireLockException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

@WebMvcTest(controllers = SessaoController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
class SessaoControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private SessaoService sessaoService;

    private CriarSessaoRequest requestValido() {
        return new CriarSessaoRequest(
                1L, 550L, "Clube da Luta", "http://poster", "sinopse", "1999-10-15",
                LocalDateTime.now().plusDays(30), new BigDecimal("25.00"));
    }

    @Test
    void returns201WithSessaoResponseForValidBody() throws Exception {
        SessaoResponse resposta = new SessaoResponse(
                100L, 1L, "Sala 1", 550L, "Clube da Luta", "http://poster", "sinopse", "1999-10-15",
                LocalDateTime.now().plusDays(30), new BigDecimal("25.00"), 40, 10L);
        given(sessaoService.criar(any(CriarSessaoRequest.class), anyString())).willReturn(resposta);

        mockMvc.perform(post("/api/sessoes")
                        .principal(new UsernamePasswordAuthenticationToken("organizador@rolo35.com.br", null))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(requestValido())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(100))
                .andExpect(jsonPath("$.salaId").value(1))
                .andExpect(jsonPath("$.salaNome").value("Sala 1"))
                .andExpect(jsonPath("$.tmdbId").value(550))
                .andExpect(jsonPath("$.titulo").value("Clube da Luta"))
                .andExpect(jsonPath("$.capacidade").value(40))
                .andExpect(jsonPath("$.organizadorId").value(10));
    }

    @Test
    void returns400WithDataHoraNoPassadoEnvelope() throws Exception {
        given(sessaoService.criar(any(CriarSessaoRequest.class), anyString()))
                .willThrow(new DataHoraNoPassadoException());

        mockMvc.perform(post("/api/sessoes")
                        .principal(new UsernamePasswordAuthenticationToken("organizador@rolo35.com.br", null))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(requestValido())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("DATA_HORA_NO_PASSADO"))
                .andExpect(jsonPath("$.mensagem").exists());
    }

    @Test
    void returns409WithSessaoConflitanteEnvelope() throws Exception {
        given(sessaoService.criar(any(CriarSessaoRequest.class), anyString()))
                .willThrow(new SessaoConflitanteException());

        mockMvc.perform(post("/api/sessoes")
                        .principal(new UsernamePasswordAuthenticationToken("organizador@rolo35.com.br", null))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(requestValido())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("SESSAO_CONFLITANTE"))
                .andExpect(jsonPath("$.mensagem").exists());
    }

    @Test
    void returns400WithParametroInvalidoWhenSalaIdIsNull() throws Exception {
        CriarSessaoRequest request = new CriarSessaoRequest(
                null, 550L, "Clube da Luta", null, null, null, LocalDateTime.now().plusDays(30),
                new BigDecimal("25.00"));

        mockMvc.perform(post("/api/sessoes")
                        .principal(new UsernamePasswordAuthenticationToken("organizador@rolo35.com.br", null))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("PARAMETRO_INVALIDO"))
                .andExpect(jsonPath("$.mensagem").exists());
    }

    @Test
    void returns400WithParametroInvalidoWhenPrecoIsNegative() throws Exception {
        CriarSessaoRequest request = new CriarSessaoRequest(
                1L, 550L, "Clube da Luta", null, null, null, LocalDateTime.now().plusDays(30),
                new BigDecimal("-1.00"));

        mockMvc.perform(post("/api/sessoes")
                        .principal(new UsernamePasswordAuthenticationToken("organizador@rolo35.com.br", null))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("PARAMETRO_INVALIDO"))
                .andExpect(jsonPath("$.mensagem").exists());
    }

    // A mensagem tem que nomear o campo: quem cria uma sessão não tem "parâmetro de busca"
    // nenhum na tela, e o front repassa esse texto direto pro alerta da página.
    @Test
    void validationMessageNamesTheOffendingField() throws Exception {
        CriarSessaoRequest request = new CriarSessaoRequest(
                null, 550L, "Clube da Luta", null, null, null, LocalDateTime.now().plusDays(30),
                new BigDecimal("25.00"));

        mockMvc.perform(post("/api/sessoes")
                        .principal(new UsernamePasswordAuthenticationToken("organizador@rolo35.com.br", null))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.mensagem").value(containsString("salaId")));
    }

    @Test
    void returns400WithParametroInvalidoWhenPrecoHasMoreThanTwoDecimals() throws Exception {
        CriarSessaoRequest request = new CriarSessaoRequest(
                1L, 550L, "Clube da Luta", null, null, null, LocalDateTime.now().plusDays(30),
                new BigDecimal("25.555"));

        mockMvc.perform(post("/api/sessoes")
                        .principal(new UsernamePasswordAuthenticationToken("organizador@rolo35.com.br", null))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("PARAMETRO_INVALIDO"));
    }

    @Test
    void returns400WithCorpoInvalidoForMalformedBody() throws Exception {
        mockMvc.perform(post("/api/sessoes")
                        .principal(new UsernamePasswordAuthenticationToken("organizador@rolo35.com.br", null))
                        .contentType("application/json")
                        .content("{\"salaId\": 1, \"dataHora\": \"amanhã\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("CORPO_INVALIDO"))
                .andExpect(jsonPath("$.mensagem").exists());
    }

    // Estouro do lock_timeout da transação de criação não pode virar 500: a requisição é
    // válida, só perdeu a vez na fila da sala.
    @Test
    void returns503WithSalaOcupadaWhenLockCannotBeAcquired() throws Exception {
        given(sessaoService.criar(any(CriarSessaoRequest.class), anyString()))
                .willThrow(new CannotAcquireLockException("lock timeout"));

        mockMvc.perform(post("/api/sessoes")
                        .principal(new UsernamePasswordAuthenticationToken("organizador@rolo35.com.br", null))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(requestValido())))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.codigo").value("SALA_OCUPADA"))
                .andExpect(jsonPath("$.mensagem").exists());
    }

    @Test
    void returns200WithPaginaDeSessoesForGetSessoes() throws Exception {
        SessaoListagemDto dto = new SessaoListagemDto(
                100L, "Sala 1", 550L, "Clube da Luta", "http://poster", "sinopse", LocalDate.parse("1999-10-15"),
                LocalDateTime.now().plusDays(7), new BigDecimal("25.00"), 40, false);
        given(sessaoService.listarPublicadas(any(), any(), any(), anyInt(), anyInt()))
                .willReturn(new PaginaDto<>(List.of(dto), 0, 12, 1, 1));

        mockMvc.perform(get("/api/sessoes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.conteudo[0].id").value(100))
                .andExpect(jsonPath("$.conteudo[0].salaNome").value("Sala 1"))
                .andExpect(jsonPath("$.conteudo[0].titulo").value("Clube da Luta"))
                .andExpect(jsonPath("$.conteudo[0].esgotada").value(false))
                .andExpect(jsonPath("$.pagina").value(0))
                .andExpect(jsonPath("$.tamanho").value(12))
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.totalPaginas").value(1));
    }

    @Test
    void returns200WithEmptyContentForGetSessoesWhenNoneExist() throws Exception {
        given(sessaoService.listarPublicadas(any(), any(), any(), anyInt(), anyInt()))
                .willReturn(new PaginaDto<>(List.of(), 0, 12, 0, 0));

        mockMvc.perform(get("/api/sessoes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.conteudo").isArray())
                .andExpect(jsonPath("$.conteudo").isEmpty())
                .andExpect(jsonPath("$.total").value(0));
    }

    // Sem esta checagem, um erro de nome no @RequestParam passaria despercebido: a resposta
    // continuaria 200 e a tela continuaria mostrando a primeira página em toda navegação.
    @Test
    void passesSearchAndPaginationParamsThroughToService() throws Exception {
        given(sessaoService.listarPublicadas(any(), any(), any(), anyInt(), anyInt()))
                .willReturn(new PaginaDto<>(List.of(), 2, 8, 0, 0));

        mockMvc.perform(get("/api/sessoes").param("q", "jurassic").param("pagina", "2").param("tamanho", "8"))
                .andExpect(status().isOk());

        then(sessaoService).should().listarPublicadas("jurassic", null, null, 2, 8);
    }

    // O detalhe do filme depende deste filtro pra achar as sessões de um filme específico. Sem ele,
    // a página só encontraria filmes que caíssem por acaso na primeira página da listagem.
    @Test
    void passesTmdbIdFilterThroughToService() throws Exception {
        given(sessaoService.listarPublicadas(any(), any(), any(), anyInt(), anyInt()))
                .willReturn(new PaginaDto<>(List.of(), 0, 50, 0, 0));

        mockMvc.perform(get("/api/sessoes").param("tmdbId", "550").param("tamanho", "50"))
                .andExpect(status().isOk());

        then(sessaoService).should().listarPublicadas(null, 550L, null, 0, 50);
    }

    // Página fora do intervalo é navegação, não erro: link antigo ou URL editada à mão devolve
    // conteúdo vazio com o total correto, e a tela consegue se recolocar na última página válida.
    @Test
    void returns200WithEmptyContentForPageBeyondTheLast() throws Exception {
        given(sessaoService.listarPublicadas(any(), any(), any(), anyInt(), anyInt()))
                .willReturn(new PaginaDto<>(List.of(), 99, 12, 5, 1));

        mockMvc.perform(get("/api/sessoes").param("pagina", "99"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.conteudo").isEmpty())
                .andExpect(jsonPath("$.total").value(5))
                .andExpect(jsonPath("$.totalPaginas").value(1));
    }

    @Test
    void usesDefaultPaginationWhenParamsAreAbsent() throws Exception {
        given(sessaoService.listarPublicadas(any(), any(), any(), anyInt(), anyInt()))
                .willReturn(new PaginaDto<>(List.of(), 0, 12, 0, 0));

        mockMvc.perform(get("/api/sessoes")).andExpect(status().isOk());

        then(sessaoService).should().listarPublicadas(null, null, null, 0, 12);
    }

    private EditarSessaoRequest editarRequestValido() {
        return new EditarSessaoRequest(
                1L, "Clube da Luta (editado)", "sinopse editada", LocalDateTime.now().plusDays(30),
                new BigDecimal("30.00"));
    }

    @Test
    void returns200WithSessaoGestaoArrayForGetGestao() throws Exception {
        SessaoGestaoDto dto = new SessaoGestaoDto(
                100L, 1L, "Sala 1", "Clube da Luta", "sinopse", LocalDateTime.now().plusDays(7),
                new BigDecimal("25.00"), 40, true);
        given(sessaoService.listarParaGestao(anyString())).willReturn(List.of(dto));

        mockMvc.perform(get("/api/sessoes/gestao")
                        .principal(new UsernamePasswordAuthenticationToken("organizador@rolo35.com.br", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(100))
                .andExpect(jsonPath("$[0].editavel").value(true));
    }

    @Test
    void returns200WithSessaoGestaoDetailForGetById() throws Exception {
        SessaoGestaoDto dto = new SessaoGestaoDto(
                100L, 1L, "Sala 1", "Clube da Luta", "sinopse", LocalDateTime.now().plusDays(7),
                new BigDecimal("25.00"), 40, true);
        given(sessaoService.buscarPorId(100L, "organizador@rolo35.com.br")).willReturn(dto);

        mockMvc.perform(get("/api/sessoes/100")
                        .principal(new UsernamePasswordAuthenticationToken("organizador@rolo35.com.br", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(100))
                .andExpect(jsonPath("$.salaNome").value("Sala 1"));
    }

    @Test
    void returns404WithSessaoNaoEncontradaEnvelopeForGetById() throws Exception {
        given(sessaoService.buscarPorId(anyLong(), anyString())).willThrow(new SessaoNaoEncontradaException());

        mockMvc.perform(get("/api/sessoes/999")
                        .principal(new UsernamePasswordAuthenticationToken("organizador@rolo35.com.br", null)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.codigo").value("SESSAO_NAO_ENCONTRADA"));
    }

    @Test
    void returns200WithSessaoResponseForValidPut() throws Exception {
        SessaoResponse resposta = new SessaoResponse(
                100L, 1L, "Sala 1", 550L, "Clube da Luta (editado)", "http://poster", "sinopse editada",
                "1999-10-15", LocalDateTime.now().plusDays(30), new BigDecimal("30.00"), 40, 10L);
        given(sessaoService.editar(anyLong(), any(EditarSessaoRequest.class), anyString())).willReturn(resposta);

        mockMvc.perform(put("/api/sessoes/100")
                        .principal(new UsernamePasswordAuthenticationToken("organizador@rolo35.com.br", null))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(editarRequestValido())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.titulo").value("Clube da Luta (editado)"));
    }

    @Test
    void returns409WithSessaoComIngressoConfirmadoEnvelopeForPut() throws Exception {
        given(sessaoService.editar(anyLong(), any(EditarSessaoRequest.class), anyString()))
                .willThrow(new SessaoComIngressoConfirmadoException());

        mockMvc.perform(put("/api/sessoes/100")
                        .principal(new UsernamePasswordAuthenticationToken("organizador@rolo35.com.br", null))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(editarRequestValido())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("SESSAO_COM_INGRESSO_CONFIRMADO"));
    }

    @Test
    void returns400WithParametroInvalidoForPutWithNegativePreco() throws Exception {
        EditarSessaoRequest request = new EditarSessaoRequest(
                1L, "Clube da Luta", "sinopse", LocalDateTime.now().plusDays(30), new BigDecimal("-1.00"));

        mockMvc.perform(put("/api/sessoes/100")
                        .principal(new UsernamePasswordAuthenticationToken("organizador@rolo35.com.br", null))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("PARAMETRO_INVALIDO"));
    }

    @Test
    void returns200WithMapaAssentosDtoForGetMapaAssentos() throws Exception {
        MapaAssentosDto dto = new MapaAssentosDto(
                100L, 550L, "Clube da Luta", "http://poster", "Sala 1", LocalDateTime.now().plusDays(7),
                new BigDecimal("25.00"),
                List.of(new AssentoMapaDto(1L, "A", 1, "LIVRE"), new AssentoMapaDto(2L, "A", 2, "RESERVADO")));
        given(sessaoService.mapaAssentos(100L)).willReturn(dto);

        mockMvc.perform(get("/api/sessoes/100/mapa-assentos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessaoId").value(100))
                .andExpect(jsonPath("$.tmdbId").value(550))
                .andExpect(jsonPath("$.titulo").value("Clube da Luta"))
                .andExpect(jsonPath("$.salaNome").value("Sala 1"))
                .andExpect(jsonPath("$.assentos[0].id").value(1))
                .andExpect(jsonPath("$.assentos[0].fileira").value("A"))
                .andExpect(jsonPath("$.assentos[0].numero").value(1))
                .andExpect(jsonPath("$.assentos[0].status").value("LIVRE"))
                .andExpect(jsonPath("$.assentos[1].status").value("RESERVADO"))
                .andExpect(jsonPath("$.assentos[0].reservaId").doesNotExist())
                .andExpect(jsonPath("$.assentos[0].expiresAt").doesNotExist());
    }

    @Test
    void returns404WithSessaoNaoEncontradaEnvelopeForGetMapaAssentos() throws Exception {
        given(sessaoService.mapaAssentos(999L)).willThrow(new SessaoNaoEncontradaException());

        mockMvc.perform(get("/api/sessoes/999/mapa-assentos"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.codigo").value("SESSAO_NAO_ENCONTRADA"));
    }
}
