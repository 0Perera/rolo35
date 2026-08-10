package br.com.rolo35.api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import java.util.Date;
import org.junit.jupiter.api.Test;

class JwtServiceTest {

    private static final String SECRET = "teste-secret-com-tamanho-suficiente-pra-hs256-0123456789";

    @Test
    void generatesTokenWithPapelClaimAndFutureExpiration() {
        JwtService jwtService = new JwtService(SECRET, 480);

        String token = jwtService.generateToken("cliente1@rolo35.com.br", "CLIENTE");
        Claims claims = jwtService.parseClaims(token);

        assertThat(claims.getSubject()).isEqualTo("cliente1@rolo35.com.br");
        assertThat(claims.get("papel", String.class)).isEqualTo("CLIENTE");
        assertThat(claims.getExpiration()).isAfter(new Date());
    }

    @Test
    void rejectsTamperedToken() {
        JwtService jwtService = new JwtService(SECRET, 480);
        String token = jwtService.generateToken("cliente1@rolo35.com.br", "CLIENTE");
        String tampered = token.substring(0, token.length() - 1) + (token.endsWith("a") ? "b" : "a");

        assertThatThrownBy(() -> jwtService.parseClaims(tampered)).isInstanceOf(JwtException.class);
    }

    @Test
    void rejectsExpiredToken() {
        JwtService expiredService = new JwtService(SECRET, -1);
        String token = expiredService.generateToken("cliente1@rolo35.com.br", "CLIENTE");

        assertThatThrownBy(() -> expiredService.parseClaims(token)).isInstanceOf(JwtException.class);
    }
}
