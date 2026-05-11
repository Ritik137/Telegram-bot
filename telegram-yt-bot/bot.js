const fs = require("fs");
const path = require("path");

require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const ytDlp = require("yt-dlp-exec");
const connectDB = require("./config/db");
const botController = require("./controllers/botController");
const User = require("./models/userModel.js");

connectDB();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

/* ================= START ================= */
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(
    chatId,
    `
👋 Welcome to *Y-V Downloader Bot*

🔥 *What I can do:*
🎵 Download songs by name  
📎 Download from YouTube links  
🎧 Audio & 🎬 Video options  
📜 Track your search history  

👉 Type:
/Ritik <name> to start

or use /help 🚀
    `,
    { parse_mode: "Markdown" }
  );

  bot.sendMessage(chatId, "🚀 Continue to unlock full experience", {
    reply_markup: {
      keyboard: [
        [{ text: "🚀 Continue", request_contact: true }],
        [{ text: "Skip ⏭️" }],
      ],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
});

/* ================= CONTACT ================= */
bot.on("contact", async (msg) => {
  const userId = msg.from.id;
  const phone = msg.contact.phone_number;
  const username = msg.from.username;
  const firstName = msg.from.first_name;

  let user = await User.findOne({ telegramId: userId });

  if (!user) {
    user = new User({
      telegramId: userId,
      username,
      firstName,
      phone,
    });
  } else {
    user.phone = phone;
  }

  await user.save();

  bot.sendMessage(msg.chat.id, "✅ Setup complete! Now use /Ritik 🎵", {
    reply_markup: { remove_keyboard: true },
  });
});

/* ================= MESSAGE HANDLER ================= */
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text) return;

  // ❌ ignore commands handled separately
  if (text.startsWith("/start") || text.startsWith("/help")) return;

  if (text === "Skip ⏭️") {
    return bot.sendMessage(chatId, "👍 You can use all features!\nUse /Ritik 🎵", {
      reply_markup: { remove_keyboard: true },
    });
  }

  if (text === "/history") {
    return botController.handleHistory(bot, msg);
  }
if (text.startsWith("/play")) {
  return;
}

if (text.startsWith("/stop")) {
  return;
}
  // if (text.startsWith("/Ritik")) {
  //   console.log("Song command received:", text);
  //   return botController.handleSong(bot, msg);
  // }
  if (text.startsWith("/Ritik")) {
  console.log("Calling handleSong");
  return botController.handleSong(bot, msg);
}

  if (/youtube\.com|youtu\.be/.test(text)) {
    return botController.handleMessage(bot, msg);
  }

  bot.sendMessage(chatId, "Use /Ritik <name> 🎵");
});


bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const [type, ...rest] = query.data.split("|");
  const encodedUrl = rest.join("|");
  const url = encodedUrl ? decodeURIComponent(encodedUrl) : null;

  await bot.answerCallbackQuery(query.id);

  if (type === "select") {
    return botController.showFormatOptions(bot, chatId, url);
  }

  if (!url) {
    return bot.sendMessage(chatId, "Invalid request ❌");
  }

  const ext = type === "audio" ? "m4a" : "mp4";
  const filePath = path.join(__dirname, `temp_${Date.now()}.${ext}`);

  try {
    await bot.sendMessage(chatId, "⬇️ Downloading...");

    await ytDlp(url, {
      format:
        type === "audio"
          ? "bestaudio[ext=m4a]/bestaudio"
          : "bestvideo[ext=mp4][height<=360]+bestaudio[ext=m4a]/best[ext=mp4][height<=360]/best[height<=360]/best",
      output: filePath,
      // // ✅ audio ko mp3 mein convert karo
      // ...(type === "audio" && {
      //   extractAudio: true,
      //   audioFormat: "mp3",
      //   audioQuality: "5",
      // }),
      ffmpegLocation: path.join(__dirname, "ffmpeg", "bin"),
      mergeOutputFormat: type === "video" ? "mp4" : undefined,
      noPlaylist: true,
    });

    // ✅ File exist check
    if (!fs.existsSync(filePath)) {
      return bot.sendMessage(chatId, "❌ Download failed, file not found");
    }

    const { size } = fs.statSync(filePath);
    const maxSize = 49 * 1024 * 1024;

    if (size > maxSize) {
      fs.unlink(filePath, () => {});
      return bot.sendMessage(
        chatId,
        "⚠️ File too large (>49MB). Try a shorter video."
      );
    }

    await bot.sendMessage(chatId, "📤 Uploading...");

    if (type === "audio") {
      // ✅ Audio: file path directly (stream nahi)
      await bot.sendAudio(chatId, filePath, {
        caption: "🎧 Audio ready",
      });
    } else {
      // ✅ Video: file path directly (stream nahi) — YE MAIN FIX HAI
      await bot.sendVideo(chatId, filePath, {
        caption: "🎬 Video ready",
        supports_streaming: true,
      });
    }

  } catch (err) {
    console.error("❌ Error:", err.message);
    await bot.sendMessage(chatId, `❌ Error: ${err.message.slice(0, 100)}`);
  } finally {
    // ✅ Upload COMPLETE hone ke baad delete — safe delay ke saath
    setTimeout(() => {
      if (fs.existsSync(filePath)) {
        fs.unlink(filePath, () => console.log("🗑️ Deleted:", filePath));
      }
    }, 10000);
  }
});


/* ================= HELP ================= */
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(
    chatId,
    `
🤖 *Bot Features Guide*

🎵 /Ritik <name>
→ Search and download songs

📎 Send YouTube Link
→ Download video directly

🎧 Audio Option
→ Get song in audio format

🎬 Video Option
→ Get video in MP4 format

📜 /history
→ View your last searches

⚡ Fast Downloads

Enjoy 🚀
    `,
    { parse_mode: "Markdown" }
  );
});

/* ================= COMMANDS ================= */
bot.setMyCommands([
  { command: "start", description: "Start the bot" },
  { command: "help", description: "Show all features" },
  { command: "song", description: "Search song" },
  { command: "history", description: "Your search history" },
]);