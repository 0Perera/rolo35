package br.com.rolo35.api.reservas.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.rolo35.api.common.GlobalExceptionHandler;
import br.com.rolo35.api.common.NaoAutorizadoException;
import br.com.rolo35.api.reservas.AssentoIndisponivelException;
import br.com.rolo35.api.reservas.ClienteNaoEncontradoException;
import br.com.rolo35.api.reservas.SelecaoAssentosInvalidaException;
import br.com.rolo35.api.reservas.StatusReserva;
import br.com.rolo35.api.reservas.dto.AssentoReservadoDto;
import br.com.rolo35.api.reservas.dto.ReservaCheckoutDto;
import br.com.rolo35.api.reservas.dto.ReservaDto;
import br.com.rolo35.api.reservas.dto.ReservarAssentosRequest;
import br.com.rolo35.api.reservas.service.ReservaService;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

@WebMvcTest(controllers = ReservaController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
class ReservaControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private ReservaService reservaService;

    private ReservarAssentosRequest requestValido() {
        return new ReservarAssentosRequest(1L, List.of(10L, 20L));
    }

    @Test
    void returns200WithReservaDtoForValidBody() throws Exception {
        ReservaDto dto = new ReservaDto(
                99L, 1L, StatusReserva.ATIVA, LocalDateTime.now().plusMinutes(10), List.of(10L, 20L));
        given(reservaService.reservar(any(ReservarAssentosRequest.class), anyString())).willReturn(dto);

        mockMvc.perform(post("/api/reservas")
                        .principal(new UsernamePasswordAuthenticationToken("cliente1@rolo35.com.br", null))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(requestValido())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(99))
                .andExpect(jsonPath("$.sessaoId").value(1))
                .andExpect(jsonPath("$.status").value("ATIVA"))
                .andExpect(jsonPath("$.assentoIds[0]").value(10))
                .andExpect(jsonPath("$.assentoIds[1]").value(20));
    }

    @Test
    void returns400WithParametroInvalidoWhenAssentoIdsIsEmpty() throws Exception {
        ReservarAssentosRequest request = new ReservarAssentosRequest(1L, List.of());

        mockMvc.perform(post("/api/reservas")
                        .principal(new UsernamePasswordAuthenticationToken("cliente1@rolo35.com.br", null))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("PARAMETRO_INVALIDO"));
    }

    @Test
    void returns400WithParametroInvalidoWhenAssentoIdsHasMoreThanSix() throws Exception {
        ReservarAssentosRequest request = new ReservarAssentosRequest(1L, List.of(1L, 2L, 3L, 4L, 5L, 6L, 7L));

        mockMvc.perform(post("/api/reservas")
                        .principal(new UsernamePasswordAuthenticationToken("cliente1@rolo35.com.br", null))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("PARAMETRO_INVALIDO"));
    }

    @Test
    void returns409WithAssentoIndisponivelEnvelopeWhenServiceRejectsSelecao() throws Exception {
        given(reservaService.reservar(any(ReservarAssentosRequest.class), anyString()))
                .willThrow(new AssentoIndisponivelException());

        mockMvc.perform(post("/api/reservas")
                        .principal(new UsernamePasswordAuthenticationToken("cliente1@rolo35.com.br", null))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(requestValido())))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("ASSENTO_INDISPONIVEL"))
                .andExpect(jsonPath("$.mensagem").exists());
    }

    @Test
    void returns400WithParametroInvalidoEnvelopeWhenServiceRejectsSelecaoInvalida() throws Exception {
        given(reservaService.reservar(any(ReservarAssentosRequest.class), anyString()))
                .willThrow(new SelecaoAssentosInvalidaException());

        mockMvc.perform(post("/api/reservas")
                        .principal(new UsernamePasswordAuthenticationToken("cliente1@rolo35.com.br", null))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(requestValido())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("PARAMETRO_INVALIDO"));
    }

    @Test
    void returns200WithCheckoutShapeWhenReadingOwnReserva() throws Exception {
        ReservaCheckoutDto dto = new ReservaCheckoutDto(
                99L,
                1L,
                StatusReserva.ATIVA,
                LocalDateTime.of(2030, 1, 1, 19, 55),
                "Clube da Luta",
                "Sala 1",
                LocalDateTime.of(2030, 1, 1, 20, 0),
                new BigDecimal("25.00"),
                List.of(new AssentoReservadoDto(10L, "A", 1), new AssentoReservadoDto(20L, "A", 2)));
        given(reservaService.buscarParaCheckout(eq(99L), anyString())).willReturn(dto);

        mockMvc.perform(get("/api/reservas/99")
                        .principal(new UsernamePasswordAuthenticationToken("cliente1@rolo35.com.br", null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(99))
                .andExpect(jsonPath("$.sessaoId").value(1))
                .andExpect(jsonPath("$.status").value("ATIVA"))
                .andExpect(jsonPath("$.expiresAt").exists())
                .andExpect(jsonPath("$.sessaoTitulo").value("Clube da Luta"))
                .andExpect(jsonPath("$.salaNome").value("Sala 1"))
                .andExpect(jsonPath("$.preco").value(25.00))
                .andExpect(jsonPath("$.assentos[0].fileira").value("A"))
                .andExpect(jsonPath("$.assentos[0].numero").value(1))
                .andExpect(jsonPath("$.assentos[1].numero").value(2));
    }

    @Test
    void returns403WithNaoAutorizadoEnvelopeWhenReservaIsNotTheClientes() throws Exception {
        given(reservaService.buscarParaCheckout(anyLong(), anyString())).willThrow(new NaoAutorizadoException());

        mockMvc.perform(get("/api/reservas/99")
                        .principal(new UsernamePasswordAuthenticationToken("cliente1@rolo35.com.br", null)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.codigo").value("NAO_AUTORIZADO"))
                .andExpect(jsonPath("$.mensagem").exists());
    }

    @Test
    void returns401WithNaoAutenticadoEnvelopeWhenServiceRejectsClienteNaoEncontrado() throws Exception {
        given(reservaService.reservar(any(ReservarAssentosRequest.class), anyString()))
                .willThrow(new ClienteNaoEncontradoException());

        mockMvc.perform(post("/api/reservas")
                        .principal(new UsernamePasswordAuthenticationToken("cliente1@rolo35.com.br", null))
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(requestValido())))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("NAO_AUTENTICADO"));
    }
}
