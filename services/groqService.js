const groq = require('../config/groq');

const SYSTEM_PROMPT = `You are a grocery shopping assistant. Extract all grocery products from the user's message.
Return ONLY a valid JSON array of product objects. No other text, no markdown, no explanation.
Each object must have:
- "name": product name (string, lowercase)
- "quantity": numeric quantity (number, default 1)
- "unit": unit of measure (string: "kg", "litre", "piece", "pack", "dozen" — default "piece")
- "keywords": array of alternative names or search terms for this product

Example output:
[
  {"name": "rice", "quantity": 2, "unit": "kg", "keywords": ["rice", "chawal", "basmati"]},
  {"name": "milk", "quantity": 1, "unit": "litre", "keywords": ["milk", "doodh"]}
]`;

const extractProductsFromText = async (userInput) => {
  const completion = await groq.chat.completions.create({
    model: 'llama3-8b-8192', // free tier model
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userInput },
    ],
    temperature: 0.1, // low temperature for consistent structured output
    max_tokens: 1000,
  });

  const raw = completion.choices[0].message.content;
  // Strip any accidental markdown fences
  const clean = raw.replace(/```json|```/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch (err) {
    throw new Error('AI response could not be parsed. Please rephrase your list and try again.');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('AI did not return a product list. Please try again.');
  }

  // Normalize + guard against malformed entries
  return parsed
    .filter((p) => p && typeof p.name === 'string' && p.name.trim().length > 0)
    .map((p) => ({
      name: p.name.trim().toLowerCase(),
      quantity: typeof p.quantity === 'number' && p.quantity > 0 ? p.quantity : 1,
      unit: typeof p.unit === 'string' && p.unit.trim() ? p.unit.trim() : 'piece',
      keywords: Array.isArray(p.keywords) && p.keywords.length ? p.keywords : [p.name.trim().toLowerCase()],
    }));
};

module.exports = { extractProductsFromText };
