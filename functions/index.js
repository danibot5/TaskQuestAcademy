const { onRequest } = require("firebase-functions/v2/https");
const { OpenAI } = require("openai");
require("dotenv").config();

const SYSTEM_PROMPT = "Ти си ScriptSensei - приятелски настроен учител по JavaScript. Твоята цел е да помагаш на начинаещи. Обяснявай кратко и давай примери на български език.";

exports.chat = onRequest({ cors: true }, async function (req, res) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("Липсва API ключ в .env файла!");
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: "https://api.groq.com/openai/v1"
    });

    // ТУК Е ПРОМЯНАТА: Вече очакваме цяла история (масив), а не просто текст
    const conversationHistory = req.body.messages || [];

    const completion = await openai.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...conversationHistory // Разпакетираме цялата история тук
      ],
    });

    res.json({ reply: completion.choices[0].message.content });

  } catch (error) {
    console.error("Грешка:", error);
    res.json({ error: "Грешка: " + error.message });
  }
});