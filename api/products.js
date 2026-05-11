// Vercelサーバーレス機能：楽天市場API中継
// fetch ではなく Node.js 標準の https モジュールを使う（Referer を確実に渡すため）

import https from 'node:https';

function httpsGet(urlString, headers) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const req = https.request({
      ホスト名: url.hostname、
      ポート: 443、
      パス: url.pathname + url.search、
      メソッド: 'GET'、
      ヘッダー: ヘッダー、
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        解決する（{
          ステータス: res.statusCode、
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

  const キーワード = req.query.keyword || 「プロテインホエイ」;

  const apiUrl = new URL('https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20220601');
  apiUrl.searchParams.set('format', 'json');
  apiUrl.searchParams.set('keyword', keyword);
  apiUrl.searchParams.set('applicationId', APP_ID);
  apiUrl.searchParams.set('accessKey', ACCESS_KEY);
  if (AFFILIATE_ID) apiUrl.searchParams.set('affiliateId', AFFILIATE_ID);
  apiUrl.searchParams.set('hits', '30');
  //標準（人気）順で取得 → 内容量が信頼されたメジャーな商品が並びやすい
  apiUrl.searchParams.set('sort', 'standard');

  試す {
    const result = await httpsGet(apiUrl.toString(), {
      「承認」: 「application/json」、
      '認証': `ベアラー ${ACCESS_KEY}`、
      //ブラウザらしいUser-Agentで送信（一部APIはボット対策で弾くため）
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      // リファラーヘッダ（標準綴り：R 1つ）
      「参照元」: SITE_URL、
      // Referrerヘッダ（楽天の内部エラー名がREFERRERだったので、こちらの綴りも気になる）
      「参照元」: SITE_URL、
      // オリジンヘッダも暫定送信
      'Origin': SITE_URL.replace(/\/$/, ''),
    });

    if (result.status >= 200 && result.status < 300) {
      試す {
        const data = JSON.parse(result.body);
        res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
        return res.status(200).json(data);
      } catch (e) {
        res.status(500).json({
          エラー: 'JSON解析エラー',
          詳細: e.メッセージ、
          body: result.body.slice(0, 1000),
        });
      }
    }

    return res.status(result.status).json({
      エラー: '楽天APIがエラーを返しました',
      ステータス: result.status、
      body: result.body.slice(0, 1000),
    });
  } catch (e) {
    res.status(500).json({
      エラー: 'ネットワークエラー'、
      詳細: e.メッセージ、
    });
  }
}
