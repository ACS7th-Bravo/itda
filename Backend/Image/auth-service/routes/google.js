import express from 'express';
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import querystring from 'querystring';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import AWS from 'aws-sdk';  // Import AWS SDK here
import { User } from '../models/User.js';

// secrets 파일에서 값을 읽어오는 함수
function readSecret(secretName) {
  const secretPath = path.join('/mnt/secrets-store', secretName);
  try {
    return fs.readFileSync(secretPath, 'utf8').trim();
  } catch (err) {
    console.error(`Error reading secret ${secretName} from ${secretPath}:`, err);
    throw err;
  }
}

const GOOGLE_CLIENT_ID = readSecret('google_client_id');
const GOOGLE_CLIENT_SECRET = readSecret('google_client_secret');
const GOOGLE_REDIRECT_URI = readSecret('google_redirect_uri');
const JWT_SECRET = readSecret('jwt_secret');
const FRONTEND_URL = readSecret('frontend_url');
const DYNAMODB_TABLE_USERS = readSecret('dynamodb_table_users');
const AWS_ACCESS_KEY_ID = readSecret('aws_access_key_id');
const AWS_SECRET_ACCESS_KEY = readSecret('aws_secret_access_key');
const AWS_REGION_DYNAMODB = readSecret('aws_region_dynamodb');

const router = express.Router();
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

const dynamoDb = new AWS.DynamoDB.DocumentClient({
  region: AWS_REGION_DYNAMODB,
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
});

/**
 * 구글 로그인 엔드포인트
 * 클라이언트를 구글 로그인 페이지로 리다이렉트합니다.
 */
router.get('/google-login', (req, res) => {
  const authUrl = `https://accounts.google.com/o/oauth2/auth?${querystring.stringify({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
  })}`;
  res.redirect(authUrl);
});

/**
 * 구글 로그인 콜백 엔드포인트
 * 구글에서 받은 code를 이용하여 토큰을 받고, JWT를 발급하며, DynamoDB에 사용자 정보를 저장합니다.
 */
router.get('/google-callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: "Google OAuth 코드가 없습니다." });

  try {
    // 토큰 교환 요청
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenResponse.json();
    console.log("✅ Google OAuth Tokens:", tokens);

    if (!tokens.access_token) {
      throw new Error("Google OAuth 토큰 발급 실패: " + JSON.stringify(tokens));
    }

    // id_token 검증 및 페이로드 추출
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload.email;

    // DynamoDB에서 사용자 검색 및 생성/갱신
    let user = await User.findOne({ email });
    let jwtToken;
    let jwtPayload;

    if (!user) {
      // 새로운 사용자라면 새로 생성 후 JWT 발급
      jwtPayload = {
        email,
        name: payload.name,
        picture: payload.picture,
      };
      jwtToken = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: "7d" });

      // DynamoDB에 사용자 정보 저장
      const params = {
        TableName: DYNAMODB_TABLE_USERS,
        Item: {
          email: email,
          name: payload.name,
          picture: payload.picture,
          jwtToken: jwtToken,
        },
      };

      // DynamoDB에 새 사용자 저장
      await dynamoDb.put(params).promise();
      console.log("✅ 새 사용자 저장됨:", params.Item);

      // JWT 토큰 재발급
      jwtPayload.id = email;  // email을 사용하여 id로 설정
      jwtToken = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: "7d" });
      const updateParams = {
        TableName: DYNAMODB_TABLE_USERS,
        Key: { email: email },
        UpdateExpression: "SET jwtToken = :jwtToken",
        ExpressionAttributeValues: {
          ":jwtToken": jwtToken,
        },
      };
      await dynamoDb.update(updateParams).promise();
    } else {
      // 기존 사용자인 경우 JWT 갱신
      try {
        if (user.jwtToken) {
          jwt.verify(user.jwtToken, JWT_SECRET);
          jwtToken = user.jwtToken;
          console.log("✅ 기존 JWT 재사용:", jwtToken);
        }
      } catch (err) {
        jwtPayload = {
          id: user.email,
          email,
          name: payload.name,
          picture: payload.picture,
        };
        jwtToken = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: "7d" });
        const params = {
          TableName: DYNAMODB_TABLE_USERS,
          Key: { email: user.email },
          UpdateExpression: "SET jwtToken = :jwtToken",
          ExpressionAttributeValues: {
            ":jwtToken": jwtToken,
          },
        };
        await dynamoDb.update(params).promise();
        console.log("✅ 새 JWT 발급 및 업데이트:", jwtToken);
      }
    }

    // 프론트엔드로 리다이렉션 (쿼리 파라미터로 토큰 전달)
    res.redirect(`${FRONTEND_URL}?token=${jwtToken}`);
  } catch (error) {
    console.error("❌ Google OAuth 로그인 실패:", error);
    res.status(500).json({ error: "Google OAuth 로그인 실패", details: error.toString() });
  }
});

export default router;
