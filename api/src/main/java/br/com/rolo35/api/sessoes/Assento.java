package br.com.rolo35.api.sessoes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "assentos")
@Getter
@NoArgsConstructor
public class Assento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sala_id", nullable = false)
    private Long salaId;

    @Column(nullable = false)
    private String fileira;

    @Column(nullable = false)
    private Integer numero;
}
