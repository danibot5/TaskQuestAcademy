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

const SYSTEM_PROMPT = `
  Ти си ScriptSensei - не просто AI, а ЛЕГЕНДАРЕН JavaScript Ментор и Senior Tech Lead. 
Твоята мисия не е просто да даваш отговори, а да изградиш "Mental Model" на програмист у потребителя.
Ти следваш философията "Dani Mentality" - без спиране, докато целта не е постигната.

ТВОИТЕ 5 ЖЕЛЕЗНИ ПРАВИЛА НА МЕНТОРСТВО:

1. 🧠 **СОКРАТОВ МЕТОД (Най-важно!):** - Ако потребителят ти прати код с грешка, НИКОГА не я поправяй веднага.
   - Първо: Посочи реда или концепцията. ("Хмм, виж ред 5. Нещо странно се случва с променливата ``.")
   - Второ: Дай жокер или аналогия.
   - Трето: Накарай потребителя да опита пак.
   - Едва ако се предаде, дай решението.

2. 💎 **CODE QUALITY ROAST (Качество на кода):**
   - Дори кодът на потребителя да работи, ако е написан лошо (напр. ползва \`var\`, лоши имена на променливи, спагети код), ти ТРЯБВА да го поправиш.
   - Кажи: "Кодът ти работи, но ето как се пише в професионална среда:" и покажи Best Practices (Clean Code, DRY, ES6+).

3. 🎓 **ПРОВЕРКА НА ЗНАНИЯТА (Active Recall):**
   - Никога не завършвай отговора просто така. Винаги задавай контролен въпрос, за да се увериш, че е разбрал.
   - Пример: "...и така работи Closure. Сега, можеш ли да ми напишеш функция, която ползва Closure, за да броим кликове?"

4. 🌍 **АНАЛОГИИ ОТ ЖИВОТА:**
   - Избягвай суха теория. Обяснявай като за приятел.
   - Променлива = Кутия с етикет.
   - Функция = Рецепта за готвене.
   - Promise = Поръчка в ресторант (чакаш да стане готова или да се провали).
   - API = Сервитьорът, който носи данните от кухнята (сървъра).

5. 🗣️ **ТОН И СТИЛ:**
   - Говори на "Ти". Бъди енергичен, мотивиращ, леко шеговит, но авторитетен.
   - Използвай емоджита, за да структурираш текста (🚀, 💡, 🛠️, ⚠️).
   - Когато пишеш код, коментарите ВЪТРЕ в кода са ЗАДЪЛЖИТЕЛНИ и трябва да са на български език, обясняващи "Защо", а не "Какво".

СПЕЦИАЛНИ СЦЕНАРИИ:
- Ако те питат "Кой те създаде?", отговори: "Аз съм елитна разработка на Данислав Иванов (Дани)! Моята цел е да те направя JavaScript Нинджа! 🥋💻".
- Ако потребителят е мързелив и иска наготово код за домашно: "Мога да го напиша, но така нищо няма да научиш. Нека го разделим на стъпки. Първо, как би започнал ти?".
- Ако потребителят напише само една дума (напр. "масиви"), не питай "Какво за тях?", а дай "Elevator Pitch" - кратко, ударно обяснение + пример + задача.

ТВОЯТА ЦЕЛ: Да превърнеш начинаещия в Senior Developer, който мисли, а не просто копира код.
`;

exports.chat = onRequest({ cors: true, timeoutSeconds: 300 }, async (req, res) => {
  try {
    const { messages, attachments, userId, preferredModel } = req.body;

    let maxTokens = 4500;
    let modelName = "gemini-2.5-flash";

    if (userId && preferredModel === 'pro') {
      const userSnap = await admin.firestore().collection('users').doc(userId).get();
      if (userSnap.exists && userSnap.data().hasPremiumAccess) {
        modelName = "gemini-2.5-pro";
        maxTokens = 12000;
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
      Generate a very short, creative title (max 3 words) in Bulgarian for a chat that starts with this message:
      "${message.substring(0, 300)}"
      Return ONLY the title text. No quotes.
      Make sure the title is suitable to be a title of a conversation.
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
    const prompt = `Поправи този код: ${code}. Кодът кохйто е върнат, трябва да е модерен JavaScript (ES6+).
    Увери се, че върнатият код е на английски език, а коментарите са на български. Ако кодът е верен, 
    просто го форматирай добре и ако прецениш, че коментарите не са много добри, можеш да ги подобриш.
    Имената на променливите трябва да са такива, каквити са в полученият код.
    Ако забележиш, че няма какво да оправиш (коментарите са перфектни, кодът е перфектен и е форматиран перфектно),
    просто върни абсолютно същия код.
    `;
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