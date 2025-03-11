#!/bin/bash

# 이미지 태깅
sudo docker tag itda-ui:11.47 192.168.2.140:443/frontend/itda-ui:11.47
sudo docker tag itda-search:11.47 192.168.2.140:443/backend/itda-search:11.47
sudo docker tag itda-lyrics:11.47 192.168.2.140:443/backend/itda-lyrics:11.47
sudo docker tag itda-auth:11.47 192.168.2.140:443/backend/itda-auth:11.47
sudo docker tag itda-playlist:11.47 192.168.2.140:443/backend/itda-playlist:11.47
sudo docker tag itda-translation:11.47 192.168.2.140:443/backend/itda-translation:11.47

# 이미지 푸시
sudo docker push 192.168.2.140:443/frontend/itda-ui:11.47
sudo docker push 192.168.2.140:443/backend/itda-search:11.47
sudo docker push 192.168.2.140:443/backend/itda-lyrics:11.47
sudo docker push 192.168.2.140:443/backend/itda-auth:11.47
sudo docker push 192.168.2.140:443/backend/itda-playlist:11.47
sudo docker push 192.168.2.140:443/backend/itda-translation:11.47

echo "모든 이미지 푸시 완료!"
docker images -q | xargs -r docker rmi -f
echo "모든 로컬 이미지 삭제 완료!"

