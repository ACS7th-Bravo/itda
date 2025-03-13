import AWS from 'aws-sdk';
import fs from 'fs';
import path from 'path';

// Secrets Manager에서 환경 변수 읽어오기 함수 (환경변수 시도 절대 하지 않음)
function readSecret(secretName) {
  const secretPath = path.join('/mnt/secrets-store', secretName);
  try {
    return fs.readFileSync(secretPath, 'utf8').trim();
  } catch (err) {
    console.error(`❌ Error reading secret ${secretName} from ${secretPath}:`, err);
    throw err;
  }
}

// 🔹 시크릿 값들을 한 곳에서 읽어서 상수로 선언 (환경변수 사용 없이)
const SPOTIFY_CLIENT_ID = readSecret('spotify_client_id');
const SPOTIFY_CLIENT_SECRET = readSecret('spotify_client_secret');
const YOUTUBE_API_KEYS = readSecret('youtube_api_keys');
const REDIS_URL = readSecret('redis_url');
const AWS_REGION_DYNAMODB = readSecret('aws_region_dynamodb');
const AWS_ACCESS_KEY_ID = readSecret('aws_access_key_id');
const AWS_SECRET_ACCESS_KEY = readSecret('aws_secret_access_key');
const DYNAMODB_TABLE_TRACKS = readSecret('dynamodb_table_tracks');

// AWS SDK 설정
const dynamoDb = (() => {
  try {
    const region = AWS_REGION_DYNAMODB || 'ap-northeast-2';
    return new AWS.DynamoDB.DocumentClient({
      region: region,
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY
    });
  } catch (error) {
    console.error('Error initializing DynamoDB client:', error);
    throw error;
  }
})();

// DynamoDB 특수 형식 처리 함수
function processDynamoDBItem(item) {
  if (!item) return null;
  const processedItem = { ...item };
  // artist_id 처리
  if (Array.isArray(processedItem.artist_id) && processedItem.artist_id.length > 0) {
    if (processedItem.artist_id[0].S) {
      processedItem.artist_id = processedItem.artist_id[0].S;
    }
  }
  // artist_name 처리
  if (Array.isArray(processedItem.artist_name) && processedItem.artist_name.length > 0) {
    if (processedItem.artist_name[0].S) {
      processedItem.artist_name = processedItem.artist_name[0].S;
    }
  }
  // parsed_lyrics 처리
  if (Array.isArray(processedItem.parsed_lyrics) && processedItem.parsed_lyrics.length > 0) {
    try {
      processedItem.parsed_lyrics = processedItem.parsed_lyrics.map(item => {
        if (item.S) {
          return JSON.parse(item.S.replace(/'/g, '"'));
        }
        return item;
      });
    } catch (error) {
      console.error('Error parsing lyrics:', error);
    }
  }
  return processedItem;
}

export class Track {
  constructor(trackData) {
    this.track_id = trackData.track_id;
    this.track_name = trackData.track_name;
    this.artist_id = trackData.artist_id;
    this.artist_name = trackData.artist_name;
    this.album_id = trackData.album_id;
    this.album_image = trackData.album_image;
    this.plain_lyrics = trackData.plain_lyrics;
    this.parsed_lyrics = trackData.parsed_lyrics;
    this.lyrics_translation = trackData.lyrics_translation || trackData.translated_lyrics;
    this.streaming_id = trackData.streaming_id;
    this.createdAt = trackData.createdAt || new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }

  // [변경] DynamoDB put 요청으로 저장
  async save() {
    if (!this.album_id || this.album_id === 'unknown') {
      console.warn(`⚠️ 트랙 ${this.track_id}에 album_id가 없거나 unknown입니다`);
    }
    if (!this.artist_id || this.artist_id === 'unknown') {
      console.warn(`⚠️ 트랙 ${this.track_id}에 artist_id가 없거나 unknown입니다`);
    }
    if (typeof this.artist_id === 'string' && this.artist_id !== 'unknown') {
      console.log(`🔄 artist_id 문자열을 배열로 변환: ${this.artist_id}`);
      this.artist_id = [{ "S": this.artist_id }];
    }
    if (typeof this.artist_name === 'string' && this.artist_name !== 'unknown') {
      console.log(`🔄 artist_name 문자열을 배열로 변환: ${this.artist_name}`);
      this.artist_name = [{ "S": this.artist_name }];
    }
    const params = {
      TableName: DYNAMODB_TABLE_TRACKS,
      Item: this
    };
    try {
      console.log(`🔍 DynamoDB save 요청: ${this.track_id}`, JSON.stringify(params.Item).substring(0, 200) + '...');
      await dynamoDb.put(params).promise();
      console.log(`✅ DynamoDB save 성공: ${this.track_id}`);
      return this;
    } catch (error) {
      console.error(`❌ DynamoDB save 실패: ${this.track_id}`, error);
      throw error;
    }
  }

  static async findOne(condition) {
    if (!condition.track_id) {
      throw new Error('track_id is required for findOne operation');
    }
    const params = {
      TableName: DYNAMODB_TABLE_TRACKS,
      Key: {
        track_id: condition.track_id
      }
    };
    try {
      const result = await dynamoDb.get(params).promise();
      return processDynamoDBItem(result.Item);
    } catch (error) {
      console.error('Error finding track in DynamoDB:', error);
      throw error;
    }
  }

  static async findByArtist(artistId) {
    const params = {
      TableName: DYNAMODB_TABLE_TRACKS,
      FilterExpression: 'contains(artist_id, :artistId)',
      ExpressionAttributeValues: {
        ':artistId': artistId
      }
    };
    try {
      const result = await dynamoDb.scan(params).promise();
      return result.Items.map(item => processDynamoDBItem(item));
    } catch (error) {
      console.error('Error querying tracks by artist_id:', error);
      throw error;
    }
  }

  static async updateOne(condition, updateData) {
    if (!condition.track_id) {
      throw new Error('track_id is required for update operation');
    }
    let updateExpression = 'set updatedAt = :updatedAt';
    const expressionAttributeValues = {
      ':updatedAt': new Date().toISOString()
    };
    Object.entries(updateData).forEach(([key, value]) => {
      if (key !== 'track_id') {
        updateExpression += `, ${key} = :${key}`;
        expressionAttributeValues[`:${key}`] = value;
      }
    });
    const params = {
      TableName: DYNAMODB_TABLE_TRACKS,
      Key: {
        track_id: condition.track_id
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    };
    try {
      const result = await dynamoDb.update(params).promise();
      return processDynamoDBItem(result.Attributes);
    } catch (error) {
      console.error('Error updating track in DynamoDB:', error);
      throw error;
    }
  }
}
