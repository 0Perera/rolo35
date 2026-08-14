package br.com.rolo35.api.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Metadados da documentação e o esquema de autenticação — nada mais.
 *
 * <p>O envelope de erro {@code {codigo, mensagem}} (AD-11) <b>não</b> é anotado endpoint a endpoint
 * com {@code @ApiResponse}. Seriam mais de vinte anotações repetindo a mesma estrutura em cima de
 * controllers que hoje se leem em dez segundos, e a informação que elas dariam — quais códigos
 * existem e o que cada um significa — já está numa tabela única no README §6, que é onde ela cabe
 * inteira. A escolha é consciente: a documentação gerada descreve o contrato de sucesso, e o
 * contrato de erro tem uma fonte só, em vez de vinte cópias parciais.
 */
@Configuration
public class OpenApiConfig {

    private static final String ESQUEMA_BEARER = "bearer-jwt";

    @Bean
    OpenAPI rolo35OpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("rolo35 API")
                        .version("v1")
                        .description(
                                """
                                API do rolo35 — cinema de bairro: catálogo, sessões, reserva de assento, \
                                pagamento simulado e validação de ingresso na portaria.

                                Erros seguem um envelope único `{"codigo": "<ENUM_ESTAVEL>", "mensagem": "<texto>"}`. \
                                A lista completa de códigos, com status HTTP e quando cada um acontece, está no \
                                README, seção 6.

                                Para usar as rotas autenticadas: chame `POST /api/auth/login`, copie o `token` da \
                                resposta e cole em **Authorize**.\
                                """))
                // Sem isto o botão "Authorize" não existe, e toda rota autenticada só dá pra testar
                // por curl — o que anula metade do motivo de ter Swagger UI.
                .components(new Components()
                        .addSecuritySchemes(
                                ESQUEMA_BEARER,
                                new SecurityScheme()
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList(ESQUEMA_BEARER));
    }
}
