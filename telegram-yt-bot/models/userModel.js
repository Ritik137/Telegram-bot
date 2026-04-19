const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    telegramId: Number,
    username: String,
    firstName: String,
    phone: String,
    searches: [
        {
            query: String,
            date: { type: Date, default: Date.now }
        }
    ]
});

module.exports = mongoose.model("User", userSchema);