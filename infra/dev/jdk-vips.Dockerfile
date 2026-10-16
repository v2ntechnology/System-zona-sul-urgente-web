# JDK 25 + libvips (BE-012) para rodar a API e os testes do backend localmente via Docker.
# Build: docker build -t zsu-jdk-vips -f infra/dev/jdk-vips.Dockerfile infra/dev
FROM eclipse-temurin:25-jdk
RUN apt-get update \
    && apt-get install -y --no-install-recommends libvips42t64 libheif-plugin-aomenc libheif-plugin-libde265 \
    && rm -rf /var/lib/apt/lists/*
