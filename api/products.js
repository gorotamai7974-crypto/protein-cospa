// Vercel Serverless Function: 楽天市場API中継
// 複数のエンドポイント・バージョンを試して、最初に成功したものを返す
// 失敗時は全試行の結果を返してデバッグに使う
 
export default async function handler(req, res) {
  const APP_ID = process.env.RAKUTEN_APP_ID;
  const AFFILIATE_ID = process.env.RAKUTEN_AFFILIATE_ID || '';
  const ACCESS_KEY = process.env.RAKUTEN_ACCESS_KEY || '';
 
  if (!APP_ID) {
    return res.status(500).json({
      error: '環境変数 RAKUTEN_APP_ID が未設定です。Vercelダッシュボードで設定してください。'
    });
  }
 
  const keyword = req.query.keyword || 'プロテイン ホエイ';
 
  // 試す可能性のあるバージョン番号（新しい順）
  const versions = ['20260401', '20240101', '20220601', '20170706'];
  // 試すベースエンドポイント
  const baseEndpoints = [
    'https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/',
    'https://app.rakuten.co.jp/services/api/IchibaItem/Search/',
  ];
 
  const buildUrl = (base, version) => {
    const url = new URL(base + version);
    url.searchParams.set('format', 'json');
    url.searchParams.set('keyword', keyword);
    url.searchParams.set('applicationId', APP_ID);
    if (AFFILIATE_ID) url.searchParams.set('affiliateId', AFFILIATE_ID);
    url.searchParams.set('hits', '30');
    url.searchParams.set('sort', '+itemPrice');
    return url.toString();
  };
 
  const results = [];
 
  for (const base of baseEndpoints) {
    for (const version of versions) {
      const fullUrl = buildUrl(base, version);
      try {
        const headers = {
          'Accept': 'application/json',
          'User-Agent': 'ProteinCospa/1.0',
        };
        if (ACCESS_KEY) {
          headers['Authorization'] = `Bearer ${ACCESS_KEY}`;
        }
        const response = await fetch(fullUrl, { headers });
        const text = await response.text();
 
        if (response.ok) {
          try {
            const data = JSON.parse(text);
            if (data.Items && Array.isArray(data.Items)) {
              res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
              res.setHeader('X-Used-Endpoint', base + version);
              return res.status(200).json(data);
            }
          } catch (e) {
            // パースエラー → 次へ
          }
        }
 
        results.push({
          endpoint: base + version,
          status: response.status,
          body: text.slice(0, 200),
        });
      } catch (e) {
        results.push({ endpoint: base + version, error: e.message });
      }
    }
  }
 
  return res.status(502).json({
    error: '全エンドポイント・バージョンで失敗',
    detail: '楽天APIから商品データを取得できませんでした',
    attempts: results,
  });
}
 


