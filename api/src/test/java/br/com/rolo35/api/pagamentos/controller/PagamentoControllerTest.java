package br.com.rolo35.api.pagamentos.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.rolo35.api.common.GlobalExceptionHandler;
import br.com.rolo35.api.common.NaoAutorizadoException;
import br.com.rolo35.api.pagamentos.ReservaEmDisputaException;
import br.com.rolo35.api.pagamentos.ReservaExpiradaException;
import br.com.rolo35.api.pagamentos.ResultadoSimulado;
import br.com.rolo35.api.pagamentos.dto.ConfirmarPagamentoRequest;
import br.com.rolo35.api.pagamentos.dto.IngressoDto;
import br.com.rolo35.api.pagamentos.dto.PagamentoDto;
import br.com.rolo35.api.pagamentos.service.PagamentoService;
import br.com.rolo35.api.reservas.StatusReserva;
import br.com.rolo35.api.sessoes.SessaoJaComecouException;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

@WebMvcTest(controllers = PagamentoController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
class PagamentoControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private PagamentoService pagamentoService;

    private ConfirmarPagamentoRequest requestValido() {
        return new ConfirmarPagamentoRequest(1L, ResultadoSimulado.APROVADO);
    }

    @Test
    void returns200WithPagamentoDtoForValidBody() throws Exception {
        PagamentoDto dto = new PagamentoDto(
                StatusReserva.CONFIRMADA, List.of(new IngressoDto(UUID.randomUUID(), 10L, "codigo-x", "7ZK3QW9M")));
        given(pagamentoService.confirmar(any(ConfirmarPagamentoRequest.class), anyString())).willReturn(dto);

        mockMvc.perform(post("/api/pagamentos/confirmar")
                        .principal(new UsernamePasswordAuthenticationToken("cliente1@rolo35.com.br", null))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(requestValido())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONFIRMADA"))
                .andExpect(jsonPath("$.ingressos[0].assentoId").value(10));
    }

    @Test
    void returns400WithParametroInvalidoWhenResultadoSimuladoIsMissing() throws Exception {
        mockMvc.perform(post("/api/pagamentos/confirmar")
                        .principal(new UsernamePasswordAuthenticationToken("cliente1@rolo35.com.br", null))
                        .contentType("application/json")
                        .content("{\"reservaId\": 1}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("PARAMETRO_INVALIDO"));
    }

    @Test
    void returns403WithNaoAutorizadoWhenServiceRejects() throws Exception {
        given(pagamentoService.confirmar(any(ConfirmarPagamentoRequest.class), anyString()))
                .willThrow(new NaoAutorizadoException());

        mockMvc.perform(post("/api/pagamentos/confirmar")
                        .principal(new UsernamePasswordAuthenticationToken("cliente1@rolo35.com.br", null))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(requestValido())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.codigo").value("NAO_AUTORIZADO"));
    }

    @Test
    void returns409WithReservaExpiradaWhenServiceRejects() throws Exception {
        given(pagamentoService.confirmar(any(ConfirmarPagamentoRequest.class), anyString()))
                .willThrow(new ReservaExpiradaException());

        mockMvc.perform(post("/api/pagamentos/confirmar")
                        .principal(new UsernamePasswordAuthenticationToken("cliente1@rolo35.com.br", null))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(requestValido())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("RESERVA_EXPIRADA"));
    }

    /**
     * Mesmo motivo do caso irmão em `ReservaControllerTest`: `PagamentoPage` liga a tela terminal
     * de "sessão já começou" a esta string, e nada mais na suíte prendia o envelope que a produz.
     */
    @Test
    void returns409WithSessaoJaComecouWhenServiceRejects() throws Exception {
        given(pagamentoService.confirmar(any(ConfirmarPagamentoRequest.class), anyString()))
                .willThrow(new SessaoJaComecouException());

        mockMvc.perform(post("/api/pagamentos/confirmar")
                        .principal(new UsernamePasswordAuthenticationToken("cliente1@rolo35.com.br", null))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(requestValido())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("SESSAO_JA_COMECOU"))
                .andExpect(jsonPath("$.mensagem").exists());
    }

    @Test
    void returns409WithReservaEmDisputaWhenServiceRejects() throws Exception {
        given(pagamentoService.confirmar(any(ConfirmarPagamentoRequest.class), anyString()))
                .willThrow(new ReservaEmDisputaException());

        mockMvc.perform(post("/api/pagamentos/confirmar")
                        .principal(new UsernamePasswordAuthenticationToken("cliente1@rolo35.com.br", null))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(requestValido())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("RESERVA_EM_DISPUTA"));
    }
}
