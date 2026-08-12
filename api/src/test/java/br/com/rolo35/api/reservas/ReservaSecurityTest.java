package br.com.rolo35.api.reservas;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.rolo35.api.auth.JwtService;
import br.com.rolo35.api.common.GlobalExceptionHandler;
import br.com.rolo35.api.config.SecurityConfig;
import br.com.rolo35.api.reservas.controller.ReservaController;
import br.com.rolo35.api.reservas.dto.ReservaDto;
import br.com.rolo35.api.reservas.dto.ReservarAssentosRequest;
import br.com.rolo35.api.reservas.service.ReservaService;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

@WebMvcTest(controllers = ReservaController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class, JwtService.class})
class ReservaSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtService jwtService;

    @MockitoBean
    private ReservaService reservaService;

    private ReservarAssentosRequest requestValido() {
        return new ReservarAssentosRequest(1L, List.of(10L, 20L));
    }

    @Test
    void returns200ForClienteToken() throws Exception {
        ReservaDto dto = new ReservaDto(
                99L, 1L, StatusReserva.ATIVA, LocalDateTime.now().plusMinutes(10), List.of(10L, 20L));
        given(reservaService.reservar(any(ReservarAssentosRequest.class), anyString())).willReturn(dto);
        String token = jwtService.generateToken("cliente1@rolo35.com.br", "CLIENTE");

        mockMvc.perform(post("/api/reservas")
                        .header("Authorization", "Bearer " + token)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(requestValido())))
                .andExpect(status().isOk());
    }

    @Test
    void returns403WithNaoAutorizadoEnvelopeForOrganizadorToken() throws Exception {
        String token = jwtService.generateToken("organizador@rolo35.com.br", "ORGANIZADOR");

        mockMvc.perform(post("/api/reservas")
                        .header("Authorization", "Bearer " + token)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(requestValido())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.codigo").value("NAO_AUTORIZADO"));
    }

    @Test
    void returns403WithNaoAutorizadoEnvelopeForPortariaToken() throws Exception {
        String token = jwtService.generateToken("portaria@rolo35.com.br", "PORTARIA");

        mockMvc.perform(post("/api/reservas")
                        .header("Authorization", "Bearer " + token)
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(requestValido())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.codigo").value("NAO_AUTORIZADO"));
    }

    @Test
    void returns401WithNaoAutenticadoEnvelopeWithoutToken() throws Exception {
        mockMvc.perform(post("/api/reservas")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(requestValido())))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("NAO_AUTENTICADO"))
                .andExpect(jsonPath("$.mensagem").exists());
    }
}
