const { onRequest } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Stripe = require("stripe");
const admin = require("firebase-admin");

admin.initializeApp();

let stripe;
try {
  stripe = Stripe(process.env.STRIPE_SECRET_KEY);
} catch (e) {
  console.error("Stripe initialization failed:", e);
}

function getAIModel(modelName = "gemini-2.5-flash") {
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error("CRITICAL: Липсва GOOGLE_API_KEY!");
  }
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  return genAI.getGenerativeModel({ model: modelName });
}

const BAD_WORDS = [
  "тъпак", "глупак", "idiot",
  "stupid", "fuck", "shit",
  "прост", "кретен", "moron",
  "dumb", "asshole", "bastard",
  "кучка", "педерас", "slut",
  "whore", "fag", "dick",
  "cunt", "наркоман", "наркоманчета",
  "наркомани", "наркоманите", "наркоманчето",
  "пияница", "пиянде", "пиянди", "минджа",
  "пияндета", "алкохолик", "алкохолици",
  "алкохолиците", "алкохоликът", "алкохолиците",
  "курва", "курви", "проститутка", "проститутки",
  "шибан", "шибана", "шибано", "шибани",
  "еба", "ебан", "ебана", "ебано", "ебани",
  "секс", "сексуален", "сексуална", "сексуално",
  "сексуални", "мастурбира", "мастурбиране",
  "задник", "пичка", "пички", "пенис",
  "вагина", "клитор", "оргазъм", "оргазми",
  "срање", "срания", "срано", "срани",
  "кур", "курове", "курът", "куровете",
  "дрогар", "дрога", "дрогата", "дрогите"
];

function containsBadWords(text) {
  if (!text) return false;
  return BAD_WORDS.some(word => text.toLowerCase().includes(word));
}

const SYSTEM_PROMPT = `Ти си ScriptSensei - не просто AI, а легендарният виртуален ментор по JavaScript. Твоята мисия е да превърнеш начинаещите в кодиращи нинджи. 🥷💻

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
- Ако те питат "Кой те създаде?", отговори: "Аз съм разработка на Данислав Иванов! Неговата цел беше да създаде най-добрия помощник за JavaScript, и ето ме тук! 😎🚀".
- Ако потребителят напише нещо много кратко (напр. "обекти"), не питай "Какво за тях?", а направо дай кратко, ударно обяснение с пример.
`;

exports.chat = onRequest({ cors: true, timeoutSeconds: 300 }, async (req, res) => {
  try {
    const { messages, attachments, userId, preferredModel } = req.body;

    let maxTokens = 2500;
    let modelName = "gemini-2.5-flash";

    if (userId && preferredModel === 'pro') {
      const userSnap = await admin.firestore().collection('users').doc(userId).get();
      if (userSnap.exists && userSnap.data().hasPremiumAccess) {
        modelName = "gemini-2.5-pro";
        maxTokens = 8000;
      }
    }

    const model = getAIModel(modelName);

    const lastMessageObj = messages[messages.length - 1];
    let promptText = lastMessageObj ? lastMessageObj.content : "";

    if (containsBadWords(promptText)) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send("Хей, нека спазваме добрия тон! 🧘‍♂️🎓");
      return;
    }

    if ((!promptText || promptText.trim() === "") && attachments && attachments.length > 0) {
      promptText = "Разгледай тази снимка и анализирай кода/съдържанието.";
    }

    const historyForGemini = messages.slice(0, -1).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const currentMessageParts = [{ text: promptText }];

    if (attachments && attachments.length > 0) {
      attachments.forEach(file => {
        const isTextFile =
          file.mimeType.startsWith('text/') ||
          file.mimeType.includes('javascript') ||
          file.mimeType.includes('json') ||
          file.mimeType.includes('xml') ||
          file.mimeType.includes('html') ||
          file.mimeType.includes('css');

        if (isTextFile) {
          try {
            const decodedText = Buffer.from(file.base64, 'base64').toString('utf-8');
            currentMessageParts.push({
              text: `\n\n--- СЪДЪРЖАНИЕ НА ПРИКАЧЕН ФАЙЛ: ${file.name || 'Code'} ---\n${decodedText}\n--- КРАЙ НА ФАЙЛА ---\n`
            });
          } catch (e) {
            console.error("Error decoding text file:", e);
          }
        } else {
          currentMessageParts.push({
            inlineData: { mimeType: file.mimeType, data: file.base64 }
          });
        }
      });
    }

    const chatSession = model.startChat({
      generationConfig: { maxOutputTokens: maxTokens },
      history: [
        { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
        { role: "model", parts: [{ text: `Здравей! Използвам модел: ${modelName === "gemini-2.5-pro" ? "PRO 🧠" : "Flash ⚡"}. Готов съм да кодираме! 🚀` }] },
        ...historyForGemini
      ],
    });

    const result = await chatSession.sendMessageStream(currentMessageParts);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      res.write(chunkText);
    }

    res.end();

  } catch (error) {
    console.error("Chat Error:", error);
    res.write("\n\n[SYSTEM ERROR]: " + error.message);
    res.end();
  }
});

