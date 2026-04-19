const ytDlp = require("yt-dlp-exec");
const ytSearch = require("yt-search");
const User = require("../models/userModel");
const fs = require("fs");
const path = require("path");

// 🔥 Save user + search
const saveUserSearch = async (msg, query) => {
    const userId = msg.from.id;
    const username = msg.from.username;
    const firstName = msg.from.first_name;

    let user = await User.findOne({ telegramId: userId });

    if (!user) {
        user = new User({
            telegramId: userId,
            username,
            firstName,
            searches: []
        });
    }

    user.searches.push({ query });
    await user.save();
};


// 🎬 YOUTUBE LINK DOWNLOAD (AUTO DELETE)
exports.handleMessage = async (bot, msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text) return;

    const filePath = path.join(__dirname, `../temp_${Date.now()}.mp4`);

    try {
        await bot.sendMessage(chatId, "⬇️ Downloading...");

        // 🔥 download
        await ytDlp(text, {
            format: "best[ext=mp4][height<=360]",
            output: filePath
        });

        await bot.sendMessage(chatId, "📤 Uploading...");

        const { size } = fs.statSync(filePath);
        const maxSize = 49 * 1024 * 1024;

        if (size > maxSize) {
            await bot.sendMessage(chatId, "⚠️ File too large ❌");
            return;
        }

        const sendOptions = {
            caption: "🎬 Video ready",
            supports_streaming: true,
            filename: path.basename(filePath),
            contentType: "video/mp4"
        };

        // ✅ STREAM USE (IMPORTANT)
        const stream = fs.createReadStream(filePath);

        await bot.sendVideo(chatId, stream, sendOptions);

        // ✅ DELAY DELETE (IMPORTANT)
        setTimeout(() => {
            if (fs.existsSync(filePath)) {
                fs.unlink(filePath, () => console.log("🗑️ File deleted"));
            }
        }, 5000);

    } catch (err) {
        console.error(err);
        await bot.sendMessage(chatId, "Error ❌");
    }
};

// 🎵 SONG SEARCH
exports.handleSong = async (bot, msg) => {
    const chatId = msg.chat.id;
    const text = msg.text.replace("/song", "").trim();

    if (!text) {
        return bot.sendMessage(chatId, "Use: /song <name> 🎵");
    }

    try {
        await bot.sendMessage(chatId, "🔍 Searching...");

        // 🔥 save DB
        await saveUserSearch(msg, text);

        const result = await ytSearch(text);
        const videos = result.videos.slice(0, 5);

        if (!videos.length) {
            return bot.sendMessage(chatId, "No results ❌");
        }

        const buttons = videos.map(v => ([
            {
                text: v.title.substring(0, 30),
                callback_data: `select|${encodeURIComponent(v.url)}`
            }
        ]));

        await bot.sendMessage(chatId, "🎵 Select song:", {
            reply_markup: {
                inline_keyboard: buttons
            }
        });

    } catch (err) {
        console.error(err);
        bot.sendMessage(chatId, "Error ❌");
    }
};


// 🎯 FORMAT SELECT
exports.showFormatOptions = async (bot, chatId, url) => {
    const encodedUrl = encodeURIComponent(url);
    await bot.sendMessage(chatId, "Choose format:", {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "🎧 Audio", callback_data: `audio|${encodedUrl}` },
                    { text: "🎬 Video", callback_data: `video|${encodedUrl}` }
                ]
            ]
        }
    });
};

exports.handleHistory = async (bot, msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        const user = await User.findOne({ telegramId: userId });

        if (!user || user.searches.length === 0) {
            return bot.sendMessage(chatId, "📭 No history found");
        }

        // last 5 searches
        const history = user.searches
            .slice(-5)
            .reverse()
            .map((item, index) => `${index + 1}. ${item.query}`)
            .join("\n");

        bot.sendMessage(chatId, `📜 Your recent searches:\n\n${history}`);

    } catch (err) {
        console.error(err);
        bot.sendMessage(chatId, "Error ❌");
    }
};