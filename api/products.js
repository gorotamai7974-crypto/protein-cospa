// Vercel Serverless Function: 楽天市場API中継
// 新APIは applicationId + accessKey の両方が必須

export default async function handler(req, res) {
  const APP_ID = process.env.RAKUTEN_APP_ID;
  const ACCESS_KEY = process.env.RAKUTEN_ACCESS_KEY;
  const AFFILIATE_ID = process.env.RAKUTEN_AFFILIATE_ID || '';

  if (!APP_ID) {
    return res.status(500).json({
      error: '環境変数 RAKUTEN_APP_ID が未設定です。'
    });
  }
  if (!ACCESS_KEY) {
    return res.status(500).json({
      error: '環境変数 RAKUTEN_ACCESS_KEY が未設定です。Vercelダッシュボードで追加してください。'
    });
  }

  const keyword = req.query.keyword || 'プロテイン ホエイ';

  const url = new URL('https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20220601');
  url.searchParams.set('format', 'json');
  url.searchParams.set('keyword', keyword);
  url.searchParams.set('applicationId', APP_ID);
  url.searchParams.set('accessKey', ACCESS_KEY);
  if (AFFILIATE_ID) url.searchParams.set('affiliateId', AFFILIATE_ID);
  url.searchParams.set('hits', '30');
  url.searchParams.set('sort', '+itemPrice');

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${ACCESS_KEY}`,
        'User-Agent': 'ProteinCospa/1.0',
      },
    });
    const text = await response.text();

    if (response.ok) {
      try {
        const data = JSON.parse(text);
        // 5分間キャッシュ（楽天の負荷軽減＆応答速度UP）
        res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
        return res.status(200).json(data);
      } catch (e) {
        return res.status(500).json({
          error: 'JSON解析エラー',
          detail: e.message,
          body: text.slice(0, 1000),
        });
      }
    }

    return res.status(response.status).json({
      error: '楽天APIがエラーを返しました',
      status: response.status,
      body: text.slice(0, 1000),
    });
  } catch (e) {
    return res.status(500).json({
      error: 'ネットワークエラー',
      detail: e.message,
    });
  }
}
