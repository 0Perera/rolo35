package br.com.rolo35.api.auth;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.rolo35.api.auth.controller.AuthController;
import br.com.rolo35.api.auth.dto.CadastroRequest;
import br.com.rolo35.api.auth.dto.LoginResponse;
import br.com.rolo35.api.auth.service.AuthService;
import br.com.rolo35.api.auth.service.LimitadorDeCadastro;
import br.com.rolo35.api.common.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/**
 * O limitador real entra aqui, com teto baixo, porque `AuthControllerTest` o substitui por mock —
 * lá o teto atrapalharia testes que nada têm a ver com limite. Esta classe existe pra provar o
 * caminho oposto: que o teto de fato fecha, e fecha no envelope de erro da API.
 */
@WebMvcTest(controllers = AuthController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import({GlobalExceptionHandler.class, LimitadorDeCadastro.class})
@TestPropertySource(properties = {"cadastro.limite.tentativas=2", "cadastro.limite.janela-minutos=60"})
class CadastroLimiteControllerTest {

    // Um endereço por teste, de propósito. O limitador é singleton do contexto e guarda a contagem
    // entre métodos — reaproveitar um endereço faria um teste herdar o teto já gasto pelo anterior,
    // e a ordem de execução decidiria quem passa. Isolar por endereço custa menos que sujar o
    // contexto a cada método.
    private static final String CLIENTE_DO_TETO = "203.0.113.10";
    private static final String CLIENTE_DO_SERVICO = "203.0.113.11";
    private static final String CLIENTE_DO_ISOLAMENTO = "203.0.113.12";
    private static final String CLIENTE_DO_CORPO_INVALIDO = "203.0.113.13";

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AuthService authService;

    @BeforeEach
    void setUp() {
        given(authService.cadastrar(any(CadastroRequest.class))).willReturn(new LoginResponse("token-abc", "CLIENTE"));
    }

    @Test
    void devolve429NoEnvelopeDaApiDepoisDoTeto() throws Exception {
        cadastrar(CLIENTE_DO_TETO).andExpect(status().isOk());
        cadastrar(CLIENTE_DO_TETO).andExpect(status().isOk());

        cadastrar(CLIENTE_DO_TETO)
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.codigo").value("LIMITE_DE_CADASTRO_EXCEDIDO"))
                .andExpect(jsonPath("$.mensagem").isNotEmpty());
    }

    /** Bloqueado é bloqueado antes do serviço: o teto não pode existir só na resposta. */
    @Test
    void tentativaBloqueadaNaoChegaAoServico() throws Exception {
        cadastrar(CLIENTE_DO_SERVICO);
        cadastrar(CLIENTE_DO_SERVICO);
        cadastrar(CLIENTE_DO_SERVICO).andExpect(status().isTooManyRequests());

        verify(authService, times(2)).cadastrar(any(CadastroRequest.class));
    }

    @Test
    void enderecosDiferentesNaoCompartilhamOTeto() throws Exception {
        cadastrar(CLIENTE_DO_ISOLAMENTO);
        cadastrar(CLIENTE_DO_ISOLAMENTO);
        cadastrar(CLIENTE_DO_ISOLAMENTO).andExpect(status().isTooManyRequests());

        cadastrar("198.51.100.20").andExpect(status().isOk());
    }

    /**
     * `X-Forwarded-For` numa cadeia de proxies traz o cliente original primeiro. Ler o último (ou o
     * cabeçalho inteiro) faria todos os clientes atrás do mesmo proxy dividirem um teto só.
     */
    @Test
    void contaPeloPrimeiroEnderecoDaCadeiaDeProxies() throws Exception {
        cadastrar("203.0.113.30, 70.41.3.18");
        cadastrar("203.0.113.30, 150.172.238.178");

        cadastrar("203.0.113.30, 10.0.0.1").andExpect(status().isTooManyRequests());
    }

    /** Errar o formulário não pode gastar o teto de quem nunca chegou a criar conta. */
    @Test
    void corpoInvalidoNaoGastaOTeto() throws Exception {
        mockMvc.perform(post("/api/auth/cadastro")
                        .header("X-Forwarded-For", CLIENTE_DO_CORPO_INVALIDO)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"\",\"email\":\"nao-e-email\",\"senha\":\"123\",\"papel\":\"CLIENTE\"}"))
                .andExpect(status().isBadRequest());

        cadastrar(CLIENTE_DO_CORPO_INVALIDO).andExpect(status().isOk());
        cadastrar(CLIENTE_DO_CORPO_INVALIDO).andExpect(status().isOk());
        cadastrar(CLIENTE_DO_CORPO_INVALIDO).andExpect(status().isTooManyRequests());
    }

    private ResultActions cadastrar(String encaminhados) throws Exception {
        return mockMvc.perform(post("/api/auth/cadastro")
                .header("X-Forwarded-For", encaminhados)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                        """
                        {"nome":"Fulano de Tal","email":"novo@rolo35.com.br","senha":"senha123","papel":"CLIENTE"}
                        """));
    }
}
