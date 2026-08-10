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
}
