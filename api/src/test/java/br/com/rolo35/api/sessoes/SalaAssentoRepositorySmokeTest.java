package br.com.rolo35.api.sessoes;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rolo35.api.TestcontainersConfiguration;
import br.com.rolo35.api.sessoes.Sala;
import br.com.rolo35.api.sessoes.repository.AssentoRepository;
import br.com.rolo35.api.sessoes.repository.SalaRepository;
import java.util.List;
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

    private Sala salaPorNome(List<Sala> salas, String nome) {
        return salas.stream().filter(sala -> nome.equals(sala.getNome())).findFirst().orElseThrow();
    }

    @Test
    void flywayAppliesSchemaAndSeedAndRepositoriesFindTresSalasComTamanhosVariados() {
        var salas = salaRepository.findAll();
        assertThat(salas).hasSize(3);

        var sala1 = salaPorNome(salas, "Sala 1");
        assertThat(sala1.getLinhas()).isEqualTo(8);
        assertThat(sala1.getColunas()).isEqualTo(10);
        assertThat(assentoRepository.findBySalaId(sala1.getId())).hasSize(80);

        var sala2 = salaPorNome(salas, "Sala 2");
        assertThat(sala2.getLinhas()).isEqualTo(5);
        assertThat(sala2.getColunas()).isEqualTo(6);
        assertThat(assentoRepository.findBySalaId(sala2.getId())).hasSize(30);

        var sala3 = salaPorNome(salas, "Sala 3");
        assertThat(sala3.getLinhas()).isEqualTo(10);
        assertThat(sala3.getColunas()).isEqualTo(14);
        assertThat(assentoRepository.findBySalaId(sala3.getId())).hasSize(140);
    }
}
