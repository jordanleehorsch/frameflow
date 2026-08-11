export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const BUNNY_STORAGE_ZONE = "thrive";
  const BUNNY_ACCESS_KEY = "d620773b-3709-413d-819288b64563-df1d-4b55";
  const BUNNY_URL = `https://la.storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}/frameflow_db.json`;

  try {
    if (req.method === 'GET') {
      const bunnyRes = await fetch(`${BUNNY_URL}?t=${Date.now()}`, {
        headers: { 'AccessKey': BUNNY_ACCESS_KEY },
        cache: 'no-store'
      });
      if (!bunnyRes.ok) {
        return res.status(200).json({ videos: [], drawings: {}, comments: [] });
      }
      const data = await bunnyRes.json();
      return res.status(200).json(data);
    }

    if (req.method === 'PUT') {
      const bodyData = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const bunnyRes = await fetch(BUNNY_URL, {
        method: 'PUT',
        headers: {
          'AccessKey': BUNNY_ACCESS_KEY,
          'Content-Type': 'application/json'
        },
        body: bodyData
      });
      return res.status(200).json({ success: bunnyRes.ok });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}