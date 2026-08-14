FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# VITE_* é inlined no bundle em tempo de build: o navegador nunca lê variável de ambiente do
# container, então isto é ARG (build) e não ENV (runtime). O default é o endereço que a API expõe
# no docker-compose — quem publica em outro lugar passa --build-arg.
ARG VITE_API_URL=http://localhost:8080
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
