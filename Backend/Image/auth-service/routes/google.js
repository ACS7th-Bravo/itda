//Image/auth-service/routes/google.js
import express from 'express';
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import querystring from 'querystring';
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
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

const router = express.Router();
const client = new OAuth2Client(GOOGLE_CLIENT_ID);
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

// /**
//  * 구글 로그인 콜백 엔드포인트  
//  * 구글에서 받은 code를 이용하여 토큰을 받고, JWT를 발급하며, MongoDB에 사용자 정보를 저장합니다.
//  */
// router.get('/google-callback', async (req, res) => {
//   const { code } = req.query;
//   if (!code) return res.status(400).json({ error: "Google OAuth 코드가 없습니다." });

//   try {
//     // 토큰 교환 요청
//     const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
//       method: "POST",
//       headers: { "Content-Type": "application/x-www-form-urlencoded" },
//       body: new URLSearchParams({
//         code,
//         client_id: GOOGLE_CLIENT_ID,
//         client_secret: GOOGLE_CLIENT_SECRET,
//         redirect_uri: GOOGLE_REDIRECT_URI,
//         grant_type: "authorization_code",
//       }),
//     });
//     const tokens = await tokenResponse.json();
//     console.log("✅ Google OAuth Tokens:", tokens);

//     if (!tokens.access_token) {
//       throw new Error("Google OAuth 토큰 발급 실패: " + JSON.stringify(tokens));
//     }

//     // id_token 검증 및 페이로드 추출
//     const ticket = await client.verifyIdToken({
//       idToken: tokens.id_token,
//       audience: GOOGLE_CLIENT_ID,
//     });
//     const payload = ticket.getPayload();
//     const email = payload.email;

//     // MongoDB에서 사용자 검색 및 생성/갱신
//     let user = await User.findOne({ email });
//     let jwtToken;
//     let jwtPayload; // JWT에 포함할 데이터 2025.02.14 플레이리스트 추가가

//     if (!user) {
//       // 새로운 사용자라면 새로 생성 후 JWT 발급 (MongoDB가 자동으로 _id를 생성합니다) 2025.02.14 플레이리스트 추가가
//       jwtPayload = {
//         id: new mongoose.Types.ObjectId(), // 임시 id 생성 (나중에 user._id로 대체)
//         email,
//         name: payload.name,
//         picture: payload.picture,
//       };
//       jwtToken = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: "7d" });

//       user = new User({ email, name: payload.name, picture: payload.picture, jwtToken });
//       await user.save();
//       console.log("✅ 새 사용자 저장됨:", user);

//       // 실제 저장 후에는 user._id를 사용하여 JWT를 재발급합니다. 2025.02.14 플레이리스트 추가가
//       jwtPayload.id = user._id;
//       jwtToken = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: "7d" });
//       user.jwtToken = jwtToken;
//       await user.save();
//     } else {
//       // 기존 사용자인 경우, 기존 토큰이 있다면 재사용, 없거나 만료된 경우 새 토큰 발급
//       try {
//         if (user.jwtToken) {
//           // 기존 토큰 유효성 검증
//           jwt.verify(user.jwtToken, JWT_SECRET);
//           jwtToken = user.jwtToken;
//           console.log("✅ 기존 JWT 재사용:", jwtToken);
//         }
//       } catch (err) {
//         // 기존 토큰이 만료되었거나 유효하지 않다면 새 토큰 발급 2025.02.14 플레이리스트 추가가
//         jwtPayload = {
//           id: user._id,
//           email,
//           name: payload.name,
//           picture: payload.picture,
//         };
//         jwtToken = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: "7d" });
//         user.jwtToken = jwtToken;
//         await user.save();
//         console.log("✅ 새 JWT 발급 및 업데이트:", jwtToken);
//       }
//       console.log("✅ 기존 사용자 발견:", user);
//     }

//     // 프론트엔드로 리다이렉션 (쿼리 파라미터로 토큰 전달)
//     res.redirect(`${FRONTEND_URL}?token=${jwtToken}`);
//   } catch (error) {
//     console.error("❌ Google OAuth 로그인 실패:", error);
//     res.status(500).json({ error: "Google OAuth 로그인 실패", details: error.toString() });
//   }
// });

// /**
//  * JWT 검증 엔드포인트  
//  * 프론트엔드에서 사용자가 유효한 토큰을 가지고 있는지 확인할 때 호출합니다.
//  */
// router.get('/verify-token', (req, res) => {
//   const token = req.headers.authorization?.split(" ")[1];
//   if (!token) return res.status(401).json({ valid: false });

//   try {
//     const decoded = jwt.verify(token, JWT_SECRET);
//     res.json({ valid: true, user: decoded });
//   } catch (error) {
//     res.status(401).json({ valid: false });
//   }
// });

// export default router;


//DB안거치고 로그인하는 로직
// 구글 로그인 콜백 엔드포인트 (DB 연결 제거)
router.get('/google-callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: "Google OAuth 코드가 없습니다." });

  try {
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

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload.email;

    // MongoDB 관련 로직 제거하고 JWT만 생성
    let jwtToken;
    let jwtPayload = {
      id: "temp-id",  // DB 없이 작동하도록 임시 ID 사용
      email,
      name: payload.name,
      picture: payload.picture,
    };
    jwtToken = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: "7d" });

    console.log("✅ JWT 발급 완료:", jwtToken);
    res.redirect(`${FRONTEND_URL}?token=${jwtToken}`);
  } catch (error) {
    console.error("❌ Google OAuth 로그인 실패:", error);
    res.status(500).json({ error: "Google OAuth 로그인 실패", details: error.toString() });
  }
});

// JWT 검증 엔드포인트
router.get('/verify-token', (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ valid: false });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ valid: true, user: decoded });
  } catch (error) {
    res.status(401).json({ valid: false });
  }
});

export default router;
