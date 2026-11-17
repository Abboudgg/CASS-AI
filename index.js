
const {
  Client,
  GatewayIntentBits,
  Partials
} = require("discord.js");

const { GoogleGenAI } = require("@google/genai");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

client.once("ready", () => {
  console.log(`✅ CASS AI is online as ${client.user.tag}`);
});

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

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt
    });

    const answer = response.text || "ما قدرت أطلع إجابة.";

    for (let i = 0; i < answer.length; i += 1900) {
      await message.reply(answer.slice(i, i + 1900));
    }

  } catch (error) {
    console.error("Gemini Error:", error);
    await message.reply("عذراً، حصل خطأ أثناء الرد. حاول مرة ثانية.");
  }
});

client.login(process.env.DISCORD_TOKEN);
