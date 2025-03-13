//Image/playlist-service/routes/playlist.js

import express from 'express';
import { Playlist } from '../models/Playlist.js'; // 이 부분은 수정하지 않음
import AWS from 'aws-sdk'; // DynamoDB 클라이언트 추가
import fs from 'fs';
import path from 'path';

// express.Router()로 router 정의
const router = express.Router(); 

// 🔹 AWS Secrets Manager에서 환경 변수 읽는 함수
function readSecret(secretName) {
  const secretPath = path.join('/mnt/secrets-store', secretName);
  try {
    return fs.readFileSync(secretPath, 'utf8').trim();
  } catch (err) {
    console.error(`❌ Error reading secret ${secretName} from ${secretPath}:`, err);
    throw err;
  }
}

// 🔹 DynamoDB 설정
const AWS_REGION_DYNAMODB = readSecret('aws_region_dynamodb');
const AWS_ACCESS_KEY_ID = readSecret('aws_access_key_id');
const AWS_SECRET_ACCESS_KEY = readSecret('aws_secret_access_key');
const DYNAMODB_TABLE_PLAYLISTS = readSecret('dynamodb_table_playlists'); // DynamoDB 테이블 이름
const DYNAMODB_TABLE_USERS = readSecret('dynamodb_table_users'); // DynamoDB 유저 테이블 이름 (추가)
const dynamoDb = new AWS.DynamoDB.DocumentClient({
  region: AWS_REGION_DYNAMODB,
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
});

// POST 요청을 통한 플레이리스트 그룹 생성
router.post('/', async (req, res) => {
  try {
    const { email, name, tracks } = req.body;
    if (!email || !name) {
      return res.status(400).json({ error: 'email과 name은 필수입니다.' });
    }

    // _id 생성: 이메일과 타임스탬프 결합
    const _id = `${email}_${Date.now()}`;

    // DynamoDB에서 기존 플레이리스트 확인
    const params = {
      TableName: DYNAMODB_TABLE_PLAYLISTS,
      Key: { _id  },  // email과 name을 기준으로 중복 확인
    };

    // 기존 플레이리스트가 있는지 확인
    const existingPlaylist = await dynamoDb.get(params).promise();
    if (existingPlaylist.Item) {
      return res.status(400).json({ error: '이미 해당 이름의 플레이리스트가 존재합니다.' });
    }

    // 새 플레이리스트를 DynamoDB에 저장
    const newPlaylist = {
      TableName: DYNAMODB_TABLE_PLAYLISTS,
      Item: {
        _id,  // _id는 이메일과 타임스탬프를 결합하여 생성
        email,
        name,
        tracks,
        visible: true, // 기본값 true
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };

    await dynamoDb.put(newPlaylist).promise(); // DynamoDB에 저장
    console.log(`✅ 새 플레이리스트 생성됨: ${name} - ${email}`); // 로그 찍기

    res.status(201).json(newPlaylist.Item);
  } catch (error) {
    console.error('플레이리스트 생성 실패:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET 요청: 플레이리스트 조회
router.get('/', async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ error: 'User ID는 필수입니다.' });
    }

    // DynamoDB에서 플레이리스트 조회
    const params = {
      TableName: DYNAMODB_TABLE_PLAYLISTS,
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': user_id,
      },
    };

    const result = await dynamoDb.query(params).promise();
    console.log(`✅ 플레이리스트 조회: ${user_id}의 플레이리스트들`); // 로그 찍기

    res.status(200).json(result.Items); // 플레이리스트 반환
  } catch (error) {
    console.error('플레이리스트 조회 실패:', error);
    res.status(500).json({ error: error.message });
  }
});

// 단일 플레이리스트 상세 정보 조회
router.get('/:playlistId', async (req, res) => {
  try {
    const { playlistId } = req.params; // URL 파라미터로부터 playlistId 추출
    const params = {
      TableName: DYNAMODB_TABLE_PLAYLISTS,
      Key: { _id: playlistId },  // DynamoDB의 _id로 조회
    };

    const data = await dynamoDb.get(params).promise();
    if (!data.Item) {
      return res.status(404).json({ error: '플레이리스트를 찾을 수 없습니다.' });
    }

    console.log(`✅ 플레이리스트 상세 정보 조회: ${playlistId}`); // 로그 찍기
    res.status(200).json(data.Item); // 플레이리스트 반환
  } catch (error) {
    console.error('플레이리스트 상세 정보 조회 실패:', error);
    res.status(500).json({ error: error.message });
  }
});


// 업데이트 요청 (기존 플레이리스트에 트랙 추가)
router.patch('/:playlistId', async (req, res) => {
  try {
    const { playlistId } = req.params;
    const { tracksToAdd } = req.body;
    if (!tracksToAdd || !Array.isArray(tracksToAdd)) {
      return res.status(400).json({ error: 'tracksToAdd 배열이 필요합니다.' });
    }

    const params = {
      TableName: DYNAMODB_TABLE_PLAYLISTS,
      Key: { _id: playlistId },
      UpdateExpression: 'SET tracks = list_append(tracks, :tracksToAdd)',
      ExpressionAttributeValues: {
        ':tracksToAdd': tracksToAdd,
      },
      ReturnValues: 'ALL_NEW',
    };

    const result = await dynamoDb.update(params).promise();
    console.log(`✅ 플레이리스트 업데이트: ${playlistId}에 트랙 추가`); // 로그 찍기

    res.status(200).json(result.Attributes); // 업데이트된 플레이리스트 반환
  } catch (error) {
    console.error('플레이리스트 업데이트 실패:', error);
    res.status(500).json({ error: error.message });
  }
});

