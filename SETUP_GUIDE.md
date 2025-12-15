# Discord Ticket Bot - Complete Setup Guide

## STEP 1 — Create Your Discord Bot

1. Go to: https://discord.com/developers/applications
2. Click **New Application**
3. Name it anything (ex: Ticket Bot)
4. Go to **Bot** → click **Add Bot**
5. Enable these under **Privileged Gateway Intents**:
   - ✔ PRESENCE INTENT
   - ✔ SERVER MEMBERS INTENT
   - ✔ MESSAGE CONTENT INTENT
6. Scroll down → click **Reset Token** → copy it
   (You'll paste this in Replit later)

---

## STEP 2 — Add the Bot to Your Server

1. In the left menu, click **OAuth2 → URL Generator**
2. Check these scopes:
   - ✔ `bot`
   - ✔ `applications.commands`
3. Under **Bot Permissions** check:
   - ✔ Manage Channels
   - ✔ Manage Roles
   - ✔ Send Messages
   - ✔ Read Messages/View Channels
   - ✔ Read Message History
4. Copy the generated URL
5. Paste it into your browser
6. Add the bot to your server

---

## STEP 3 — Set Up in Replit

Your bot is already set up! Just make sure:

1. Go to the **Secrets** tab (🔐 icon in sidebar)
2. Add your bot token:
   - **Key:** `DISCORD_BOT_TOKEN`
   - **Value:** your Discord bot token from Step 1
3. Click the **Run** button to start the bot

---

## STEP 4 — Make It 24/7 FREE (UptimeRobot)

This keeps your bot running forever for free!

1. Go to https://uptimerobot.com
2. Create a free account
3. Click **Add New Monitor**
4. Choose **HTTP(s)**
5. Name it anything (ex: "Ticket Bot")
6. Paste your Replit project URL (shown in the webview panel)
7. Set monitor interval to **5 minutes**
8. Save

**Now your bot is 24/7 forever — 100% free!**

---

## STEP 5 — Set Up Roles & Channels In Your Discord Server

Inside your Discord server:

1. Create a role for hosts (ex: `Host` or `Staff`)
2. Create a channel for dodge logs (ex: `#dodge-logs`)
3. In any channel, run these commands:

```
/sethosts @Host
/setdodgechannel #dodge-logs
```

---

## STEP 6 — Post Your Ticket Panel

In the channel where you want the ticket button to appear, run:

```
/setup
```

A panel will appear with a **Create Ticket** button!

---

## Available Commands

| Command | Description | Who Can Use |
|---------|-------------|-------------|
| `/setup` | Creates the ticket panel with button | Admins |
| `/sethosts @role1 @role2 @role3` | Set host roles (up to 3) | Admins |
| `/setdodgechannel #channel` | Set where dodge reports go | Admins |
| `/close` | Close the current ticket | Hosts only |
| `/add @user` | Add someone to the ticket | Ticket creator & Hosts |
| `/dodge @dodger @victim` | Report a dodge | Hosts only |

---

## Features

- ✔ Ticket buttons
- ✔ Private channels (only ticket creator + hosts can see)
- ✔ Host-only commands
- ✔ One ticket per user limit
- ✔ /add user to ticket
- ✔ /close tickets
- ✔ /dodge reporting
- ✔ Slash commands
- ✔ FREE 24/7 uptime

---

## Troubleshooting

**Bot not responding to commands?**
- Make sure the bot has proper permissions in your server
- Try kicking and re-adding the bot using the OAuth2 URL

**Commands not showing up?**
- Wait a few minutes - Discord caches slash commands
- Make sure the bot is online (check Replit)

**Tickets not creating?**
- Run `/sethosts` first to set up host roles
- Check bot has "Manage Channels" permission

**UptimeRobot not working?**
- Make sure you copied the correct Replit URL
- The URL should end with `.replit.dev`

---

## Done!

Your Discord Ticket Bot is now fully working with FREE 24/7 uptime!
