FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN ./mvnw -B dependency:go-offline
COPY src ./src
RUN ./mvnw -B -DskipTests package

FROM eclipse-temurin:21-jre AS runtime
WORKDIR /app
# sessoes.data_hora é LocalDateTime (wall-clock, sem zona) e o front envia a hora local do
# organizador direto do <input type="datetime-local">. Sem fixar o fuso, o LocalDateTime.now()
# do JVM roda em UTC na nuvem e rejeita como "no passado" qualquer horário nas próximas 3h.
ENV TZ=America/Sao_Paulo
# O container do plano free tem 512 MB. O default da JVM é heap = 25% da RAM (128 MB), o que sobra
# pouco pro que Spring Boot + Hibernate + Flyway precisam e leva a OOM kill no boot; 70% deixa
# margem pra metaspace e memória nativa. SerialGC porque com 0.1 CPU o paralelismo do G1 só custa.
# Como é ENV, uma variável de mesmo nome no Render sobrescreve isto sem exigir mudança de imagem.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70 -XX:+UseSerialGC"
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
