package br.com.rolo35.api.config;

import br.com.rolo35.api.common.ApiError;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import tools.jackson.databind.ObjectMapper;

/**
 * Requisição sem token, com token malformado ou expirado nunca chega ao DispatcherServlet: o
 * ExceptionTranslationFilter a resolve pelo authenticationEntryPoint. Sem este, o default é o
 * Http403ForbiddenEntryPoint, que responde 403 com corpo vazio e quebra o envelope único da API.
 */
public class RestAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper;

    public RestAuthenticationEntryPoint(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void commence(
            HttpServletRequest request, HttpServletResponse response, AuthenticationException authException)
            throws IOException {
        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        ApiError error = new ApiError("NAO_AUTENTICADO", "Autenticação necessária para acessar este recurso");
        response.getWriter().write(objectMapper.writeValueAsString(error));
    }
}
