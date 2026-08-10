package br.com.rolo35.api.sessoes.controller;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.rolo35.api.common.GlobalExceptionHandler;
import br.com.rolo35.api.sessoes.DataHoraNoPassadoException;
import br.com.rolo35.api.sessoes.SessaoConflitanteException;
import br.com.rolo35.api.sessoes.dto.CriarSessaoRequest;
import br.com.rolo35.api.sessoes.dto.SessaoListagemDto;
import br.com.rolo35.api.sessoes.dto.SessaoResponse;
import br.com.rolo35.api.sessoes.service.SessaoService;
import java.math.BigDecimal;
import java.sql.Date;
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
    void returns200WithSessaoListagemArrayForGetSessoes() throws Exception {
        SessaoListagemDto dto = new SessaoListagemDto(
                100L, "Sala 1", 550L, "Clube da Luta", "http://poster", "sinopse", Date.valueOf("1999-10-15"),
                LocalDateTime.now().plusDays(7), new BigDecimal("25.00"), 40, false);
        given(sessaoService.listarPublicadas()).willReturn(List.of(dto));

        mockMvc.perform(get("/api/sessoes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(100))
                .andExpect(jsonPath("$[0].salaNome").value("Sala 1"))
                .andExpect(jsonPath("$[0].titulo").value("Clube da Luta"))
                .andExpect(jsonPath("$[0].esgotada").value(false));
    }

    @Test
    void returns200WithEmptyArrayForGetSessoesWhenNoneExist() throws Exception {
        given(sessaoService.listarPublicadas()).willReturn(List.of());

        mockMvc.perform(get("/api/sessoes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$").isEmpty());
    }
}
