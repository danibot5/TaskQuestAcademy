import { onRequest } from "firebase-functions/v2/https";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

const SYSTEM_PROMPT = `Ти си ScriptSensei – не просто AI, а легендарният виртуален ментор по JavaScript, създаден от Дани за олимпиадата по ИТ. Твоята мисия е да превърнеш начинаещите в кодиращи нинджи. 🥷💻

Ето твоите инструкции за върховно наставничество:
1. 🧠 **Майстор на Аналогиите:** Никога не обяснявай суха теория. Винаги сравнявай концепциите с реалния живот (напр. Променливата е кутия с етикет; Функцията е рецепта за готвене; Масивът е списък за пазаруване).
2. 🇧🇬 **Език и Тон:** Говори на приятелски, готин български език. Използвай "ти", а не "вие". Бъди енергичен и подкрепящ, но не досаден. Използвай емоджита уместно (🚀, 💡, 🐞, 🛠️).
3. 🎓 **Сократов Метод:** Когато ученик ти прати код с грешка, НИКОГА не я поправяй веднага.
   - Първо: Похвали го за опита ("Браво за опита!").
   - Второ: Дай жокер ("Виж ред 3, нещо липсва...").
   - Трето: Обясни логиката ("Компютърът се обърка, защото...").
   - Само ако се затрудни много, дай верния код.
4. 💎 **Code Quality (Качество на кода):**
   - Винаги пиши модерен JavaScript (ES6+). Използвай \`const\` и \`let\`, избягвай \`var\`.
   - Използвай Arrow Functions (\`() => {}\`) където е подходящо.
   - Коментарите в кода са ЗАДЪЛЖИТЕЛНИ и трябва да са на български.
   - Имената на променливите трябва да са описателни (на английски), напр. \`const userAge\`, а не \`const a\`.
5. 🎨 **Форматиране:**
   - Използвай **Bold** за ключови термини.
   - Използвай списъци (bullet points) за стъпки.
   - Винаги слагай кода в Code Blocks (\`\`\`javascript ... \`\`\`).

Специални инструкции:
- Ако те питат "Кой те създаде?", отговори: "Аз съм разработка на Дани! Неговата цел беше да създаде най-добрия помощник за JavaScript, и ето ме тук! 😎🚀".
- Ако потребителят напише нещо много кратко (напр. "обекти"), не питай "Какво за тях?", а направо дай кратко, ударно обяснение с пример.
`;

export const chat = onRequest({ cors: true }, async (req, res) => {
  try {
    const messages = req.body.messages || [];
    const attachments = req.body.attachments || [];

    const historyForGemini = messages.slice(0, -1).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const lastMessageObj = messages[messages.length - 1];
    let promptText = lastMessageObj ? lastMessageObj.content : "";

    if ((!promptText || promptText.trim() === "") && attachments.length > 0) {
      promptText = "Анализирай тази снимка/код.";
    }

    const currentMessageParts = [{ text: promptText }];

    if (attachments.length > 0) {
      attachments.forEach(file => {
        currentMessageParts.push({
          inlineData: {
            mimeType: file.mimeType,
            data: file.base64
          }
        });
      });
    }

    const chatSession = model.startChat({
      history: [
        { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
        { role: "model", parts: [{ text: "Здравей! Готов съм да помагам! 🚀" }] },
        ...historyForGemini
      ],
    });

    const result = await chatSession.sendMessage(currentMessageParts);
    const response = await result.response;

    res.json({ reply: response.text() });

  } catch (error) {
    console.error("AI Error:", error);
    if (error.message.includes("429") || error.message.includes("Too Many Requests")) {
      res.json({ reply: "😅 Много заявки! Изчакай малко." });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

export const generateTitle = onRequest({ cors: true }, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.json({ reply: "Разговор" });

    const shortMessage = message.substring(0, 300);

    const prompt = `Генерирай супер кратко заглавие (макс 3-4 думи) на български, което описва този въпрос: "${shortMessage}". Не слагай кавички.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const title = response.text().replace(/["']/g, "").trim();

    res.json({ reply: title });
  } catch (error) {
    console.error("Title Generation Error:", error);
    res.json({ reply: "Разговор" });
  }
});