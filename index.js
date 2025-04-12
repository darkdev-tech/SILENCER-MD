import dotenv from 'dotenv';
dotenv.config();

import {
    makeWASocket,
    Browsers,
    fetchLatestBaileysVersion,
    DisconnectReason,
    useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import { Handler, Callupdate, GroupUpdate } from './data/index.js';
import express from 'express';
import pino from 'pino';
import fs from 'fs';
import NodeCache from 'node-cache';
import path from 'path';
import chalk from 'chalk';
import moment from 'moment-timezone';
import axios from 'axios';
import config from './config.cjs';
import pkg from './lib/autoreact.cjs';
const { emojis, doReact } = pkg;

const sessionName = "session";
const app = express();
const orange = chalk.bold.hex("#FFA500");
const lime = chalk.bold.hex("#32CD32");
let useQR = false;
let initialConnection = true;
const PORT = process.env.PORT || 3000;

const MAIN_LOGGER = pino({
    timestamp: () => `,"time":"${new Date().toJSON()}"`
});
const logger = MAIN_LOGGER.child({});
logger.level = "trace";

const msgRetryCounterCache = new NodeCache();
const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);

const sessionDir = path.join(__dirname, 'session');
const credsPath = path.join(sessionDir, 'creds.json');

if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
}

// AntiDelete Feature Settings
const settingsPath = path.join(__dirname, 'plugins/settings.json');
let settings = { ANTIDELETE: true };
if (fs.existsSync(settingsPath)) {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
}

async function downloadSessionData() {
    if (!config.SESSION_ID) {
        console.error('Please add your session to SESSION_ID env !!');
        return false;
    }
    const sessdata = config.SESSION_ID.split("COOLKID~")[1];
    const url = `https://pastebin.com/raw/${sessdata}`;
    try {
        const response = await axios.get(url);
        const data = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        await fs.promises.writeFile(credsPath, data);
        console.log("🔒 Session Successfully Loaded !!");
        return true;
    } catch (error) {
        return false;
    }
}

async function start() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(`cool-kid xmd using WA v${version.join('.')}, isLatest: ${isLatest}`);
        
        const Matrix = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: useQR,
            browser: ["demon", "safari", "3.3"],
            auth: state,
            getMessage: async (key) => {
                if (store) {
                    const msg = await store.loadMessage(key.remoteJid, key.id);
                    return msg.message || undefined;
                }
                return { conversation: "cool-kid xmd bot whatsapp user bot" };
            }
        });

        Matrix.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                if (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                    start();
                }
            } else if (connection === 'open') {
                if (initialConnection) {
                    console.log(chalk.green("COOL KID XMD CONNECTED SUCCESSFULLY"));
                    await Matrix.sendMessage(Matrix.user.id, { 
                        image: { url: "https://files.catbox.moe/ldetco.jpg" }, 
                        caption: `╭─────────────━┈⊷
│ *COOL-KID XMD*
╰─────────────━┈⊷

╭─────────────━┈⊷
│ *ᴄᴏᴏʟ-ᴋɪᴅ xᴍᴅ ʙᴏᴛ ᴄᴏɴɴᴇᴄᴛᴇᴅ sᴜᴄᴄᴇssғᴜʟʟʏ*
│ ⚠️ Join our support group to avoid disconnection:
│🔗 https://whatsapp.com/channel/0029VarDt9t30LKL1SoYXy26
│
╰─────────────━┈⊷

> *ʀᴇɢᴀʀᴅs ᴄᴏᴏʟ_ᴋɪᴅ *`
                    });
                    initialConnection = false;
                } else {
                    console.log(chalk.blue("Connection reestablished after restart."));
                }
            }
        });

        Matrix.ev.on('creds.update', saveCreds);

        // AntiDelete Feature
        Matrix.ev.on('messages.update', async (updates) => {
            for (const update of updates) {
                if (settings.ANTIDELETE && update.messageStubType === 68) {
                    const sender = update.key.participant || update.key.remoteJid;
                    const messageType = update.message ? Object.keys(update.message)[0] : "Unknown";

                    let messageText = `🚨 *Antidelete Activated* 🚨\n\n`;
                    messageText += `👤 *Sender:* @${sender.split('@')[0]}\n`;
                    messageText += `💬 *Message Type:* ${messageType}\n\n`;

                    if (update.message?.conversation) {
                        messageText += `📜 *Deleted Message:* ${update.message.conversation}\n\n`;
                    } else if (update.message?.extendedTextMessage) {
                        messageText += `📜 *Deleted Message:* ${update.message.extendedTextMessage.text}\n\n`;
                    }

                    messageText += `🔹 *Regards, ᴄᴏᴏʟ-ᴋɪᴅ*`;

                    await Matrix.sendMessage(update.key.remoteJid, { text: messageText, mentions: [sender] });
                }
            }
        });

        // Owner Command to Enable/Disable AntiDelete
        Matrix.ev.on('messages.upsert', async (chatUpdate) => {
            try {
                const mek = chatUpdate.messages[0];

                if (mek.key.fromMe && mek.message?.conversation) {
                    const text = mek.message.conversation.toLowerCase();
                    if (text === "antidelete on") {
                        settings.ANTIDELETE = true;
                        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
                        await Matrix.sendMessage(mek.key.remoteJid, { text: "✅ *Antidelete is now ON*" });
                    } else if (text === "antidelete off") {
                        settings.ANTIDELETE = false;
                        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
                        await Matrix.sendMessage(mek.key.remoteJid, { text: "❌ *Antidelete is now OFF*" });
                    }
                }

            } catch (err) {
                console.error('Error during message processing:', err);
            }
        });

        Matrix.ev.on("messages.upsert", async chatUpdate => await Handler(chatUpdate, Matrix, logger));
        Matrix.ev.on("call", async (json) => await Callupdate(json, Matrix));
        Matrix.ev.on("group-participants.update", async (messag) => await GroupUpdate(Matrix, messag));

    } catch (error) {
        console.error('Critical Error:', error);
        process.exit(1);
    }
}

async function init() {
    if (fs.existsSync(credsPath)) {
        console.log("🔒 Session file found, proceeding without QR code.");
        await start();
    } else {
        const sessionDownloaded = await downloadSessionData();
        if (sessionDownloaded) {
            await start();
        } else {
            useQR = true;
            await start();
        }
    }
}

init();

app.get('/', (req, res) => {
    res.send('CONNECTED SUCCESSFULLY');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
