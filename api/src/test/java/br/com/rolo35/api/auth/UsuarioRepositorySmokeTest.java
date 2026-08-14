package br.com.rolo35.api.auth;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rolo35.api.TestcontainersConfiguration;
import br.com.rolo35.api.auth.repository.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
class UsuarioRepositorySmokeTest {

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Test
    void flywayAppliesSchemaAndSeedAndRepositoryFindsAllFourSeedProfiles() {
        assertThat(usuarioRepository.findByEmail("organizador@rolo35.com.br")).isPresent();
        assertThat(usuarioRepository.findByEmail("cliente1@rolo35.com.br")).isPresent();
        assertThat(usuarioRepository.findByEmail("cliente2@rolo35.com.br")).isPresent();
        assertThat(usuarioRepository.findByEmail("portaria@rolo35.com.br")).isPresent();

        assertThat(usuarioRepository.findByEmail("cliente1@rolo35.com.br").get().getPapel()).isEqualTo("CLIENTE");
        assertThat(usuarioRepository.findByEmail("nao-existe@rolo35.com.br")).isEmpty();
    }

    /**
     * O teste acima só lê as contas do seed, e o resto da suíte de auth roda com o repositório
     * mockado — nada provava que a entidade construída pelo construtor de registro cabe no schema.
     * Apagar o `createdAt = Instant.now()` do `Usuario`, por exemplo, deixaria a suíte inteira verde
     * e quebraria todo cadastro real na constraint `NOT NULL` da coluna.
     */
    @Test
    void salvaERecarregaUsuarioCriadoPeloConstrutorDeRegistro() {
        String email = "round-trip@rolo35.com.br";
        usuarioRepository.findByEmail(email).ifPresent(usuarioRepository::delete);

        Usuario salvo = usuarioRepository.save(new Usuario("Fulano de Tal", email, "hash-bcrypt", "PORTARIA"));

        assertThat(salvo.getId()).isNotNull();
        Usuario recarregado = usuarioRepository.findByEmail(email).orElseThrow();
        assertThat(recarregado.getNome()).isEqualTo("Fulano de Tal");
        assertThat(recarregado.getEmail()).isEqualTo(email);
        assertThat(recarregado.getSenhaHash()).isEqualTo("hash-bcrypt");
        // PORTARIA e não CLIENTE: exercita o CHECK `papel IN (...)` num valor que o seed já não usa
        // à toa, provando que o enum e a constraint do banco falam a mesma língua.
        assertThat(recarregado.getPapel()).isEqualTo("PORTARIA");
        assertThat(recarregado.getCreatedAt()).isNotNull();

        usuarioRepository.delete(recarregado);
    }
}
