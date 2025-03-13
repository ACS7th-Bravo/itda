//Image/search-service/models/Track.js
import AWS from 'aws-sdk';
import fs from 'fs';
import path from 'path'; ///기존 몽구스 삭제

function readSecret(secretName) {
    const secretPath = path.join('/mnt/secrets-store', secretName);
    try {
      return fs.readFileSync(secretPath, 'utf8').trim();
    } catch (err) {
      const envVarName = secretName.toUpperCase();
      if (process.env[envVarName]) {
        return process.env[envVarName];
      }
      throw err;
    }
  }
  

// **수정**: MongoDB 대신 DynamoDB DocumentClient 초기화
const dynamoDb = (() => {
    try {
      const region = process.env.AWS_REGION || 'ap-northeast-2';
      if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        return new AWS.DynamoDB.DocumentClient({
          region: region,
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        });
      }
      return new AWS.DynamoDB.DocumentClient({ region });
    } catch (error) {
      console.error('Error initializing DynamoDB client:', error);
      throw error;
    }
  })();

  // **수정**: DynamoDB 테이블 이름 사용
const DYNAMODB_TABLE_TRACKS = process.env.DYNAMODB_TABLE_TRACKS || 'dynamo_tracks';

function processDynamoDBItem(item) {
  if (!item) return null;
  const processedItem = { ...item };
  if (Array.isArray(processedItem.artist_id) && processedItem.artist_id.length > 0) {
    if (processedItem.artist_id[0].S) {
      processedItem.artist_id = processedItem.artist_id[0].S;
    }
  }
  if (Array.isArray(processedItem.artist_name) && processedItem.artist_name.length > 0) {
    if (processedItem.artist_name[0].S) {
      processedItem.artist_name = processedItem.artist_name[0].S;
    }
  }
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
        this.lyrics_translation = trackData.lyrics_translation;
        this.streaming_id = trackData.streaming_id;
      }
// const trackSchema = new mongoose.Schema({ 기존코드들, 기존 몽구스모듈 삭제로 코드가 많이 늘어남
//     track_id: { type: String, required: true, unique: true },
//     track_name: { type: String, required: true },
//     artist_id: { type: String, required: true },
//     artist_name: { type: String, required: true },
//     album_id: { type: String, required: true },
//     album_image: { type: String, required: true },
//     plain_lyrics: { type: String }, // 원본 가사를 문자열로 저장 (선택사항)
//     parsed_lyrics: { type: mongoose.Schema.Types.Mixed }, // 파싱된 가사 데이터를 자유롭게 저장 (예: 배열)
//     lyrics_translation: { type: String }, // 번역된 가사 (선택사항)
//     streaming_id: { type: String, required: true } // YouTube videoId 등
// });
// export const Track = mongoose.model('Track', trackSchema);

async save() {
    if (!this.album_id || this.album_id === 'unknown') {
      console.warn(`Track ${this.track_id} has album_id missing or unknown`);
    }
    if (!this.artist_id || this.artist_id === 'unknown') {
      console.warn(`Track ${this.track_id} has artist_id missing or unknown`);
    }
    if (typeof this.artist_id === 'string' && this.artist_id !== 'unknown') {
      this.artist_id = [{ "S": this.artist_id }];
    }
    if (typeof this.artist_name === 'string' && this.artist_name !== 'unknown') {
      this.artist_name = [{ "S": this.artist_name }];
    }
    const params = {
      TableName: DYNAMODB_TABLE_TRACKS,
      Item: this
    };
    try {
      console.log(`DynamoDB save request: ${this.track_id}`, JSON.stringify(params.Item).substring(0, 200) + '...');
      await dynamoDb.put(params).promise();
      console.log(`DynamoDB save success: ${this.track_id}`);
      return this;
    } catch (error) {
      console.error(`DynamoDB save failed: ${this.track_id}`, error);
      throw error;
    }
  }

  static async findOne(condition) {
    if (!condition.track_id) {
      throw new Error('track_id is required for findOne operation');
    }
    const params = {
      TableName: DYNAMODB_TABLE_TRACKS,
      Key: { track_id: condition.track_id }
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
      ExpressionAttributeValues: { ':artistId': artistId }
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
    const expressionAttributeValues = { ':updatedAt': new Date().toISOString() };
    Object.entries(updateData).forEach(([key, value]) => {
      if (key !== 'track_id') {
        updateExpression += `, ${key} = :${key}`;
        expressionAttributeValues[`:${key}`] = value;
      }
    });
    const params = {
      TableName: DYNAMODB_TABLE_TRACKS,
      Key: { track_id: condition.track_id },
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