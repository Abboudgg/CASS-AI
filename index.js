
const http = require("http");
const {
  Client,
  GatewayIntentBits,
  Partials
} = require("discord.js");

const OpenAI = require("openai");
require("dotenv").config();

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("CASS AI is alive!");
});

server.listen(process.env.PORT || 3000, "0.0.0.0");

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
  apiKey: process.env.OPENAI_API_KEY
});

client.once("ready", () => {
  console.log(`✅ CASS AI GPT is online as ${client.user.tag}`);
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

    const response = await openai.responses.create({
      model: "gpt-5.4-mini",
      instructions: "أنت CASS AI، مساعد ذكي وودود. أجب باللغة التي يستخدمها الشخص، وادعم العربية.",
      input: prompt
    });

    const answer = response.output_text || "ما قدرت أطلع إجابة.";

    for (let i = 0; i < answer.length; i += 1900) {
      await message.reply(answer.slice(i, i + 1900));
    }

  } catch (error) {
    console.error("OpenAI Error:", error);
    await message.reply("عذراً، حصل خطأ أثناء الرد. حاول مرة ثانية.");
  }
});

client.login(process.env.DISCORD_TOKEN);
