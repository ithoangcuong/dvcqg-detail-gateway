import https from 'node:https';

const UPSTREAM = 'https://dichvucong.gov.vn/api/v1/configuring/formality/get-formality-by-citizen';
const TIMEOUT_MS = 20000;

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function upstreamHeaders() {
  return {
    'Accept': 'application/json, text/plain, */*',
    'Content-Type': 'application/json; charset=UTF-8',
    'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
    'Origin': 'https://dichvucong.gov.vn',
    'Referer': 'https://dichvucong.gov.vn/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154.0 Safari/537.36'
  };
}

function safeError(err) {
  const cause = err && err.cause ? err.cause : {};
  return {
    name: String(err?.name || ''),
    message: String(err?.message || err || ''),
    cause_code: String(cause?.code || ''),
    cause_message: String(cause?.message || ''),
    cause_errno: String(cause?.errno || ''),
    cause_syscall: String(cause?.syscall || ''),
    cause_hostname: String(cause?.hostname || ''),
    cause_address: String(cause?.address || ''),
    cause_port: cause?.port ?? null
  };
}

function parsePayload(text) {
  try { return JSON.parse(text); }
  catch { return { code: 'UPSTREAM_NON_JSON', message: String(text || '').slice(0, 1000) }; }
}

async function postWithFetch(id) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(UPSTREAM, {
      method: 'POST',
      headers: upstreamHeaders(),
      body: JSON.stringify({ id }),
      signal: controller.signal,
      redirect: 'follow'
    });
    const text = await response.text();
    return { status: response.status, ok: response.ok, text, transport: 'fetch' };
  } finally {
    clearTimeout(timeout);
  }
}

function postWithHttpsIPv4(id) {
  return new Promise((resolve, reject) => {
    const url = new URL(UPSTREAM);
    const body = JSON.stringify({ id });
    const headers = {
      ...upstreamHeaders(),
      'Content-Length': Buffer.byteLength(body)
    };

    const request = https.request({
      protocol: 'https:',
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'POST',
      family: 4,
      servername: url.hostname,
      rejectUnauthorized: true,
      headers
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(Buffer.from(chunk)));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        const status = Number(response.statusCode || 0);
        resolve({ status, ok: status >= 200 && status < 300, text, transport: 'https_ipv4' });
      });
    });

    request.setTimeout(TIMEOUT_MS, () => {
      const err = new Error('UPSTREAM_TIMEOUT_IPV4');
      err.code = 'ETIMEDOUT';
      request.destroy(err);
    });
    request.on('error', reject);
    request.write(body);
    request.end();
  });
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

  let primaryError = null;
  let result = null;

  try {
    result = await postWithFetch(id);
  } catch (err) {
    primaryError = safeError(err);
  }

  // Nếu fetch của Node/Undici gặp lỗi mạng cấp thấp, thử lại bằng HTTPS thuần và ép IPv4.
  if (!result) {
    try {
      result = await postWithHttpsIPv4(id);
    } catch (err) {
      return res.status(502).json({
        ok: false,
        error: 'UPSTREAM_NETWORK_FAILED',
        primary_fetch_error: primaryError,
        ipv4_https_error: safeError(err)
      });
    }
  }

  const payload = parsePayload(result.text);
  if (!result.ok) {
    return res.status(502).json({
      ok: false,
      error: 'UPSTREAM_HTTP_' + result.status,
      upstream_status: result.status,
      transport: result.transport,
      upstream: payload,
      primary_fetch_error: primaryError
    });
  }

  // Trả nguyên payload chính thức để Apps Script parser xử lý.
  return res.status(200).json(payload);
}
