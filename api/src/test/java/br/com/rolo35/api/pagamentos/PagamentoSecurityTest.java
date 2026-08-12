package br.com.rolo35.api.pagamentos;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.rolo35.api.auth.JwtService;
import br.com.rolo35.api.common.GlobalExceptionHandler;
import br.com.rolo35.api.config.SecurityConfig;
import br.com.rolo35.api.pagamentos.controller.PagamentoController;
import br.com.rolo35.api.pagamentos.dto.ConfirmarPagamentoRequest;
import br.com.rolo35.api.pagamentos.dto.PagamentoDto;
import br.com.rolo35.api.pagamentos.service.PagamentoService;
import br.com.rolo35.api.reservas.StatusReserva;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

@WebMvcTest(controllers = PagamentoController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class, JwtService.class})
class PagamentoSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtService jwtService;

    @MockitoBean
    private PagamentoService pagamentoService;

    private ConfirmarPagamentoRequest requestValido() {
        return new ConfirmarPagamentoRequest(1L, ResultadoSimulado.APROVADO);
    }

    @Test
    void returns200ForClienteToken() throws Exception {
        given(pagamentoService.confirmar(any(ConfirmarPagamentoRequest.class), anyString()))
                .willReturn(new PagamentoDto(StatusReserva.CONFIRMADA, List.of()));
        String token = jwtService.generateToken("cliente1@rolo35.com.br", "CLIENTE");

        mockMvc.perform(post("/api/pagamentos/confirmar")
                        .header("Authorization", "Bearer " + token)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(requestValido())))
                .andExpect(status().isOk());
    }

    @Test
    void returns403WithNaoAutorizadoEnvelopeForOrganizadorToken() throws Exception {
        String token = jwtService.generateToken("organizador@rolo35.com.br", "ORGANIZADOR");

        mockMvc.perform(post("/api/pagamentos/confirmar")
                        .header("Authorization", "Bearer " + token)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(requestValido())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.codigo").value("NAO_AUTORIZADO"));
    }

    @Test
    void returns403WithNaoAutorizadoEnvelopeForPortariaToken() throws Exception {
        String token = jwtService.generateToken("portaria@rolo35.com.br", "PORTARIA");

        mockMvc.perform(post("/api/pagamentos/confirmar")
                        .header("Authorization", "Bearer " + token)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(requestValido())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.codigo").value("NAO_AUTORIZADO"));
    }

    @Test
    void returns401WithNaoAutenticadoEnvelopeWithoutToken() throws Exception {
        mockMvc.perform(post("/api/pagamentos/confirmar")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(requestValido())))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("NAO_AUTENTICADO"))
                .andExpect(jsonPath("$.mensagem").exists());
    }
}
