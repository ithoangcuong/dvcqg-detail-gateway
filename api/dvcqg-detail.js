const UPSTREAM = 'https://dichvucong.gov.vn/api/v1/configuring/formality/get-formality-by-citizen';

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
  }

  const expected = String(process.env.GATEWAY_SHARED_SECRET || '');
  const provided = String(req.headers['x-gateway-key'] || '');
  if (!expected || !provided || provided !== expected) {
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
  }

  const id = String(req.body?.id || '').trim();
  if (!validUuid(id)) {
    return res.status(400).json({ ok: false, error: 'INVALID_FORMALITY_ID' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json; charset=UTF-8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
        'Origin': 'https://dichvucong.gov.vn',
        'Referer': 'https://dichvucong.gov.vn/',
        'User-Agent': 'Mozilla/5.0 (compatible; LongTruong-DVCQG-Gateway/1.0)'
      },
      body: JSON.stringify({ id }),
      signal: controller.signal
    });

    const text = await upstream.text();
    let payload;
    try { payload = JSON.parse(text); }
    catch { payload = { code: 'UPSTREAM_NON_JSON', message: text.slice(0, 1000) }; }

    if (!upstream.ok) {
      return res.status(502).json({
        ok: false,
        error: 'UPSTREAM_HTTP_' + upstream.status,
        upstream_status: upstream.status,
        upstream: payload
      });
    }

    // Trả nguyên payload chính thức để Apps Script parser xử lý.
    return res.status(200).json(payload);
  } catch (err) {
    const message = err?.name === 'AbortError' ? 'UPSTREAM_TIMEOUT' : String(err?.message || err);
    return res.status(502).json({ ok: false, error: message });
  } finally {
    clearTimeout(timeout);
  }
}
