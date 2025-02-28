//Image/translation-service/routes/server.js

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
dotenv.config();

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ [Translation Service] MongoDB 연결 성공');
}).catch(err => {
  console.error('❌ [Translation Service] MongoDB 연결 실패:', err);
});

const app = express();
app.use(cors());
app.use(express.json());

import translateRouter from './routes/translate.js';
app.use('/api/translate', translateRouter);

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => {
  console.log(`✅ [Translation Service] 서버가 포트 ${PORT}에서 실행 중`);
});
