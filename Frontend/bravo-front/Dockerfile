#frontend Dockerfile

FROM node:22-alpine

WORKDIR /app

# 빌드 인수 선언
ARG VITE_FRONTEND_PORT
ARG VITE_AUTH_API_URL
ARG VITE_SEARCH_API_URL
ARG VITE_LYRICS_API_URL
ARG VITE_TRANSLATION_API_URL
ARG VITE_PLAYLIST_API_URL

# 필요에 따라, 빌드 시 .env 파일을 생성하여 vite가 빌드시점에 해당 값을 로드하도록 할 수도 있습니다.
RUN echo "VITE_FRONTEND_PORT=${VITE_FRONTEND_PORT}" > .env.production && \
    echo "VITE_AUTH_API_URL=${VITE_AUTH_API_URL}" >> .env.production && \
    echo "VITE_SEARCH_API_URL=${VITE_SEARCH_API_URL}" >> .env.production && \
    echo "VITE_LYRICS_API_URL=${VITE_LYRICS_API_URL}" >> .env.production && \
    echo "VITE_TRANSLATION_API_URL=${VITE_TRANSLATION_API_URL}" >> .env.production && \
    echo "VITE_PLAYLIST_API_URL=${VITE_PLAYLIST_API_URL}" >> .env.production

# package.json, package-lock.json 복사 및 의존성 설치
COPY package*.json ./
RUN npm install

# Vite 실행 파일에 실행 권한 부여
RUN chmod +x ./node_modules/.bin/vite

# 소스 코드 복사 (필요한 파일들이 .dockerignore에 누락되지 않았는지 확인)
COPY . .

# 기존 빌드 캐시 삭제 (옵션)
RUN rm -rf node_modules/.vite

EXPOSE ${VITE_FRONTEND_PORT}

CMD ["npm", "run", "dev", "--", "--host"]