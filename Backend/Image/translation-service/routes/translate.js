// bravo-back/routes/translate.js

import express from 'express';
import { TranslateClient, TranslateTextCommand } from "@aws-sdk/client-translate";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { performance } from "perf_hooks";
import { encode } from "gpt-3-encoder"; // 토큰 수 계산 라이브러리
import fs from 'fs';
import path from 'path';
import AWS from 'aws-sdk';  // CHANGE: DynamoDB DocumentClient 사용
import { createClient } from 'redis'; // Redis 클라이언트 import


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


// ✅ AWS Secrets Manager에서 필요한 환경 변수 불러오기
const AWS_REGION = readSecret('aws_region');
const AWS_REGION_DYNAMODB = readSecret('aws_region_dynamodb');
const DYNAMODB_TABLE_TRACKS = readSecret('dynamo_table_tracks');
const AWS_ACCESS_KEY_ID = readSecret('aws_access_key_id');
const AWS_SECRET_ACCESS_KEY = readSecret('aws_secret_access_key');
const INFERENCE_PROFILE_ARN = readSecret('inference_profile_arn');
const REDIS_URL = readSecret('redis_url');

const dynamoDb = new AWS.DynamoDB.DocumentClient({
  region: AWS_REGION_DYNAMODB,
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
});

// AWS Bedrock Client 설정 (region은 env에 있는 값 그대로 사용)
const client = new BedrockRuntimeClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

// AWS Translate Client 생성
const translateClient = new TranslateClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

// Redis 클라이언트 설정
const redisClient = createClient({ url: REDIS_URL });
redisClient.on('error', err => console.error('Redis Client Error', err));
await redisClient.connect();


// 한글 포함 여부 확인 함수
function containsKorean(text) {
  return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(text);
}


/**
 * AWS Translate를 이용해 가사를 한국어로 번역합니다.
 * (Papago 대신 Amazon Translate 사용)
 * @param {string} originalLyrics - 원문 가사
 * @returns {Promise<string|null>} - 번역된 한국어 텍스트 또는 null
 */
async function translateWithAmazon(originalLyrics) {
  console.log("🔄 Amazon Translate를 사용하여 1차 번역 진행 중...");
  const startTime = performance.now();
  try {
    const command = new TranslateTextCommand({
      SourceLanguageCode: "auto", // 원문 언어 자동 감지
      TargetLanguageCode: "ko",   // 대상 언어 (한국어)
      Text: originalLyrics,
    });
    const response = await translateClient.send(command);

    // 만약 감지된 원본 언어가 한국어라면 번역 생략
    if (response.SourceLanguageCode && response.SourceLanguageCode === "ko") {
      console.log("감지된 원본 언어가 한국어입니다. 번역을 건너뜁니다.");
      return originalLyrics;
    }

    const translatedText = response.TranslatedText;
    // 번역 결과에 한글이 포함되어 있지 않으면 무시
    if (!translatedText || !containsKorean(translatedText)) {
      console.error("❌ Amazon Translate 결과에 한글이 포함되어 있지 않습니다.");
      return null;
    }
    // 토큰 수 계산 (디버그용)
    const inputTokens = encode(originalLyrics);
    const outputTokens = encode(translatedText);
    console.log(`🔢 Amazon Translate 입력 토큰 수: ${inputTokens.length}`);
    console.log(`🔢 Amazon Translate 출력 토큰 수: ${outputTokens.length}`);
    const endTime = performance.now();
    console.log(`✅ Amazon Translate 번역 성공 (소요 시간: ${(endTime - startTime).toFixed(2)}ms)`);
    console.log("✅ Amazon Translate 결과 (한국어):");
    console.log(translatedText);
    return translatedText;
  } catch (error) {
    console.error("❌ Amazon Translate 중 오류 발생:", error);
    return null;
  }
}

/**
 * Claude 3.5 Sonnet을 이용해 번역 품질 개선 (한국어 → 한국어 품질 개선)
 * (여기서는 Amazon Translate 결과를 기반으로 보정)
 */
