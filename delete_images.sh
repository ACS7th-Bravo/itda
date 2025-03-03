#!/bin/bash
# 모든 Docker 이미지를 강제로 삭제하는 스크립트

# 이미지 ID만 추출하여 삭제
docker images -q | xargs -r docker rmi -f