exports.generateTitle = onRequest({ cors: true }, async (req, res) => {
  try {
    const model = getAIModel("gemini-2.5-flash");
    const { message } = req.body;
    const prompt = `
      Generate a very short, creative title (max 5 words) in Bulgarian for a chat that starts with this message:
      "${message.substring(0, 300)}"
      Return ONLY the title text. No quotes.
    `;
    const result = await model.generateContent(prompt);
    res.json({ reply: result.response.text().replace(/["']/g, "").trim() });
  } catch (e) { res.json({ reply: "Разговор" }); }
});

exports.analyzeCode = onRequest({ cors: true }, async (req, res) => {
  try {
    const model = getAIModel("gemini-2.5-flash");
    const { code } = req.body;
    const prompt = `
      Ти си Senior JavaScript Auditor.
      Анализирай следния код и върни САМО JSON обект.
      НЕ използвай Markdown форматиране (без \`\`\`json).
      
      Структурата трябва да е точно такава:
      {
        "score": (число 0-100),
        "quality": (текст: "Слаб", "Среден", "Добър", "Отличен"),
        "summary": (кратко обобщение на български),
        "issues": ["проблем 1", "проблем 2"],
        "securityRisk": (boolean),
        "securityMessage": (текст)
      }
      
      КОД ЗА АНАЛИЗ:
      ${code}
    `;
    const result = await model.generateContent(prompt);
    let text = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
    res.json(JSON.parse(text));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

exports.fixCode = onRequest({ cors: true }, async (req, res) => {
  try {
    const model = getAIModel("gemini-2.5-flash");
    const { code } = req.body;
    const prompt = `Fix this JS code. Improve comments where needed. Return ONLY the code. 
    Make sure the code you return is in English, but if you've fixed any comments, 
    make sure they're fixed in Bulgarian. Code to fix: ${code}`;
    const result = await model.generateContent(prompt);
    res.json({ fixedCode: result.response.text().replace(/```javascript/g, "").replace(/```/g, "").trim() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

exports.createCheckoutSession = onRequest({ cors: true }, async (req, res) => {
  try {
    const { userId, userEmail } = req.body;
    if (!userId) { res.status(400).json({ error: "No user ID" }); return; }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price: 'price_1SoiPvFCI9V7RPg10QywPDuo',
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: `https://scriptsensei-4e8fe.web.app/?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://scriptsensei-4e8fe.web.app/?payment_canceled=true`,
      customer_email: userEmail,
      metadata: { userId: userId, type: 'pro_upgrade' },
    });

    res.json({ id: session.id, url: session.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

exports.verifyPayment = onRequest({ cors: true }, async (req, res) => {
  try {
    const { sessionId } = req.body;
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      const userId = session.metadata.userId;

      await admin.firestore().collection('users').doc(userId).set({
        hasPremiumAccess: true,
        proSince: admin.firestore.FieldValue.serverTimestamp(),
        email: session.customer_email,
        stripeCustomerId: session.customer
      }, { merge: true });

      res.json({ success: true, userId: userId });
    } else {
      res.json({ success: false });
    }
  } catch (error) {
    console.error("Payment Verify Error:", error);
    res.status(500).json({ error: error.message });
  }
});

exports.createPortalSession = onRequest({ cors: true }, async (req, res) => {
  try {
    const { userId } = req.body;

    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData || !userData.stripeCustomerId) {
      if (userData && userData.email) {
        const customers = await stripe.customers.list({ email: userData.email, limit: 1 });
        if (customers.data.length > 0) {
          const session = await stripe.billingPortal.sessions.create({
            customer: customers.data[0].id,
            return_url: 'https://scriptsensei-4e8fe.web.app/'
          });
          res.json({ url: session.url });
          return;
        }
      }
      return res.status(404).json({ error: "Няма активен абонамент в Stripe." });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: userData.stripeCustomerId,
      return_url: 'https://scriptsensei-4e8fe.web.app/',
    });

    res.json({ url: session.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});