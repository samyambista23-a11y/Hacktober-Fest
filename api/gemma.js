// Vercel serverless function: forwards requests to Gemma so the API key
// stays secret on the server and never appears in the website's code.
// Set GEMINI_API_KEY in Vercel → Project → Settings → Environment Variables.
const ALLOWED_MODELS = ["gemma-4-26b-a4b-it", "gemma-4-31b-it"];

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: { message: "POST only" } });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: { message: "GEMINI_API_KEY is not set on the server" } });

  const { model, body } = req.body || {};
  if (!body || JSON.stringify(body).length > 20000) {
    return res.status(400).json({ error: { message: "Bad request" } });
  }
  const useModel = ALLOWED_MODELS.includes(model) ? model : ALLOWED_MODELS[0];

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${useModel}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(body)
      }
    );
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    res.status(502).json({ error: { message: "Could not reach Gemma" } });
  }
};
