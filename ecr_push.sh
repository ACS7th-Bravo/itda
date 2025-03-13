aws ecr get-login-password --region ap-northeast-2 | docker login --username AWS --password-stdin 655088038759.dkr.ecr.ap-northeast-2.amazonaws.com

# docker tag itda-ui:7.0 655088038759.dkr.ecr.ap-northeast-2.amazonaws.com/itda-ui:7.0

# docker push 655088038759.dkr.ecr.ap-northeast-2.amazonaws.com/itda-ui:7.0


docker tag itda-ui:7.0 655088038759.dkr.ecr.ap-northeast-2.amazonaws.com/itda-ui:7.0
docker tag itda-auth:7.0 655088038759.dkr.ecr.ap-northeast-2.amazonaws.com/itda-auth:7.0
docker tag itda-search:7.0 655088038759.dkr.ecr.ap-northeast-2.amazonaws.com/itda-search:7.0
docker tag itda-lyrics:7.0 655088038759.dkr.ecr.ap-northeast-2.amazonaws.com/itda-lyrics:7.0
docker tag itda-translation:7.0 655088038759.dkr.ecr.ap-northeast-2.amazonaws.com/itda-translation:7.0
docker tag itda-playlist:7.0 655088038759.dkr.ecr.ap-northeast-2.amazonaws.com/itda-playlist:7.0

docker push 655088038759.dkr.ecr.ap-northeast-2.amazonaws.com/itda-ui:7.0
docker push 655088038759.dkr.ecr.ap-northeast-2.amazonaws.com/itda-auth:7.0
docker push 655088038759.dkr.ecr.ap-northeast-2.amazonaws.com/itda-search:7.0
docker push 655088038759.dkr.ecr.ap-northeast-2.amazonaws.com/itda-lyrics:7.0
docker push 655088038759.dkr.ecr.ap-northeast-2.amazonaws.com/itda-translation:7.0
docker push 655088038759.dkr.ecr.ap-northeast-2.amazonaws.com/itda-playlist:7.0
