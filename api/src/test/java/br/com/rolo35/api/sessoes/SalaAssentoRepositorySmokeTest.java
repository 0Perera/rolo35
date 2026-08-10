package br.com.rolo35.api.sessoes;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rolo35.api.TestcontainersConfiguration;
import br.com.rolo35.api.sessoes.repository.AssentoRepository;
import br.com.rolo35.api.sessoes.repository.SalaRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
class SalaAssentoRepositorySmokeTest {

    @Autowired
    private SalaRepository salaRepository;

    @Autowired
    private AssentoRepository assentoRepository;

    @Test
    void flywayAppliesSchemaAndSeedAndRepositoriesFindSala1ComQuarentaAssentos() {
        var salas = salaRepository.findAll();
        assertThat(salas).hasSize(1);

        var sala1 = salas.get(0);
        assertThat(sala1.getNome()).isEqualTo("Sala 1");
        assertThat(sala1.getLinhas()).isEqualTo(5);
        assertThat(sala1.getColunas()).isEqualTo(8);

        assertThat(assentoRepository.findBySalaId(sala1.getId())).hasSize(40);
    }
}
