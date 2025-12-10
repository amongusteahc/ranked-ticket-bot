# Discord Ranked Match Bot

## Overview
A Discord bot for managing ranked matches (1v1 and 2v2) with player stats tracking, win/lose streaks, and auto-streak functionality that hosts can configure. Includes built-in keep-alive server for 24/7 uptime with UptimeRobot.

## Features
- Interactive panel with 1v1 and 2v2 ranked match buttons
- Private match channels created automatically
- Player stats tracking (wins, losses, win rate, streaks)
- Auto win/lose streaks that hosts can set for players
- Host-only commands for managing matches and players
- Keep-alive web server on port 5000 for UptimeRobot

## Project Structure
- `index.js` - Main bot file with all functionality + keep-alive server
- `data/settings.json` - Guild settings (host roles, log channel, category)
- `data/matches.json` - Active match channels
- `data/players.json` - Player stats and streak data

## Configuration
The bot requires a Discord Bot Token stored as a secret called `DISCORD_BOT_TOKEN`.

## Commands

### Admin Commands
- `/setup` - Set up the ranked match panel with 1v1/2v2 buttons
- `/sethosts` - Configure host roles (up to 3 roles)
- `/setcategory` - Set category for match channels
- `/setlogchannel` - Set channel for match result logs

### Host Commands
- `/close` - Close a match and delete the channel
- `/win @user` - Record a win for a player
- `/lose @user` - Record a loss for a player
- `/setstreak @player type count` - Set auto win/lose streak for a player
- `/clearstreak @player` - Clear all streaks for a player

### User Commands
- `/add @user` - Add a user to the current match
- `/stats` - View your stats (or another player's with @player)
- `/viewhosts` - View current host roles

## Auto Streak System
Hosts can set automatic win/lose streaks for players:
- `Auto Win Streak` - Player gets wins recorded automatically for X games
- `Auto Lose Streak` - Player gets losses recorded automatically for X games
- Streaks decrement after each game and can be cleared

## 24/7 Uptime with UptimeRobot
The bot includes an Express server with two endpoints:
- `/` - Returns "Bot is alive!"
- `/health` - Returns JSON with status, uptime, and timestamp

Set up UptimeRobot to ping your Replit URL every 5 minutes to keep the bot running.

## Running the Bot
Run with `npm start` or `node index.js`