async function refineTranslation(amazonTranslation) {
  console.log("🔄 Claude 3.5 Sonnet에서 번역 품질 개선 진행 중...");
  const startTime = performance.now();
  if (!amazonTranslation || amazonTranslation.trim().length === 0) {
    console.error("❌ Amazon Translate 결과가 없습니다. Claude에게 원문을 전달하지 않습니다.");
    return null;
  }
  const systemPrompt = `
This request is for academic and personal study purposes only.
Please polish the following Korean text for better fluency and natural tone while preserving its intended meaning, rhythm, and style.
Note: Do not reproduce or include any substantial portions of copyrighted original text.
: **Important Instructions:**
- Do NOT summarize, combine, or omit any lines.
- **Process each line individually:** The output must have exactly one refined line for each input line.
- Do not merge two or more lines.
- The final output must contain ONLY the polished Korean text, with no introductory phrases, headers, or extra commentary.
- Do NOT include any headers, labels, or additional commentary in the output.
: **Input:**
[Initial Korean Translation]
${amazonTranslation}
: **Output:**
`;
  const inputTokens = encode(systemPrompt);
  console.log(`🔢 Claude 입력 토큰 수: ${inputTokens.length}`);
  const inputPayload = {
    modelId: INFERENCE_PROFILE_ARN,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      messages: [{ role: "user", content: systemPrompt }],
      max_tokens: 10000,
      temperature: 0.9,
      top_p: 0.8,
      top_k: 250,
      stop_sequences: []
    })
  };
  try {
    const command = new InvokeModelCommand(inputPayload);
    const response = await client.send(command);
    const responseBody = new TextDecoder("utf-8").decode(response.body);
    const responseData = JSON.parse(responseBody);
    let refinedLyrics = responseData?.content?.[0]?.text?.trim();
    if (!refinedLyrics) {
      console.error("❌ Claude 3.5 응답에서 번역 결과를 찾을 수 없습니다.");
      return null;
    }
    const outputTokens = encode(refinedLyrics);
    console.log(`🔢 Claude 출력 토큰 수: ${outputTokens.length}`);
    console.log(`🔢 총 토큰 수 (입력 + 출력): ${inputTokens.length + outputTokens.length}`);
    const endTime = performance.now();
    console.log(`📝 최종 번역 결과 (소요 시간: ${(endTime - startTime).toFixed(2)}ms)`);

    // 후처리: 대괄호로 시작하는 헤더 제거
    refinedLyrics = refinedLyrics.replace(/^\[.*?\]\s*/, '').trimStart();
    // 후처리: "Here is" 로 시작하는 문장 제거 (대소문자 무시)
    refinedLyrics = refinedLyrics.replace(/^Here is.*\n?/i, '').trim();

    console.log("✅ 최종 번역 결과:",refinedLyrics);
    return refinedLyrics;
  } catch (error) {
    console.error("❌ Claude 3.5 번역 보정 요청 실패:", error);
    return null;
  }
}

/**
 * 전체 번역 프로세스 실행 함수
 * 순서:
 * 1) 한글 비율 검사 → (대체로 한국어면) 원문 반환
 * 2) Amazon Translate 실행
 * 3) Claude 보정 시도 → 거부 메시지나 파싱 불일치시 fallback 처리
 */
