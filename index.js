
const http = require("http");
const {
  Client,
  GatewayIntentBits,
  Partials
} = require("discord.js");

const OpenAI = require("openai");
require("dotenv").config();

// سيرفر Render
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("CASS AI is alive!");
});

server.listen(process.env.PORT || 3000, "0.0.0.0");

// إعداد بوت Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

// الاتصال بـ OpenRouter
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "https://cass-ai.onrender.com",
    "X-Title": "CASS AI"
  }
});

// عند تشغيل البوت
client.once("ready", () => {
  console.log(`✅ CASS AI is online as ${client.user.tag}`);
});

// استقبال الرسائل
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const mentioned = message.mentions.has(client.user);
  const isDM = !message.guild;

  if (!mentioned && !isDM) return;

  const prompt = message.content
    .replace(/<@!?\d+>/g, "")
    .trim();

  if (!prompt) {
    return message.reply("هلا! أنا CASS AI 🤖 كيف أقدر أساعدك؟");
  }

  try {
    await message.channel.sendTyping();

    const response = await openai.chat.completions.create({
      model: "inclusionai/ling-3.2-flash:free",
      messages: [
        {
          role: "system",
          content: "أنت CASS AI، مساعد ذكي وودود. أجب باللغة التي يستخدمها الشخص، وادعم اللغة العربية."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const answer =
      response.choices?.[0]?.message?.content ||
      "ما قدرت أطلع إجابة.";

    for (let i = 0; i < answer.length; i += 1900) {
      await message.reply(answer.slice(i, i + 1900));
    }

  } catch (error) {
    console.error("OpenRouter Error:", error);
    await message.reply("عذراً، حصل خطأ أثناء الرد. حاول مرة ثانية.");
  }
});

// تسجيل الدخول
client.login(process.env.DISCORD_TOKEN);
