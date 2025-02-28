#!/bin/bash
# detect_changes.sh - 커밋 테스트

echo "Detecting changed services..."

# 기준 커밋 설정 (필요에 따라 CI 시스템에서 제공하는 값을 사용할 수 있습니다)
BASE_COMMIT="HEAD~1"

# 변경된 파일 목록 가져오기
CHANGED_FILES=$(git diff --name-only "$BASE_COMMIT")

# 서비스 목록 (백엔드)
BACKEND_SERVICES=("auth-service" "lyrics-service" "playlist-service" "search-service" "translation-service")

# 프론트엔드 경로 (예시로 Frontend/bravo-front 사용)
FRONTEND_PATH="Frontend/bravo-front/"

# 결과를 저장할 파일
CHANGED_SERVICES_FILE="changed_services.txt"

# 기존 결과 파일 삭제
rm -f "$CHANGED_SERVICES_FILE"

# 백엔드 변경 사항 감지
for SERVICE in "${BACKEND_SERVICES[@]}"; do
  SERVICE_PATH="Backend/Image/$SERVICE/"
  if echo "$CHANGED_FILES" | grep -q "^$SERVICE_PATH"; then
    echo "Detected changes in backend service: $SERVICE"
    echo "backend:$SERVICE_PATH" >> "$CHANGED_SERVICES_FILE"
  fi
done

# 프론트엔드 변경 사항 감지
if echo "$CHANGED_FILES" | grep -q "^$FRONTEND_PATH"; then
  echo "Detected changes in frontend at $FRONTEND_PATH"
  echo "frontend:$FRONTEND_PATH" >> "$CHANGED_SERVICES_FILE"
fi

if [ -s "$CHANGED_SERVICES_FILE" ]; then
  echo "Services to build:"
  cat "$CHANGED_SERVICES_FILE"
else
  echo "No changes detected in service directories."
fi