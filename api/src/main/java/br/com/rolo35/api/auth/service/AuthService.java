package br.com.rolo35.api.auth.service;

import br.com.rolo35.api.auth.CredenciaisInvalidasException;
import br.com.rolo35.api.auth.EmailJaCadastradoException;
import br.com.rolo35.api.auth.JwtService;
import br.com.rolo35.api.auth.Usuario;
import br.com.rolo35.api.auth.dto.CadastroRequest;
import br.com.rolo35.api.auth.dto.LoginRequest;
import br.com.rolo35.api.auth.dto.LoginResponse;
import br.com.rolo35.api.auth.repository.UsuarioRepository;
import java.util.Locale;
import org.springframework.dao.DataIntegrityViolationException;
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

    /**
     * E-mail é identidade, não texto livre: `=` no Postgres é case-sensitive e o cadastro grava
     * minúsculo, então sem normalizar um teclado de celular (que capitaliza a primeira letra) ou um
     * autofill que cola espaço derrubam o login com a mensagem de credencial inválida —
     * indistinguível de senha errada pra quem está tentando entrar. No service, não só no front,
     * porque a rota atende qualquer cliente HTTP. As duas pontas (cadastro e login) passam por aqui
     * de propósito: normalizar só numa delas faria a conta recém-criada não ser encontrada depois.
     *
     * <p>Locale.ROOT e não o default da JVM: em turco, "I".toLowerCase() vira "ı" (sem ponto), o que
     * quebraria o login de qualquer e-mail com I maiúsculo num servidor nessa locale.
     */
    private static String normalizarEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    public LoginResponse login(LoginRequest request) {
        String email = normalizarEmail(request.email());
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

    /**
     * Cria a conta com o papel escolhido por quem se cadastra — sem gate de autorização, de
     * propósito: a AC1 não impõe nenhuma condição sobre quem faz a requisição, e exigir um
     * ORGANIZADOR autenticado pra criar conta de PORTARIA obrigaria a depender de contas de seed
     * pra exercitar o sistema.
     *
     * <p>Devolve o mesmo `LoginResponse` do login em vez de só um 201 vazio: cadastrar e entrar em
     * seguida são o mesmo gesto pra quem está na tela, e uma segunda ida ao servidor só pra repetir
     * a senha recém-digitada não acrescenta nada.
     */
    public LoginResponse cadastrar(CadastroRequest request) {
        String email = normalizarEmail(request.email());

        // Duas checagens do mesmo e-mail, de propósito, e nenhuma das duas é redundante. Esta é o
        // caminho comum: responde 409 sem gastar um INSERT e sem depender de traduzir erro de
        // banco. Mas ela não é atômica com o save — entre consultar e gravar cabe outro cadastro
        // do mesmo e-mail —, então quem de fato garante a unicidade é a constraint
        // `uk_usuarios_email` e o catch abaixo. Sem ele, o perdedor da corrida levaria 500.
        if (usuarioRepository.findByEmail(email).isPresent()) {
            throw new EmailJaCadastradoException();
        }

        // `papel.name()` é a fronteira entre o enum (contrato da API) e a coluna VARCHAR: `Papel`
        // não atravessa pra entidade, pro JwtService nem pro LoginResponse — todos já operam em
        // String, e propagar o tipo seria refactor sem pedido de nenhuma AC.
        String papel = request.papel().name();
        String senhaHash = passwordEncoder.encode(request.senha());
        try {
            // `saveAndFlush`, e não `save`: com `save` o INSERT só vai ao banco no commit da
            // transação, depois deste bloco — a violação escaparia do catch e viraria 500.
            usuarioRepository.saveAndFlush(new Usuario(request.nome().trim(), email, senhaHash, papel));
        } catch (DataIntegrityViolationException excecao) {
            // A única constraint da tabela que este INSERT ainda pode violar é a de e-mail único: o
            // CHECK de `papel` é garantido pelo enum e os limites de tamanho pelo @Size do DTO, que
            // reprovam antes de chegar aqui.
            throw new EmailJaCadastradoException();
        }

        String token = jwtService.generateToken(email, papel);
        return new LoginResponse(token, papel);
    }
}
