import TelegramBot from "node-telegram-bot-api";
import { Keypair, Connection, clusterApiUrl, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config(); // Load environment variables from .env

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const connection = new Connection(clusterApiUrl("mainnet-beta"), "confirmed");
const USERS_FILE = "users.json";

// Load user data from JSON file
const loadUsers = () => {
    if (!fs.existsSync(USERS_FILE)) return {};
    return JSON.parse(fs.readFileSync(USERS_FILE));
};

// Save user data to JSON file
const saveUsers = (users) => {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
};

// Generate a Solana wallet
const generateSolanaWallet = () => {
    const keypair = Keypair.generate();
    return {
        address: keypair.publicKey.toBase58(),
        privateKey: bs58.encode(keypair.secretKey),
    };
};

// Handle "/start" command
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name;

    let users = loadUsers();

    if (!users[userId]) {
        // Create wallet & store user info
        const wallet = generateSolanaWallet();
        users[userId] = {
            username,
            solAddress: wallet.address,
            privateKey: wallet.privateKey,
            balance: 0,
        };
        saveUsers(users);

        bot.sendMessage(
            chatId,
            `🎉 Welcome, *${username}*! Your Solana wallet has been created.\n\n` +
                `🔹 **Solana Address:** \`${wallet.address}\`\n` +
                `🔒 **Private Key:** (sent in DM, NEVER SHARE IT!)`,
            {
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: [[{ text: "Check Wallet", callback_data: "wallet" }]],
                },
            }
        );

        // Send private key in DM
        bot.sendMessage(userId, `🔑 *Your private key:* \`${wallet.privateKey}\`\n(Keep it safe!)`, { parse_mode: "Markdown" });
    } else {
        bot.sendMessage(
            chatId,
            `👋 Welcome back, *${username}*! Your wallet is ready.\nUse the buttons below.`,
            {
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: [[{ text: "Check Wallet", callback_data: "wallet" }]],
                },
            }
        );
    }
});

// Handle "wallet" button
bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    let users = loadUsers();

    if (!users[userId]) {
        bot.answerCallbackQuery(query.id, { text: "❌ No wallet found. Use /start to create one!" });
        return;
    }

    const solAddress = users[userId].solAddress;
    const balance = await connection.getBalance(new PublicKey(solAddress));
    const solBalance = balance / 1e9;

    // Update balance in JSON
    users[userId].balance = solBalance;
    saveUsers(users);

    let buttons = [[{ text: "Deposit", callback_data: "deposit" }]];

    if (solBalance >= 0.01) {
        buttons = [
            [{ text: "Raider Mode", callback_data: "raid" }],
            [{ text: "Shill Mode", callback_data: "shill" }],
            [{ text: "Token Mode", callback_data: "token" }],
            [{ text: "Wallet", callback_data: "wallet" }],
            [{ text: "Refer", callback_data: "refer" }],
        ];
    }

    bot.sendMessage(
        chatId,
        `🏦 *Your Wallet*\n\n` +
            `🔹 **Address:** \`${solAddress}\`\n` +
            `💰 **Balance:** ${solBalance.toFixed(4)} SOL\n\n` +
            (solBalance < 0.01 ? "⚠️ Fund your wallet to unlock features!" : "🎉 You have full access!"),
        {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: buttons },
        }
    );
});

// Handle "deposit" button
bot.on("callback_query", (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    let users = loadUsers();

    if (!users[userId]) return;

    const solAddress = users[userId].solAddress;

    bot.sendMessage(
        chatId,
        `🔹 Send at least **0.01 SOL** to this address to unlock features:\n\n` +
            `\`${solAddress}\`\n\n🚀 After deposit, click the button below to refresh.`,
        {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[{ text: "Check Balance", callback_data: "wallet" }]] },
        }
    );
});

// Locked features until deposit is made
bot.on("callback_query", (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    let users = loadUsers();

    if (!users[userId] || users[userId].balance < 0.01) {
        bot.answerCallbackQuery(query.id, { text: "❌ You need to deposit at least 0.01 SOL to unlock this feature!" });
    } else {
        bot.sendMessage(chatId, "🚀 Feature coming soon!");
    }
});

// Handle "/help" command
bot.onText(/\/help/, (msg) => {
    bot.sendMessage(
        msg.chat.id,
        "**Vortex Pump Bot Commands**\n\n" +
            "🚀 /start - Create a Solana wallet\n" +
            "🏦 /wallet - Check your wallet balance\n" +
            "🎁 /refer - Get your referral link\n" +
            "🔥 /shill - Activate Shill Mode\n" +
            "💎 /raid - Activate Raider Mode\n" +
            "📊 /token - Token-related info\n" +
            "⚙️ /settings - Customize your bot settings\n" +
            "❓ /support - Get help or contact admin",
        { parse_mode: "Markdown" }
    );
});

// Bot startup message
console.log("🚀 Vortex Pump Bot is running...");