// === NEW ADDITIONS START: 플레이리스트 제목 변경 엔드포인트 ===
router.patch('/:playlistId/title', async (req, res) => {
  try {
    const { playlistId } = req.params;
    const { newTitle } = req.body;
    if (!newTitle) {
      return res.status(400).json({ error: 'newTitle 필드가 필요합니다.' });
    }

    // DynamoDB에서 플레이리스트 제목 업데이트
    const params = {
      TableName: DYNAMODB_TABLE_PLAYLISTS,
      Key: { _id: playlistId },
      UpdateExpression: 'SET #name = :newTitle, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#name': 'name',
      },
      ExpressionAttributeValues: {
        ':newTitle': newTitle,
        ':updatedAt': new Date().toISOString(),
      },
      ReturnValues: 'ALL_NEW',
    };

    const result = await dynamoDb.update(params).promise();
    console.log(`✅ 플레이리스트 제목 변경됨: ${playlistId}`); // 로그 찍기
    res.status(200).json(result.Attributes); // 업데이트된 플레이리스트 반환
  } catch (error) {
    console.error('플레이리스트 제목 변경 실패:', error);
    res.status(500).json({ error: error.message });
  }
});
// === NEW ADDITIONS END ===

// 플레이리스트 삭제
router.delete('/:playlistId', async (req, res) => {
  try {
    const { playlistId } = req.params;
    const params = {
      TableName: DYNAMODB_TABLE_PLAYLISTS,
      Key: { _id: playlistId },
    };

    const result = await dynamoDb.delete(params).promise();
    console.log(`✅ 플레이리스트 삭제됨: ${playlistId}`); // 로그 찍기

    res.status(200).json({ message: '플레이리스트 삭제됨' });
  } catch (error) {
    console.error('플레이리스트 삭제 실패:', error);
    res.status(500).json({ error: error.message });
  }
});

// === NEW ADDITIONS START: 플레이리스트 내 특정 트랙 삭제 엔드포인트 ===
router.patch('/:playlistId/remove-track', async (req, res) => {
  try {
    const { playlistId } = req.params;
    const { trackId } = req.body;
    if (!trackId) {
      return res.status(400).json({ error: 'trackId is required' });
    }

    const params = {
      TableName: DYNAMODB_TABLE_PLAYLISTS,
      Key: { _id: playlistId },
      UpdateExpression: 'REMOVE tracks.#trackId',
      ExpressionAttributeNames: {
        '#trackId': trackId, // 트랙 ID를 사용하는 필드명 지정
      },
      ReturnValues: 'ALL_NEW',
    };

    const result = await dynamoDb.update(params).promise();
    console.log(`✅ 트랙 삭제됨: ${playlistId}에서 ${trackId}`); // 로그 찍기
    res.status(200).json(result.Attributes); // 삭제된 후 업데이트된 플레이리스트 반환
  } catch (error) {
    console.error('트랙 삭제 실패:', error);
    res.status(500).json({ error: error.message });
  }
});

// === NEW ADDITIONS END ===


// === NEW ADDITIONS START: 공유 API 엔드포인트 수정 (디버깅 로그 추가) ===
router.post('/share', async (req, res) => {
  try {
    let { originalPlaylistId, recipientEmail } = req.body;
    if (!originalPlaylistId || !recipientEmail) {
      return res.status(400).json({ error: 'originalPlaylistId와 recipientEmail은 필수입니다.' });
    }

    // recipientEmail을 정규화 (공백 제거, 소문자 변환)
    recipientEmail = recipientEmail.trim().toLowerCase();
    console.log("[공유 API] 정규화된 recipientEmail:", recipientEmail); // 디버깅 로그

    // 수신자 이메일에 해당하는 유저 검사 (dynamo_users 테이블 확인)
    const userParams = {
      TableName: DYNAMODB_TABLE_USERS,  // 사용자 정보를 저장하는 테이블
      Key: { email: recipientEmail },  // 이메일로 유저를 조회
    };

    const userData = await dynamoDb.get(userParams).promise();
    if (!userData.Item) {
      return res.status(404).json({ error: '수신자가 존재하지 않는 유저입니다.' });
    }
    console.log("[공유 API] 조회된 recipientUser:", userData.Item); // 디버깅 로그

    const params = {
      TableName: DYNAMODB_TABLE_PLAYLISTS,
      Key: { _id: originalPlaylistId },
    };

    const originalPlaylistData = await dynamoDb.get(params).promise();
    if (!originalPlaylistData.Item) {
      return res.status(404).json({ error: '원본 플레이리스트를 찾을 수 없습니다.' });
    }

    const originalPlaylist = originalPlaylistData.Item;

    // _id를 recipientEmail + timestamp로 설정
    const sharedPlaylistId = recipientEmail + '_' + Date.now();
    const sharedPlaylist = {
      _id: sharedPlaylistId,
      email: recipientEmail,
      name: `${originalPlaylist.name} (공유됨)`,
      tracks: originalPlaylist.tracks,
      visible: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const putParams = {
      TableName: DYNAMODB_TABLE_PLAYLISTS,
      Item: sharedPlaylist,
    };

    await dynamoDb.put(putParams).promise();
    res.status(201).json(sharedPlaylist);
  } catch (error) {
    console.error('플레이리스트 공유 실패:', error);
    res.status(500).json({ error: error.message });
  }
});
// === NEW ADDITIONS END ===




export default router;