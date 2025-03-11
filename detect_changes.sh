#!/bin/sh
# detect_changes.sh
echo "Detecting changed services..."

# 비교 범위를 명시적으로 HEAD~1과 HEAD로 지정
BASE_COMMIT="HEAD~1"
CHANGED_FILES=$(git diff --name-only "$BASE_COMMIT" HEAD)

echo "Changed files:"
echo "$CHANGED_FILES"

# 백엔드 서비스 목록 (공백으로 구분된 문자열)
BACKEND_SERVICES="auth-service lyrics-service playlist-service search-service translation-service"
# 프런트엔드 경로 (변경 시, 프런트엔드 서비스 이름은 'bravo-front'로 고정)
FRONTEND_PATH="Frontend/bravo-front/"
CHANGED_SERVICES_FILE="changed_services.txt"
rm -f "$CHANGED_SERVICES_FILE"

# 백엔드 변경 사항 감지: 서비스 이름만 출력
for SERVICE in $BACKEND_SERVICES; do
  SERVICE_PATH="Backend/Image/$SERVICE/"
  if echo "$CHANGED_FILES" | grep -q "^$SERVICE_PATH"; then
    echo "Detected changes in backend service: $SERVICE"
    echo "backend:$SERVICE" >> "$CHANGED_SERVICES_FILE"
  fi
done

# 프런트엔드 변경 사항 감지
if echo "$CHANGED_FILES" | grep -q "^$FRONTEND_PATH"; then
  echo "Detected changes in frontend at $FRONTEND_PATH"
  # 프런트엔드 서비스 이름은 'bravo-front'로 고정
  echo "frontend:bravo-front" >> "$CHANGED_SERVICES_FILE"
fi

if [ -s "$CHANGED_SERVICES_FILE" ]; then
  echo "Services to build:"
  cat "$CHANGED_SERVICES_FILE"
else
  echo "No changes detected in service directories."
fi