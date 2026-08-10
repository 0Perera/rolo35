package br.com.rolo35.api.sessoes.service;

import br.com.rolo35.api.sessoes.dto.SalaResumoDto;
import br.com.rolo35.api.sessoes.repository.SalaRepository;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class SalaService {

    private final SalaRepository salaRepository;

    public SalaService(SalaRepository salaRepository) {
        this.salaRepository = salaRepository;
    }

    public List<SalaResumoDto> listar() {
        return salaRepository.findAll().stream()
                .map(sala -> new SalaResumoDto(sala.getId(), sala.getNome(), sala.getLinhas() * sala.getColunas()))
                .toList();
    }
}
