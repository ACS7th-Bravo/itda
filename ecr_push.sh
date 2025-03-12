aws ecr get-login-password --region ap-northeast-2 | docker login --username AWS --password-stdin 655088038759.dkr.ecr.ap-northeast-2.amazonaws.com

# docker tag itda-ui:11.48 655088038759.dkr.ecr.ap-northeast-2.amazonaws.com/itda-ui:11.48

# docker push 655088038759.dkr.ecr.ap-northeast-2.amazonaws.com/itda-ui:11.48


docker tag itda-ui:11.48 655088038759.dkr.ecr.ap-northeast-2.amazonaws.com/itda-ui:11.48
docker tag itda-auth:11.48 655088038759.dkr.ecr.ap-northeast-2.amazonaws.com/itda-auth:11.48
docker tag itda-search:11.48 655088038759.dkr.ecr.ap-northeast-2.amazonaws.com/itda-search:11.48
docker tag itda-lyrics:11.48 655088038759.dkr.ecr.ap-northeast-2.amazonaws.com/itda-lyrics:11.48
docker tag itda-translation:11.48 655088038759.dkr.ecr.ap-northeast-2.amazonaws.com/itda-translation:11.48
docker tag itda-playlist:11.48 655088038759.dkr.ecr.ap-northeast-2.amazonaws.com/itda-playlist:11.48

docker push 655088038759.dkr.ecr.ap-northeast-2.amazonaws.com/itda-ui:11.48
docker push 655088038759.dkr.ecr.ap-northeast-2.amazonaws.com/itda-auth:11.48
docker push 655088038759.dkr.ecr.ap-northeast-2.amazonaws.com/itda-search:11.48
docker push 655088038759.dkr.ecr.ap-northeast-2.amazonaws.com/itda-lyrics:11.48
docker push 655088038759.dkr.ecr.ap-northeast-2.amazonaws.com/itda-translation:11.48
docker push 655088038759.dkr.ecr.ap-northeast-2.amazonaws.com/itda-playlist:11.48
