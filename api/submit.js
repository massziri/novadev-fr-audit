export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    const payload = req.body;
    const formSubmitData = {
      ...payload,
      _subject: `Nouvelle demande NovaDev FR - ${payload.fname} ${payload.lname}`,
      _captcha: "false",
      _template: "table"
    };

    const response = await fetch('https://formsubmit.co/ajax/admin@novatvhub.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(formSubmitData)
    });

    const result = await response.json();
    return res.status(response.status).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}
