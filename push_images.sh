#!/bin/bash

# 이미지 태깅
sudo docker tag itda-ui:4.1 192.168.2.140:443/frontend/itda-ui:4.1
sudo docker tag itda-search:4.1 192.168.2.140:443/backend/itda-search:4.1
sudo docker tag itda-lyrics:4.1 192.168.2.140:443/backend/itda-lyrics:4.1
sudo docker tag itda-auth:4.1 192.168.2.140:443/backend/itda-auth:4.1
sudo docker tag itda-playlist:4.1 192.168.2.140:443/backend/itda-playlist:4.1
sudo docker tag itda-translation:4.1 192.168.2.140:443/backend/itda-translation:4.1

# 이미지 푸시
sudo docker push 192.168.2.140:443/frontend/itda-ui:4.1
sudo docker push 192.168.2.140:443/backend/itda-search:4.1
sudo docker push 192.168.2.140:443/backend/itda-lyrics:4.1
sudo docker push 192.168.2.140:443/backend/itda-auth:4.1
sudo docker push 192.168.2.140:443/backend/itda-playlist:4.1
sudo docker push 192.168.2.140:443/backend/itda-translation:4.1

echo "모든 이미지 푸시 완료!"
docker images -q | xargs -r docker rmi -f
echo "모든 로컬 이미지 삭제 완료!"

