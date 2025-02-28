#!/bin/sh
# detect_changes.sh - 커밋 테스트2
echo "Detecting changed services..."
BASE_COMMIT="HEAD~1"
CHANGED_FILES=$(git diff --name-only "$BASE_COMMIT")

# 백엔드 서비스 목록 (공백으로 구분된 문자열)
BACKEND_SERVICES="auth-service lyrics-service playlist-service search-service translation-service"
# 프론트엔드 경로 (변경 시, 프론트엔드 서비스 이름은 별도로 'bravo-front'로 처리)
FRONTEND_PATH="Frontend/bravo-front/"
CHANGED_SERVICES_FILE="changed_services.txt"
rm -f "$CHANGED_SERVICES_FILE"

# 백엔드 변경 사항 감지 (수정 후: 서비스 이름에서 "-service" 접미어 제거)
for SERVICE in $BACKEND_SERVICES; do
  SERVICE_PATH="Backend/Image/$SERVICE/"
  if echo "$CHANGED_FILES" | grep -q "^$SERVICE_PATH"; then
    # 만약 SERVICE가 "search-service"처럼 끝난다면, "-service"를 제거하여 "search"로 만듭니다.
    BASE_NAME=${SERVICE%-service}
    echo "Detected changes in backend service: $SERVICE (using name: $BASE_NAME)"
    echo "backend:$BASE_NAME" >> "$CHANGED_SERVICES_FILE"
  fi
done

# 프론트엔드 변경 사항 감지
if echo "$CHANGED_FILES" | grep -q "^$FRONTEND_PATH"; then
  echo "Detected changes in frontend at $FRONTEND_PATH"
  # 프론트엔드 서비스 이름은 'bravo-front'로 고정
  echo "frontend:bravo-front" >> "$CHANGED_SERVICES_FILE"
fi

if [ -s "$CHANGED_SERVICES_FILE" ]; then
  echo "Services to build:"
  cat "$CHANGED_SERVICES_FILE"
else
  echo "No changes detected in service directories."
fi