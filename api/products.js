// Vercel Serverless Function: 楽天市場API中継
// fetch ではなく Node.js 標準の https モジュールを使う（Refererを確実に送るため）

import https from 'node:https';

function httpsGet(urlString, headers) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const req = https.request({
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: headers,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

export default async function handler(req, res) {
  const APP_ID = process.env.RAKUTEN_APP_ID;
  const ACCESS_KEY = process.env.RAKUTEN_ACCESS_KEY;
  const AFFILIATE_ID = process.env.RAKUTEN_AFFILIATE_ID || '';
  const SITE_URL = process.env.SITE_URL || 'https://protein-cospa.vercel.app/';

  if (!APP_ID) {
    return res.status(500).json({ error: '環境変数 RAKUTEN_APP_ID が未設定です。' });
  }
  if (!ACCESS_KEY) {
    return res.status(500).json({ error: '環境変数 RAKUTEN_ACCESS_KEY が未設定です。' });
  }

  const keyword = req.query.keyword || 'プロテイン ホエイ';

  const apiUrl = new URL('https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20220601');
  apiUrl.searchParams.set('format', 'json');
  apiUrl.searchParams.set('keyword', keyword);
  apiUrl.searchParams.set('applicationId', APP_ID);
  apiUrl.searchParams.set('accessKey', ACCESS_KEY);
  if (AFFILIATE_ID) apiUrl.searchParams.set('affiliateId', AFFILIATE_ID);
  apiUrl.searchParams.set('hits', '30');
  apiUrl.searchParams.set('sort', '+itemPrice');

  try {
    const result = await httpsGet(apiUrl.toString(), {
      'Accept': 'application/json',
      'Authorization': `Bearer ${ACCESS_KEY}`,
      // ブラウザらしいUser-Agentで送る（一部APIはbot対策で弾くため）
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      // Refererヘッダ（標準綴り：R 1つ）
      'Referer': SITE_URL,
      // Referrerヘッダ（楽天の内部エラー名がREFERRERだったので、こっちの綴りも試す）
      'Referrer': SITE_URL,
      // Originヘッダも一応送る
      'Origin': SITE_URL.replace(/\/$/, ''),
    });

    if (result.status >= 200 && result.status < 300) {
      try {
        const data = JSON.parse(result.body);
        res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
        return res.status(200).json(data);
      } catch (e) {
        return res.status(500).json({
          error: 'JSON解析エラー',
          detail: e.message,
          body: result.body.slice(0, 1000),
        });
      }
    }

    return res.status(result.status).json({
      error: '楽天APIがエラーを返しました',
      status: result.status,
      body: result.body.slice(0, 1000),
    });
  } catch (e) {
    return res.status(500).json({
      error: 'ネットワークエラー',
      detail: e.message,
    });
  }
}
