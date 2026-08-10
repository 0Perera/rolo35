package br.com.rolo35.api.common;

import br.com.rolo35.api.auth.CredenciaisInvalidasException;
import br.com.rolo35.api.sessoes.catalogo.CatalogoIndisponivelException;
import br.com.rolo35.api.sessoes.catalogo.ParametroInvalidoException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(CredenciaisInvalidasException.class)
    public ResponseEntity<ApiError> handleCredenciaisInvalidas() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiError("CREDENCIAIS_INVALIDAS", "E-mail ou senha inválidos"));
    }

    @ExceptionHandler(CatalogoIndisponivelException.class)
    public ResponseEntity<ApiError> handleCatalogoIndisponivel() {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(new ApiError("CATALOGO_INDISPONIVEL", "Catálogo de filmes indisponível no momento"));
    }

    @ExceptionHandler({ParametroInvalidoException.class, MissingServletRequestParameterException.class})
    public ResponseEntity<ApiError> handleParametroInvalido() {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiError("PARAMETRO_INVALIDO", "Parâmetro de busca inválido"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleGeneric() {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiError("ERRO_INTERNO", "Erro interno do servidor"));
    }
}