async function processTranslation(lyrics) {
  console.log("🚀 전체 번역 프로세스 시작");

  // AWS Translate의 auto 감지에 의존하여, 원본 언어가 한국어면 번역 건너뜁니다.
  const amazonResult = await translateWithAmazon(lyrics);
  if (!amazonResult) {
    console.error("❌ Amazon Translate 실패: 번역을 진행할 수 없습니다.");
    return null;
  }

  // 2) Claude 보정 실행 (Amazon Translate 결과를 사용)
  let refinedResult = await refineTranslation(amazonResult);

  // fallback: Claude 거부 메시지 감지 시 Amazon Translate 결과 사용
  if (
    !refinedResult ||
    refinedResult.includes("I apologize, but I cannot assist") ||
    refinedResult.includes("cannot help with copyrighted lyrics")
  ) {
    console.log("⚠️ Claude 거부(사과) 메시지 감지 → Amazon Translate 결과만 사용");
    refinedResult = amazonResult;
  }

  // 추가 fallback: 줄 수 비교 (보정된 결과가 Amazon 결과의 50% 미만이면 fallback)
  const refinedLines = refinedResult.split('\n').filter(line => line.trim() !== '');
  const amazonLines = amazonResult.split('\n').filter(line => line.trim() !== '');
  if (refinedLines.length < amazonLines.length * 0.5) {
    console.log("⚠️ 보정된 결과의 줄 수가 현저히 부족합니다. Amazon Translate 결과로 fallback합니다.");
    refinedResult = amazonResult;
  }

  console.log("🚀 전체 번역 프로세스 완료");
  return refinedResult;
}

