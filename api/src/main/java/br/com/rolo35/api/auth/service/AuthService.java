package br.com.rolo35.api.auth.service;

import br.com.rolo35.api.auth.CredenciaisInvalidasException;
import br.com.rolo35.api.auth.JwtService;
import br.com.rolo35.api.auth.Usuario;
import br.com.rolo35.api.auth.dto.LoginRequest;
import br.com.rolo35.api.auth.dto.LoginResponse;
import br.com.rolo35.api.auth.repository.UsuarioRepository;
import java.util.Locale;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    // Hash BCrypt válido usado só pra equalizar o tempo de resposta quando o
    // e-mail não existe — sem ele, essa via seria sistematicamente mais rápida
    // que "senha errada" (que roda BCrypt de verdade), vazando por tempo quais
    // e-mails estão cadastrados (fere o espírito da AC5).
    private static final String DUMMY_HASH = "$2a$10$opn4ZXwT3eINEaBDXcu24OoJ7Bbv8yQGtieMQB2cl7zeutrBnByE2";

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UsuarioRepository usuarioRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    public LoginResponse login(LoginRequest request) {
        // E-mail é identidade, não texto livre: `=` no Postgres é case-sensitive e o cadastro
        // grava minúsculo, então sem normalizar aqui um teclado de celular (que capitaliza a
        // primeira letra) ou um autofill que cola espaço derrubam o login com a mensagem de
        // credencial inválida — indistinguível de senha errada pra quem está tentando entrar.
        // No service, não só no front, porque a rota atende qualquer cliente HTTP.
        // Locale.ROOT e não o default da JVM: em turco, "I".toLowerCase() vira "ı" (sem ponto),
        // o que quebraria o login de qualquer e-mail com I maiúsculo num servidor nessa locale.
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        var usuarioOpt = usuarioRepository.findByEmail(email);
        String senhaHashParaComparar = usuarioOpt.map(Usuario::getSenhaHash).orElse(DUMMY_HASH);
        boolean senhaConfere = passwordEncoder.matches(request.senha(), senhaHashParaComparar);

        if (usuarioOpt.isEmpty() || !senhaConfere) {
            throw new CredenciaisInvalidasException();
        }

        Usuario usuario = usuarioOpt.get();
        String token = jwtService.generateToken(usuario.getEmail(), usuario.getPapel());
        return new LoginResponse(token, usuario.getPapel());
    }
}
