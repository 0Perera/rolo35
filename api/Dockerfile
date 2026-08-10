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
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
