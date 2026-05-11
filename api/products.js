// Vercel Serverless Function: 楽天市場API中継
// ブラウザ → このサーバー → 楽天 という流れで、CORSもAPIキー漏れも防ぐ

export default async function handler(req, res) {
  const APP_ID = process.env.RAKUTEN_APP_ID;
  const AFFILIATE_ID = process.env.RAKUTEN_AFFILIATE_ID || '';

  if (!APP_ID) {
    return res.status(500).json({
      error: '環境変数 RAKUTEN_APP_ID が未設定です。Vercelダッシュボードで設定してください。'
    });
  }

  const keyword = req.query.keyword || 'プロテイン ホエイ';

  // 新型エンドポイント（UUID形式のapplicationId用）と
  // 旧型エンドポイント（数字のみのapplicationId用）の両方を試す
  const endpoints = [
    'https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20220601',
    'https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601',
  ];

  const buildUrl = (base) => {
    const url = new URL(base);
    url.searchParams.set('format', 'json');
    url.searchParams.set('keyword', keyword);
    url.searchParams.set('applicationId', APP_ID);
    if (AFFILIATE_ID) url.searchParams.set('affiliateId', AFFILIATE_ID);
    url.searchParams.set('hits', '30');
    url.searchParams.set('sort', '+itemPrice');
    return url.toString();
  };

  let lastError = null;
  let lastBody = '';
  let lastStatus = 0;

  for (const endpoint of endpoints) {
    const url = buildUrl(endpoint);
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ProteinCospa/1.0',
        },
      });
      const bodyText = await response.text();

      if (response.ok) {
        // 楽天APIが200を返した
        try {
          const data = JSON.parse(bodyText);
          // 5分間キャッシュ（楽天の1req/sec制限対策）
          res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
          return res.status(200).json(data);
        } catch (e) {
          lastError = new Error('JSON parse error: ' + e.message);
          lastBody = bodyText.slice(0, 300);
          continue;
        }
      } else {
        lastStatus = response.status;
        lastBody = bodyText.slice(0, 300);
        lastError = new Error(`HTTP ${response.status}`);
        continue;
      }
    } catch (e) {
      lastError = e;
      continue;
    }
  }

  // 全エンドポイント失敗
  return res.status(lastStatus || 502).json({
    error: '楽天APIへの問い合わせに失敗しました',
    detail: lastError ? lastError.message : 'unknown',
    body: lastBody,
  });
}
