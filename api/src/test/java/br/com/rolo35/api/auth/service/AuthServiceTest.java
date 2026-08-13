package br.com.rolo35.api.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import br.com.rolo35.api.auth.CredenciaisInvalidasException;
import br.com.rolo35.api.auth.JwtService;
import br.com.rolo35.api.auth.Usuario;
import br.com.rolo35.api.auth.dto.LoginRequest;
import br.com.rolo35.api.auth.repository.UsuarioRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtService jwtService;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(usuarioRepository, passwordEncoder, jwtService);
    }

    private Usuario usuarioCom(String email, String senhaHash, String papel) {
        Usuario usuario = new Usuario();
        ReflectionTestUtils.setField(usuario, "email", email);
        ReflectionTestUtils.setField(usuario, "senhaHash", senhaHash);
        ReflectionTestUtils.setField(usuario, "papel", papel);
        return usuario;
    }

    @Test
    void returnsTokenAndPapelForValidCredentials() {
        Usuario usuario = usuarioCom("cliente1@rolo35.com.br", "hash-valido", "CLIENTE");
        given(usuarioRepository.findByEmail("cliente1@rolo35.com.br")).willReturn(Optional.of(usuario));
        given(passwordEncoder.matches("cliente123", "hash-valido")).willReturn(true);
        given(jwtService.generateToken("cliente1@rolo35.com.br", "CLIENTE")).willReturn("token-abc");

        var resposta = authService.login(new LoginRequest("cliente1@rolo35.com.br", "cliente123"));

        assertThat(resposta.token()).isEqualTo("token-abc");
        assertThat(resposta.papel()).isEqualTo("CLIENTE");
    }

    @Test
    void throwsCredenciaisInvalidasForWrongPassword() {
        Usuario usuario = usuarioCom("cliente1@rolo35.com.br", "hash-valido", "CLIENTE");
        given(usuarioRepository.findByEmail("cliente1@rolo35.com.br")).willReturn(Optional.of(usuario));
        given(passwordEncoder.matches("senha-errada", "hash-valido")).willReturn(false);

        assertThatThrownBy(() -> authService.login(new LoginRequest("cliente1@rolo35.com.br", "senha-errada")))
                .isInstanceOf(CredenciaisInvalidasException.class);
    }

    @Test
    void throwsSameExceptionForNonExistentEmail() {
        given(usuarioRepository.findByEmail("nao-existe@rolo35.com.br")).willReturn(Optional.empty());
        given(passwordEncoder.matches(anyString(), anyString())).willReturn(false);

        assertThatThrownBy(() -> authService.login(new LoginRequest("nao-existe@rolo35.com.br", "qualquer")))
                .isInstanceOf(CredenciaisInvalidasException.class);
    }

    @Test
    void runsPasswordComparisonEvenWhenEmailDoesNotExist() {
        given(usuarioRepository.findByEmail("nao-existe@rolo35.com.br")).willReturn(Optional.empty());
        given(passwordEncoder.matches(anyString(), anyString())).willReturn(false);

        try {
            authService.login(new LoginRequest("nao-existe@rolo35.com.br", "qualquer"));
        } catch (CredenciaisInvalidasException ignored) {
            // esperado
        }

        // Timing side-channel: mesmo sem usuário, uma comparação de hash precisa
        // rodar, senão a resposta pro e-mail inexistente fica sistematicamente
        // mais rápida que a de senha errada, revelando quais e-mails existem.
        verify(passwordEncoder, times(1)).matches(anyString(), anyString());
        verify(jwtService, never()).generateToken(any(), any());
    }

    // O e-mail é identidade, não texto livre: o seed grava tudo minúsculo e `=` no Postgres é
    // case-sensitive, então sem normalizar o servidor um teclado de celular (que capitaliza a
    // primeira letra por padrão) ou um autofill que cola espaço derrubam o login com a mesma
    // mensagem de "senha inválida" — indistinguível de senha errada, pro usuário e pro suporte.
    // Normalizar no service, não só no front, porque a rota atende qualquer cliente HTTP.
    @Test
    void normalizesEmailCasingBeforeLookup() {
        Usuario usuario = usuarioCom("cliente1@rolo35.com.br", "hash-valido", "CLIENTE");
        given(usuarioRepository.findByEmail("cliente1@rolo35.com.br")).willReturn(Optional.of(usuario));
        given(passwordEncoder.matches("cliente123", "hash-valido")).willReturn(true);
        given(jwtService.generateToken("cliente1@rolo35.com.br", "CLIENTE")).willReturn("token-abc");

        var resposta = authService.login(new LoginRequest("Cliente1@Rolo35.com.BR", "cliente123"));

        assertThat(resposta.token()).isEqualTo("token-abc");
    }

    @Test
    void normalizesSurroundingWhitespaceInEmailBeforeLookup() {
        Usuario usuario = usuarioCom("cliente1@rolo35.com.br", "hash-valido", "CLIENTE");
        given(usuarioRepository.findByEmail("cliente1@rolo35.com.br")).willReturn(Optional.of(usuario));
        given(passwordEncoder.matches("cliente123", "hash-valido")).willReturn(true);
        given(jwtService.generateToken("cliente1@rolo35.com.br", "CLIENTE")).willReturn("token-abc");

        var resposta = authService.login(new LoginRequest("  cliente1@rolo35.com.br  ", "cliente123"));

        assertThat(resposta.token()).isEqualTo("token-abc");
    }

    // Contraprova das duas acima: a senha é segredo, não identidade — normalizar espaço nela
    // mudaria silenciosamente o que o usuário escolheu e reduziria o espaço de senhas válidas.
    @Test
    void doesNotTrimPassword() {
        Usuario usuario = usuarioCom("cliente1@rolo35.com.br", "hash-valido", "CLIENTE");
        given(usuarioRepository.findByEmail("cliente1@rolo35.com.br")).willReturn(Optional.of(usuario));
        given(passwordEncoder.matches(" cliente123 ", "hash-valido")).willReturn(false);

        assertThatThrownBy(() -> authService.login(new LoginRequest("cliente1@rolo35.com.br", " cliente123 ")))
                .isInstanceOf(CredenciaisInvalidasException.class);

        verify(passwordEncoder).matches(" cliente123 ", "hash-valido");
    }
}
