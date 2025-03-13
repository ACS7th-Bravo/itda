import AWS from 'aws-sdk';
import fs from 'fs';
import path from 'path';

// Secrets Manager에서 환경 변수 읽어오기 함수
function readSecret(secretName) {
  const secretPath = path.join('/mnt/secrets-store', secretName);
  try {
    return fs.readFileSync(secretPath, 'utf8').trim();
  } catch (err) {
    console.error(`Error reading secret ${secretName} from ${secretPath}:`, err);
    throw err;
  }
}

// DynamoDB 클라이언트 설정
const AWS_REGION_DYNAMODB = readSecret('aws_region_dynamodb');
const AWS_ACCESS_KEY_ID = readSecret('aws_access_key_id');
const AWS_SECRET_ACCESS_KEY = readSecret('aws_secret_access_key');
const DYNAMODB_TABLE_USERS = readSecret('dynamodb_table_users');

const dynamoDb = new AWS.DynamoDB.DocumentClient({
  region: AWS_REGION_DYNAMODB,
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
});

// 사용자 저장 (DynamoDB에 저장)
export class User {
  constructor(userData) {
    this.email = userData.email;
    this.name = userData.name;
    this.picture = userData.picture;
    this.jwtToken = userData.jwtToken;
    this.createdAt = userData.createdAt || new Date().toISOString();
  }

  // 사용자 저장 (DynamoDB에 저장)
  async save() {
    const params = {
      TableName: DYNAMODB_TABLE_USERS,
      Item: {
        email: this.email,
        name: this.name,
        picture: this.picture,
        jwtToken: this.jwtToken,
        createdAt: this.createdAt,
      },
    };
    try {
      console.log(`🔍 DynamoDB save 요청: ${this.email}`);
      await dynamoDb.put(params).promise();
      console.log(`✅ DynamoDB save 성공: ${this.email}`);
      return this;
    } catch (error) {
      console.error(`❌ DynamoDB save 실패: ${this.email}`, error);
      throw error;
    }
  }

  // 사용자 조회 (DynamoDB에서 조회)
  static async findOne(condition) {
    const params = {
      TableName: DYNAMODB_TABLE_USERS,
      Key: {
        email: condition.email,  // email을 Key로 사용
      },
    };
    try {
      const result = await dynamoDb.get(params).promise();
      return result.Item || null;  // Item이 없으면 null 반환
    } catch (error) {
      console.error('Error finding user in DynamoDB:', error);
      throw error;
    }
  }

  // 사용자 업데이트 (DynamoDB에서 업데이트)
  static async updateOne(condition, updateData) {
    const updateExpression = 'set jwtToken = :jwtToken';
    const expressionAttributeValues = {
      ':jwtToken': updateData.jwtToken,
    };
    const params = {
      TableName: DYNAMODB_TABLE_USERS,
      Key: {
        email: condition.email,  // email을 Key로 사용
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',  // 업데이트된 결과 반환
    };
    try {
      const result = await dynamoDb.update(params).promise();
      return result.Attributes;  // 반환된 속성들
    } catch (error) {
      console.error('Error updating user in DynamoDB:', error);
      throw error;
    }
  }
}