router.post('/', async (req, res) => { 
  let { lyrics, track_id } = req.body;

  if (track_id) {
    const redisKey = `lyrics_translation:${track_id}`;
    try {
      const cachedTranslation = await redisClient.get(redisKey);
      if (cachedTranslation) {
        console.log("✅ [Redis] 캐시된 번역 가사를 찾았습니다:", { track_id, lyrics_translation: cachedTranslation });
        res.write(`data: ${JSON.stringify({ stage: 'refined', translation: cachedTranslation })}\n\n`);
        return res.end();
      } else {
        console.log(`ℹ️ [Redis] 캐시된 번역 가사가 없습니다: track_id=${track_id}`);
      }
    } catch (err) {
      console.error("❌ [Redis] 캐시 조회 중 오류:", err);
    }
  }

  // track_id가 있다면 DB에서 해당 트랙 정보를 조회합니다.
  if (track_id) {
    try {
      const paramsGet = {
        TableName: DYNAMODB_TABLE_TRACKS,
        Key: { track_id }
      };
      const dbResult = await dynamoDb.get(paramsGet).promise();
      if (dbResult.Item && dbResult.Item.lyrics_translation) {
        console.log("✅ [DynamoDB] DB에 저장된 번역 가사가 있습니다. 바로 반환합니다.", dbResult.Item);
        res.write(`data: ${JSON.stringify({ stage: 'refined', translation: dbResult.Item.lyrics_translation })}\n\n`);
        res.end();
        // 반환 후 비동기적으로 Redis에 캐싱
        redisClient.setEx(`lyrics_translation:${track_id}`, 86400, dbResult.Item.lyrics_translation)
          .then(() => console.log(`✅ [Redis] DB의 번역 가사를 Redis에 캐싱 완료: track_id=${track_id}`))
          .catch(err => console.error("❌ [Redis] 캐싱 중 오류:", err));
        return;
      }
      if (dbResult.Item && dbResult.Item.plain_lyrics) {
        lyrics = dbResult.Item.plain_lyrics;
        console.log("✅ [DynamoDB] DB에 번역 가사가 없으므로, plain_lyrics를 번역에 사용합니다.");
      }
    } catch (err) {
      console.error("❌ [DynamoDB] DB 조회 오류:", err);
    }
  }

  if (!lyrics) {
    res.status(400).json({ error: "원문 가사를 제공하세요." });
    return;
  }

  // SSE 헤더 설정
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.flushHeaders();

  try {
    // AWS Translate가 이미 원본 언어를 감지하여 한국어면 번역을 건너뜁니다.
    const amazonResult = await translateWithAmazon(lyrics);
    // 만약 번역이 필요 없다면, 원문을 그대로 반환
    if (amazonResult === lyrics) {
      console.log("입력 텍스트가 이미 한국어이므로, 번역 없이 원문 반환");
      // ★★ DB 업데이트: track_id가 있다면 lyrics_translation도 원문 그대로 저장
      if (track_id) {
        try {
          const updateParams = {
            TableName: DYNAMODB_TABLE_TRACKS,
            Key: { track_id },
            UpdateExpression: "set lyrics_translation = :trans, updatedAt = :updated",
            ExpressionAttributeValues: {
              ":trans": lyrics,
              ":updated": new Date().toISOString()
            },
            ReturnValues: "ALL_NEW"
          };
          const updateResult = await dynamoDb.update(updateParams).promise();
          console.log("✅ [DynamoDB] 원문 저장 완료:", updateResult.Attributes);
        } catch (err) {
          console.error("❌ [DynamoDB] 원문 저장 오류:", err);
        }
      }
      
      res.write(`data: ${JSON.stringify({ stage: 'refined', translation: lyrics })}\n\n`);
      res.end();
      return;
    }

    // Amazon Translate 결과 SSE 전송
    res.write(`data: ${JSON.stringify({ stage: 'amazon', translation: amazonResult })}\n\n`);

    // 2초 대기
    await new Promise(resolve => setTimeout(resolve, 2000));

    // "번역 보정 진행중..." 메시지 전송
    res.write(`data: ${JSON.stringify({ stage: 'update', translation: '번역 보정 진행중...' })}\n\n`);

    // 3. AI 번역(최종 번역) 진행 및 결과 전송
    let refinedResult = await refineTranslation(lyrics, amazonResult);

    // fallback: Claude 거부 메시지 감지 시 Amazon Translate 결과 사용
    if (
      !refinedResult ||
      refinedResult.includes("I apologize, but I cannot assist") ||
      refinedResult.includes("cannot help with copyrighted lyrics")
    ) {
      console.log("⚠️ Claude 거부(사과) 메시지 감지 → Amazon Translate 결과만 사용");
      refinedResult = amazonResult;
    }

    // fallback: 줄 수 비교
    const refinedLines = refinedResult.split('\n').filter(line => line.trim() !== '');
    const amazonLines = amazonResult.split('\n').filter(line => line.trim() !== '');
    if (refinedLines.length < amazonLines.length * 0.5) {
      console.log("⚠️ 보정된 결과의 줄 수가 현저히 부족합니다. Amazon Translate 결과로 fallback합니다.");
      refinedResult = amazonResult;
    }

    // ★★ DB 업데이트: track_id가 있다면 lyrics_translation 필드 업데이트
    if (track_id) {
      try {
        const paramsCheck = {
          TableName: DYNAMODB_TABLE_TRACKS,
          Key: { track_id }
        };
        const checkResult = await dynamoDb.get(paramsCheck).promise();
        if (!(checkResult.Item && checkResult.Item.lyrics_translation)) {
          const updateParams = {
            TableName: DYNAMODB_TABLE_TRACKS,
            Key: { track_id },
            UpdateExpression: "set lyrics_translation = :trans, updatedAt = :updated",
            ExpressionAttributeValues: {
              ":trans": refinedResult,
              ":updated": new Date().toISOString()
            },
            ReturnValues: "ALL_NEW"
          };
          const updateResult = await dynamoDb.update(updateParams).promise();
          console.log("✅ [DynamoDB] 번역 가사 저장/업데이트 완료:", updateResult.Attributes);
        } else {
          console.log("ℹ️ [DynamoDB] 기존 번역 가사가 존재하므로 업데이트하지 않습니다.");
        }
        // 반환 후 비동기적으로 Redis 캐싱
        redisClient.setEx(`lyrics_translation:${track_id}`, 86400, refinedResult)
          .then(() => console.log(`✅ [Redis] 새 번역 가사를 Redis에 캐싱했습니다: track_id=${track_id}`))
          .catch(err => console.error("❌ [Redis] 캐싱 중 오류:", err));
      } catch (err) {
        console.error("❌ [DynamoDB] 번역 가사 업데이트 오류:", err);
      }
    }
    res.write(`data: ${JSON.stringify({ stage: 'refined', translation: refinedResult })}\n\n`);
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ stage: 'error', message: '번역 프로세스에 실패했습니다.' })}\n\n`);
    res.end();
  }
});

export default router;