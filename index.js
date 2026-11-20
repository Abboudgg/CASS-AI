
const http = require("http");
const fs = require("fs");
const path = require("path");
const {
  Client,
  GatewayIntentBits,
  Partials,
  ActivityType
} = require("discord.js");
const OpenAI = require("openai");
require("dotenv").config();

let personality = "أنت كاس Ai (CASS AI)، مساعد ذكي وودود. ادعم اللغة العربية وجميع اللغات.";

let currentActivity = "لا يوجد نشاط";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  maxRetries: 0,
  timeout: 45000,
  defaultHeaders: {
    "HTTP-Referer": "https://cass-ai.onrender.com",
    "X-Title": "CASS AI"
  }
});

const FREE_AI_MODEL = "openrouter/free";
const AI_RETRY_DELAYS = [1500, 3000, 6000];

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function createFreeAIResponse(messages) {
  let lastError;

  for (let attempt = 0; attempt <= AI_RETRY_DELAYS.length; attempt++) {
    try {
      return await openai.chat.completions.create({
        model: FREE_AI_MODEL,
        messages
      });
    } catch (error) {
      lastError = error;
      const status = error.status || error.code;

      // Retry temporary rate limits, provider outages, and network/server errors.
      const retryable =
        status === 429 ||
        status === 408 ||
        status === 500 ||
        status === 502 ||
        status === 503 ||
        status === 504 ||
        error.code === "ECONNRESET" ||
        error.code === "ETIMEDOUT";

      if (!retryable || attempt === AI_RETRY_DELAYS.length) {
        throw error;
      }

      const delay = AI_RETRY_DELAYS[attempt];
      console.warn(
        `⚠️ Free AI busy (attempt ${attempt + 1}/${AI_RETRY_DELAYS.length}); retrying in ${delay}ms.`
      );
      await wait(delay);
    }
  }

  throw lastError;
}

function sendJSON(res, data, code = 200) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  if ((req.method === "GET" || req.method === "HEAD") && req.url === "/") {
    const file = path.join(__dirname, "dashboard.html");
    fs.readFile(file, (err, content) => {
      if (err) {
        res.writeHead(500);
        return res.end("Dashboard file not found");
      }
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": content.length
      });
      if (req.method === "HEAD") return res.end();
      res.end(content);
    });
    return;
  }

  if ((req.method === "GET" || req.method === "HEAD") && req.url === "/api/status") {
    const data = {
      connected: client.isReady(),
      status: client.user?.presence?.status || "offline",
      activity: currentActivity,
      username: client.user?.tag || "CASS AI"
    };
    if (req.method === "HEAD") {
      const body = JSON.stringify(data);
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(body)
      });
      return res.end();
    }
    return sendJSON(res, data);
  }

  if (req.method === "POST" &&
      (req.url === "/api/status" || req.url === "/api/personality")) {
    let body = "";

    req.on("data", chunk => {
      body += chunk;
      if (body.length > 10000) req.destroy();
    });

    req.on("end", async () => {
      try {
        const data = JSON.parse(body);

        if (req.url === "/api/status") {
          if (!client.isReady()) {
            return sendJSON(res, { error: "Bot is not ready" }, 503);
          }

          const status = data.status;

          if (status === "online" || status === "dnd" || status === "idle") {
            client.user.setPresence({
              status,
              activities: []
            });
            currentActivity = "لا يوجد نشاط";
          } else if (status === "playing") {
            const game = String(data.game || "Roblox").slice(0, 100);
            client.user.setPresence({
              status: "online",
              activities: [{
                name: game,
                type: ActivityType.Playing
              }]
            });
            currentActivity = "Playing " + game;
          } else {
            return sendJSON(res, { error: "Invalid status" }, 400);
          }

          return sendJSON(res, { success: true });
        }

        if (req.url === "/api/personality") {
          const value = String(data.personality || "").trim();
          if (!value || value.length > 2000) {
            return sendJSON(res, { error: "Invalid personality" }, 400);
          }
          personality = value;
          return sendJSON(res, { success: true });
        }
      } catch (error) {
        return sendJSON(res, { error: "Invalid request" }, 400);
      }
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(process.env.PORT || 3000, "0.0.0.0");

client.once("ready", () => {
  console.log(`✅ CASS AI is online as ${client.user.tag}`);
});

client.on("messageCreate", async message => {
  if (message.author.bot) return;

  const mentioned = message.mentions.has(client.user);
  const isDM = !message.guild;
  if (!mentioned && !isDM) return;

  const prompt = message.content.replace(/<@!?\d+>/g, "").trim();

  if (!prompt) {
    return message.reply("هلا! أنا كاس Ai 🤖 كيف أقدر أساعدك؟");
  }

  try {
    await message.channel.sendTyping();

    const response = await createFreeAIResponse([
      { role: "system", content: personality },
      { role: "user", content: prompt }
    ]);

    const content = response.choices?.[0]?.message?.content;
    const answer = typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content.map(part => part.text || "").join("")
        : "ما قدرت أطلع إجابة.";

    for (let i = 0; i < answer.length; i += 1900) {
      await message.reply(answer.slice(i, i + 1900));
    }
  } catch (error) {
    console.error("Free OpenRouter Error:", {
      status: error.status,
      code: error.code,
      message: error.message
    });
    await message.reply(
      "كاس مشغول حالياً بسبب ضغط على نماذج الذكاء الاصطناعي المجانية. جرّب بعد دقيقة ❤️"
    );
  }
});

client.login(process.env.DISCORD_TOKEN);
