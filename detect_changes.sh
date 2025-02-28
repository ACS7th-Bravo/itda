#!/bin/sh
# detect_changes.sh - 커밋 테스트2
echo "Detecting changed services..."
BASE_COMMIT="HEAD~1"
CHANGED_FILES=$(git diff --name-only "$BASE_COMMIT")
# 백엔드 서비스 목록을 공백으로 구분된 문자열로 설정
BACKEND_SERVICES="auth-service lyrics-service playlist-service search-service translation-service"
FRONTEND_PATH="Frontend/bravo-front/"
CHANGED_SERVICES_FILE="changed_services.txt"
rm -f "$CHANGED_SERVICES_FILE"

# 백엔드 변경 사항 감지
for SERVICE in $BACKEND_SERVICES; do
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