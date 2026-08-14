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
import br.com.rolo35.api.auth.EmailJaCadastradoException;
import br.com.rolo35.api.auth.JwtService;
import br.com.rolo35.api.auth.Papel;
import br.com.rolo35.api.auth.Usuario;
import br.com.rolo35.api.auth.dto.CadastroRequest;
import br.com.rolo35.api.auth.dto.LoginRequest;
import br.com.rolo35.api.auth.repository.UsuarioRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.ArgumentCaptor;
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

    @ParameterizedTest
    @EnumSource(Papel.class)
    void cadastrarCriaUsuarioComPapelInformadoERetornaToken(Papel papel) {
        given(usuarioRepository.findByEmail("novo@rolo35.com.br")).willReturn(Optional.empty());
        given(passwordEncoder.encode("senha123")).willReturn("hash-bcrypt");
        given(jwtService.generateToken("novo@rolo35.com.br", papel.name())).willReturn("token-novo");

        var resposta =
                authService.cadastrar(new CadastroRequest("Fulano de Tal", "novo@rolo35.com.br", "senha123", papel));

        ArgumentCaptor<Usuario> salvo = ArgumentCaptor.forClass(Usuario.class);
        verify(usuarioRepository).save(salvo.capture());
        assertThat(salvo.getValue().getPapel()).isEqualTo(papel.name());
        assertThat(salvo.getValue().getNome()).isEqualTo("Fulano de Tal");
        assertThat(salvo.getValue().getEmail()).isEqualTo("novo@rolo35.com.br");
        assertThat(resposta.token()).isEqualTo("token-novo");
        assertThat(resposta.papel()).isEqualTo(papel.name());
    }

    // A senha nunca chega ao banco em texto puro (AC1) — o que a entidade carrega é o retorno do
    // encoder, e a comparação direta com a senha digitada é a contraprova disso.
    @Test
    void cadastrarPersisteSenhaComHashENuncaEmTextoPuro() {
        given(usuarioRepository.findByEmail("novo@rolo35.com.br")).willReturn(Optional.empty());
        given(passwordEncoder.encode("senha123")).willReturn("hash-bcrypt");

        authService.cadastrar(new CadastroRequest("Fulano de Tal", "novo@rolo35.com.br", "senha123", Papel.CLIENTE));

        ArgumentCaptor<Usuario> salvo = ArgumentCaptor.forClass(Usuario.class);
        verify(usuarioRepository).save(salvo.capture());
        assertThat(salvo.getValue().getSenhaHash()).isEqualTo("hash-bcrypt").isNotEqualTo("senha123");
    }

    @Test
    void cadastrarLancaEmailJaCadastradoQuandoEmailExiste() {
        Usuario existente = usuarioCom("ocupado@rolo35.com.br", "hash-valido", "CLIENTE");
        given(usuarioRepository.findByEmail("ocupado@rolo35.com.br")).willReturn(Optional.of(existente));

        assertThatThrownBy(() -> authService.cadastrar(
                        new CadastroRequest("Fulano de Tal", "ocupado@rolo35.com.br", "senha123", Papel.CLIENTE)))
                .isInstanceOf(EmailJaCadastradoException.class);

        verify(usuarioRepository, never()).save(any());
        verify(jwtService, never()).generateToken(any(), any());
    }

    // Mesma razão do login: e-mail é identidade. Se o cadastro gravasse "Novo@Rolo35.com.BR" cru, o
    // login (que normaliza) nunca acharia a conta recém-criada — e a checagem de duplicidade
    // deixaria passar o mesmo e-mail escrito com outra caixa.
    @Test
    void cadastrarNormalizaEmailAntesDeChecarDuplicidadeEPersistir() {
        given(usuarioRepository.findByEmail("novo@rolo35.com.br")).willReturn(Optional.empty());
        given(passwordEncoder.encode("senha123")).willReturn("hash-bcrypt");

        authService.cadastrar(
                new CadastroRequest("Fulano de Tal", "  Novo@Rolo35.com.BR  ", "senha123", Papel.CLIENTE));

        ArgumentCaptor<Usuario> salvo = ArgumentCaptor.forClass(Usuario.class);
        verify(usuarioRepository).save(salvo.capture());
        assertThat(salvo.getValue().getEmail()).isEqualTo("novo@rolo35.com.br");
        verify(usuarioRepository).findByEmail("novo@rolo35.com.br");
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
