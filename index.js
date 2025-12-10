const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  REST,
  Routes
} = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');

// Express server for UptimeRobot / Railway health checks
const app = express();
const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => {
  res.send('Bot is alive!');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Keep-alive server running on port ${PORT}`);
  console.log(`UptimeRobot can ping: http://0.0.0.0:${PORT}/ or /health`);
});

const DATA_DIR = './data';
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const MATCHES_FILE = path.join(DATA_DIR, 'matches.json');
const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadData(filePath, defaultValue) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error(`Error loading ${filePath}:`, error);
  }
  return defaultValue;
}

function saveData(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Error saving ${filePath}:`, error);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel, Partials.Message]
});

const guildSettingsData = loadData(SETTINGS_FILE, {});
const activeMatchesData = loadData(MATCHES_FILE, {});
const playerStatsData = loadData(PLAYERS_FILE, {});

const guildSettings = new Map(Object.entries(guildSettingsData));
const activeMatches = new Map(Object.entries(activeMatchesData));
const playerStats = new Map(Object.entries(playerStatsData));

function saveSettings() {
  saveData(SETTINGS_FILE, Object.fromEntries(guildSettings));
}

function saveMatches() {
  saveData(MATCHES_FILE, Object.fromEntries(activeMatches));
}

function savePlayers() {
  saveData(PLAYERS_FILE, Object.fromEntries(playerStats));
}

function getPlayerKey(guildId, userId) {
  return `${guildId}-${userId}`;
}

function getRankFromElo(elo) {
  if (elo >= 1600) return { name: 'DIAMOND', emoji: '💎', color: 0x00BFFF };
  if (elo >= 1400) return { name: 'PLATINUM', emoji: '🏆', color: 0xE5E4E2 };
  if (elo >= 1200) return { name: 'GOLD', emoji: '🥇', color: 0xFFD700 };
  if (elo >= 1000) return { name: 'SILVER', emoji: '🥈', color: 0xC0C0C0 };
  if (elo >= 800) return { name: 'BRONZE', emoji: '🥉', color: 0xCD7F32 };
  return { name: 'UNRANKED', emoji: '⚪', color: 0x808080 };
}

function getPlayerStats(guildId, userId) {
  const key = `${guildId}-${userId}`;
  if (!playerStats.has(key)) {
    playerStats.set(key, {
      userId: userId,
      guildId: guildId,
      wins: 0,
      losses: 0,
      currentStreak: 0,
      autoWinStreak: 0,
      autoLoseStreak: 0,
      elo: 800
    });
    savePlayers();
  }
  const stats = playerStats.get(key);
  if (stats.elo === undefined) {
    stats.elo = 800;
    savePlayers();
  }
  return stats;
}

function updatePlayerStats(guildId, userId, won) {
  const stats = getPlayerStats(guildId, userId);

  let actualResult = won;
  let wasOverridden = false;

  if (stats.autoWinStreak > 0) {
    actualResult = true;
    stats.autoWinStreak--;
    wasOverridden = true;
  } else if (stats.autoLoseStreak > 0) {
    actualResult = false;
    stats.autoLoseStreak--;
    wasOverridden = true;
  }

  if (actualResult) {
    stats.wins++;
    if (stats.currentStreak >= 0) {
      stats.currentStreak++;
    } else {
      stats.currentStreak = 1;
    }
  } else {
    stats.losses++;
    if (stats.currentStreak <= 0) {
      stats.currentStreak--;
    } else {
      stats.currentStreak = -1;
    }
  }

  savePlayers();
  return { stats, actualResult, wasOverridden };
}

const commands = [
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Set up the ranked panel with match buttons')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('sethosts')
    .setDescription('Set the host roles that can manage matches')
    .addRoleOption(option =>
      option.setName('role1')
        .setDescription('First host role')
        .setRequired(true))
    .addRoleOption(option =>
      option.setName('role2')
        .setDescription('Second host role (optional)')
        .setRequired(false))
    .addRoleOption(option =>
      option.setName('role3')
        .setDescription('Third host role (optional)')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('setcategory')
    .setDescription('Set the category where match channels will be created')
    .addChannelOption(option =>
      option.setName('category')
        .setDescription('The category for match channels')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('setlogchannel')
    .setDescription('Set the channel where match results will be logged')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('The channel for match logs')
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('close')
    .setDescription('Close the current match (hosts only)'),

  new SlashCommandBuilder()
    .setName('add')
    .setDescription('Add a user to this match')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to add to this match')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('win')
    .setDescription('Report a win for a player (hosts only)')
    .addUserOption(option =>
      option.setName('winner')
        .setDescription('The player who won')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('lose')
    .setDescription('Report a loss for a player (hosts only)')
    .addUserOption(option =>
      option.setName('loser')
        .setDescription('The player who lost')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('setstreak')
    .setDescription('Set auto win/lose streak for a player (hosts only)')
    .addUserOption(option =>
      option.setName('player')
        .setDescription('The player to set streak for')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Type of streak')
        .setRequired(true)
        .addChoices(
          { name: 'Auto Win', value: 'win' },
          { name: 'Auto Lose', value: 'lose' }
        ))
    .addIntegerOption(option =>
      option.setName('count')
        .setDescription('Number of games for the streak (0 to clear)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(100)),

  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View player stats')
    .addUserOption(option =>
      option.setName('player')
        .setDescription('The player to view stats for (leave empty for yourself)')
        .setRequired(false)),

  new SlashCommandBuilder()
    .setName('viewhosts')
    .setDescription('View the current host roles'),

  new SlashCommandBuilder()
    .setName('clearstreak')
    .setDescription('Clear all streaks for a player (hosts only)')
    .addUserOption(option =>
      option.setName('player')
        .setDescription('The player to clear streaks for')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('addelo')
    .setDescription('Add ELO to a player (hosts only)')
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Amount of ELO to add')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(1000))
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to add ELO to')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('removeelo')
    .setDescription('Remove ELO from a player (hosts only)')
    .addIntegerOption(option =>
      option.setName('amount')
        .setDescription('Amount of ELO to remove')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(1000))
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to remove ELO from')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('eloleaderboard')
    .setDescription('View the top 10 ELO leaderboard')
].map(command => command.toJSON());

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  console.log(`Bot is in ${client.guilds.cache.size} servers`);
  console.log(`Loaded ${guildSettings.size} guild settings`);
  console.log(`Loaded ${activeMatches.size} active matches`);
  console.log(`Loaded ${playerStats.size} player stats`);

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
});

function getSettings(guildId) {
  if (!guildSettings.has(guildId)) {
    guildSettings.set(guildId, {
      hostRoles: [],
      logChannel: null,
      matchCategory: null
    });
    saveSettings();
  }
  return guildSettings.get(guildId);
}

function isHost(member, guildId) {
  const settings = getSettings(guildId);
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return settings.hostRoles.some(roleId => member.roles.cache.has(roleId));
}

function getMatchData(channelId) {
  return activeMatches.get(channelId) || null;
}

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const { commandName, guild, member, channel } = interaction;
    const settings = getSettings(guild.id);

    if (commandName === 'setup') {
      const embed = new EmbedBuilder()
        .setColor(0x8B0000)
        .setTitle('🎮 Ranked Matches')
        .setDescription('Use this panel to initiate a ranked challenge.\n\n• **1v1 Ranked** - Challenge a single opponent\n• **2v2 Ranked** - Team up with a friend and challenge two opponents\n\nThe bot will create a private channel in the configured category.')
        .addFields(
          { name: '🎮 1v1 Ranked', value: 'Create a solo ranked match', inline: false },
          { name: '🎮 2v2 Ranked', value: 'Team up with a friend', inline: false }
        )
        .setFooter({ text: 'Ranked System' });

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('start_1v1')
            .setLabel('Start 1v1')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('start_2v2')
            .setLabel('Start 2v2')
            .setStyle(ButtonStyle.Danger)
        );

      await interaction.reply({ embeds: [embed], components: [row] });
    }

    else if (commandName === 'sethosts') {
      const roles = [];
      const role1 = interaction.options.getRole('role1');
      const role2 = interaction.options.getRole('role2');
      const role3 = interaction.options.getRole('role3');

      if (role1) roles.push(role1.id);
      if (role2) roles.push(role2.id);
      if (role3) roles.push(role3.id);

      settings.hostRoles = roles;
      saveSettings();

      const roleNames = roles.map(id => `<@&${id}>`).join(', ');

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('Host Roles Updated')
        .setDescription(`The following roles can now manage matches:\n${roleNames}`);

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    else if (commandName === 'setcategory') {
      const category = interaction.options.getChannel('category');
      if (category.type !== ChannelType.GuildCategory) {
        return interaction.reply({
          content: 'Please select a category channel, not a text channel.',
          ephemeral: true
        });
      }
      settings.matchCategory = category.id;
      saveSettings();

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('Category Set')
        .setDescription(`Match channels will now be created in ${category}`);

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    else if (commandName === 'setlogchannel') {
      const logChannel = interaction.options.getChannel('channel');
      settings.logChannel = logChannel.id;
      saveSettings();

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('Log Channel Set')
        .setDescription(`Match results will now be logged to ${logChannel}`);

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    else if (commandName === 'close') {
      const matchData = getMatchData(channel.id);

      if (!matchData) {
        return interaction.reply({ 
          content: 'This command can only be used in a match channel.', 
          ephemeral: true 
        });
      }

      if (!isHost(member, guild.id)) {
        return interaction.reply({ 
          content: 'Only hosts can close matches.', 
          ephemeral: true 
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('Match Closed')
        .setDescription('This match has been closed by a host.\nThis channel will be deleted in 5 seconds.');

      await interaction.reply({ embeds: [embed] });

      activeMatches.delete(channel.id);
      saveMatches();

      setTimeout(async () => {
        try {
          await channel.delete();
        } catch (error) {
          console.error('Error deleting channel:', error);
        }
      }, 5000);
    }

    else if (commandName === 'add') {
      const matchData = getMatchData(channel.id);

      if (!matchData) {
        return interaction.reply({ 
          content: 'This command can only be used in a match channel.', 
          ephemeral: true 
        });
      }

      if (member.id !== matchData.creator && !isHost(member, guild.id)) {
        return interaction.reply({ 
          content: 'Only the match creator or hosts can add users.', 
          ephemeral: true 
        });
      }

      const userToAdd = interaction.options.getUser('user');

      try {
        await channel.permissionOverwrites.create(userToAdd.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true
        });

        if (!matchData.participants.includes(userToAdd.id)) {
          matchData.participants.push(userToAdd.id);
          saveMatches();
        }

        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('User Added')
          .setDescription(`${userToAdd} has been added to this match.`);

        await interaction.reply({ embeds: [embed] });
      } catch (error) {
        console.error('Error adding user:', error);
        await interaction.reply({ 
          content: 'Failed to add user to this match.', 
          ephemeral: true 
        });
      }
    }

    else if (commandName === 'win') {
      if (!isHost(member, guild.id)) {
        return interaction.reply({ 
          content: 'Only hosts can use this command.', 
          ephemeral: true 
        });
      }

      const winner = interaction.options.getUser('winner');
      const { stats, actualResult, wasOverridden } = updatePlayerStats(guild.id, winner.id, true);

      const streakText = stats.currentStreak > 0 
        ? `${stats.currentStreak} Win Streak` 
        : stats.currentStreak < 0 
          ? `${Math.abs(stats.currentStreak)} Lose Streak`
          : 'No Streak';

      let footerText = 'Good game!';
      if (wasOverridden && !actualResult) {
        footerText = 'Auto Lose Streak applied - result was converted to a loss!';
      } else if (stats.autoWinStreak > 0) {
        footerText = `Auto Win Streak: ${stats.autoWinStreak} games remaining`;
      } else if (stats.autoLoseStreak > 0) {
        footerText = `Auto Lose Streak: ${stats.autoLoseStreak} games remaining`;
      }

      const resultTitle = actualResult ? 'Win Recorded' : 'Loss Recorded (Auto Streak Override)';
      const resultDesc = actualResult 
        ? `${winner} has been awarded a win!`
        : `${winner} was given a loss due to Auto Lose Streak!`;

      const embed = new EmbedBuilder()
        .setColor(actualResult ? 0x57F287 : 0xED4245)
        .setTitle(resultTitle)
        .setDescription(resultDesc)
        .addFields(
          { name: 'Total Wins', value: `${stats.wins}`, inline: true },
          { name: 'Total Losses', value: `${stats.losses}`, inline: true },
          { name: 'Current Streak', value: streakText, inline: true }
        )
        .setFooter({ text: footerText });

      await interaction.reply({ embeds: [embed] });

      if (settings.logChannel) {
        const logChannel = guild.channels.cache.get(settings.logChannel);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor(actualResult ? 0x57F287 : 0xED4245)
            .setTitle('Match Result')
            .setDescription(`**${winner}** ${actualResult ? 'won' : 'lost'} a match!${wasOverridden ? ' (Auto Streak)' : ''}`)
            .addFields(
              { name: 'Reported By', value: `${member}`, inline: true },
              { name: 'New Record', value: `${stats.wins}W - ${stats.losses}L`, inline: true }
            )
            .setTimestamp();
          await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }
      }
    }

    else if (commandName === 'lose') {
      if (!isHost(member, guild.id)) {
        return interaction.reply({ 
          content: 'Only hosts can use this command.', 
          ephemeral: true 
        });
      }

      const loser = interaction.options.getUser('loser');
      const { stats, actualResult, wasOverridden } = updatePlayerStats(guild.id, loser.id, false);

      const streakText = stats.currentStreak < 0 
        ? `${Math.abs(stats.currentStreak)} Lose Streak` 
        : stats.currentStreak > 0 
          ? `${stats.currentStreak} Win Streak`
          : 'No Streak';

      let footerText = 'Better luck next time!';
      if (wasOverridden && actualResult) {
        footerText = 'Auto Win Streak applied - result was converted to a win!';
      } else if (stats.autoWinStreak > 0) {
        footerText = `Auto Win Streak: ${stats.autoWinStreak} games remaining`;
      } else if (stats.autoLoseStreak > 0) {
        footerText = `Auto Lose Streak: ${stats.autoLoseStreak} games remaining`;
      }

      const resultTitle = !actualResult ? 'Loss Recorded' : 'Win Recorded (Auto Streak Override)';
      const resultDesc = !actualResult 
        ? `${loser} has been given a loss.`
        : `${loser} was awarded a win due to Auto Win Streak!`;

      const embed = new EmbedBuilder()
        .setColor(!actualResult ? 0xED4245 : 0x57F287)
        .setTitle(resultTitle)
        .setDescription(resultDesc)
        .addFields(
          { name: 'Total Wins', value: `${stats.wins}`, inline: true },
          { name: 'Total Losses', value: `${stats.losses}`, inline: true },
          { name: 'Current Streak', value: streakText, inline: true }
        )
        .setFooter({ text: footerText });

      await interaction.reply({ embeds: [embed] });

      if (settings.logChannel) {
        const logChannel = guild.channels.cache.get(settings.logChannel);
        if (logChannel) {
          const logEmbed = new EmbedBuilder()
            .setColor(!actualResult ? 0xED4245 : 0x57F287)
            .setTitle('Match Result')
            .setDescription(`**${loser}** ${actualResult ? 'won' : 'lost'} a match!${wasOverridden ? ' (Auto Streak)' : ''}`)
            .addFields(
              { name: 'Reported By', value: `${member}`, inline: true },
              { name: 'New Record', value: `${stats.wins}W - ${stats.losses}L`, inline: true }
            )
            .setTimestamp();
          await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }
      }
    }

    else if (commandName === 'setstreak') {
      if (!isHost(member, guild.id)) {
        return interaction.reply({ 
          content: 'Only hosts can use this command.', 
          ephemeral: true 
        });
      }

      const player = interaction.options.getUser('player');
      const streakType = interaction.options.getString('type');
      const count = interaction.options.getInteger('count');

      const stats = getPlayerStats(guild.id, player.id);

      if (streakType === 'win') {
        stats.autoWinStreak = count;
        stats.autoLoseStreak = 0;
      } else {
        stats.autoLoseStreak = count;
        stats.autoWinStreak = 0;
      }

      savePlayers();

      const typeText = streakType === 'win' ? 'Auto Win' : 'Auto Lose';
      const actionText = count === 0 ? 'cleared' : `set to ${count} games`;

      const embed = new EmbedBuilder()
        .setColor(streakType === 'win' ? 0x57F287 : 0xED4245)
        .setTitle('Streak Updated')
        .setDescription(`${typeText} streak for ${player} has been ${actionText}.`)
        .addFields(
          { name: 'Auto Win Streak', value: `${stats.autoWinStreak} games`, inline: true },
          { name: 'Auto Lose Streak', value: `${stats.autoLoseStreak} games`, inline: true }
        );

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    else if (commandName === 'clearstreak') {
      if (!isHost(member, guild.id)) {
        return interaction.reply({ 
          content: 'Only hosts can use this command.', 
          ephemeral: true 
        });
      }

      const player = interaction.options.getUser('player');
      const stats = getPlayerStats(guild.id, player.id);

      stats.autoWinStreak = 0;
      stats.autoLoseStreak = 0;
      stats.currentStreak = 0;
      savePlayers();

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Streaks Cleared')
        .setDescription(`All streaks for ${player} have been cleared.`);

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    else if (commandName === 'stats') {
      const player = interaction.options.getUser('player') || member.user;
      const stats = getPlayerStats(guild.id, player.id);
      const rank = getRankFromElo(stats.elo);

      let streakText = 'No Streak';
      if (stats.currentStreak > 0) {
        streakText = `${stats.currentStreak} Win Streak`;
      } else if (stats.currentStreak < 0) {
        streakText = `${Math.abs(stats.currentStreak)} Lose Streak`;
      }

      const winRate = stats.wins + stats.losses > 0 
        ? ((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(1) 
        : '0.0';

      const embed = new EmbedBuilder()
        .setColor(rank.color)
        .setTitle(`${rank.emoji} Stats for ${player.username}`)
        .setDescription(`**Rank:** ${rank.emoji} ${rank.name}\n**ELO:** ${stats.elo}`)
        .addFields(
          { name: 'Wins', value: `${stats.wins}`, inline: true },
          { name: 'Losses', value: `${stats.losses}`, inline: true },
          { name: 'Win Rate', value: `${winRate}%`, inline: true },
          { name: 'Current Streak', value: streakText, inline: true }
        );

      if (isHost(member, guild.id)) {
        embed.addFields(
          { name: 'Auto Win Streak', value: `${stats.autoWinStreak} games`, inline: true },
          { name: 'Auto Lose Streak', value: `${stats.autoLoseStreak} games`, inline: true }
        );
      }

      await interaction.reply({ embeds: [embed] });
    }

    else if (commandName === 'addelo') {
      if (!isHost(member, guild.id)) {
        return interaction.reply({ 
          content: 'Only hosts can use this command.', 
          ephemeral: true 
        });
      }

      const amount = interaction.options.getInteger('amount');
      const user = interaction.options.getUser('user');
      const stats = getPlayerStats(guild.id, user.id);
      const oldRank = getRankFromElo(stats.elo);
      
      stats.elo += amount;
      savePlayers();
      
      const newRank = getRankFromElo(stats.elo);
      const rankChanged = oldRank.name !== newRank.name;

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('ELO Added')
        .setDescription(`${user} has received **+${amount}** ELO!`)
        .addFields(
          { name: 'New ELO', value: `${stats.elo}`, inline: true },
          { name: 'Rank', value: `${newRank.emoji} ${newRank.name}`, inline: true }
        );

      if (rankChanged) {
        embed.addFields({ name: '🎉 Rank Up!', value: `${oldRank.name} → ${newRank.name}`, inline: false });
      }

      await interaction.reply({ embeds: [embed] });
    }

    else if (commandName === 'removeelo') {
      if (!isHost(member, guild.id)) {
        return interaction.reply({ 
          content: 'Only hosts can use this command.', 
          ephemeral: true 
        });
      }

      const amount = interaction.options.getInteger('amount');
      const user = interaction.options.getUser('user');
      const stats = getPlayerStats(guild.id, user.id);
      const oldRank = getRankFromElo(stats.elo);
      
      stats.elo = Math.max(0, stats.elo - amount);
      savePlayers();
      
      const newRank = getRankFromElo(stats.elo);
      const rankChanged = oldRank.name !== newRank.name;

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('ELO Removed')
        .setDescription(`${user} has lost **-${amount}** ELO.`)
        .addFields(
          { name: 'New ELO', value: `${stats.elo}`, inline: true },
          { name: 'Rank', value: `${newRank.emoji} ${newRank.name}`, inline: true }
        );

      if (rankChanged) {
        embed.addFields({ name: '📉 Rank Down', value: `${oldRank.name} → ${newRank.name}`, inline: false });
      }

      await interaction.reply({ embeds: [embed] });
    }

    else if (commandName === 'eloleaderboard') {
      const guildPlayers = [];
      
      for (const [key, stats] of playerStats) {
        if (stats.guildId === guild.id) {
          guildPlayers.push(stats);
        }
      }

      guildPlayers.sort((a, b) => b.elo - a.elo);
      const top10 = guildPlayers.slice(0, 10);

      if (top10.length === 0) {
        return interaction.reply({
          content: 'No players have been registered yet!',
          ephemeral: true
        });
      }

      let leaderboardText = '';
      const medals = ['🥇', '🥈', '🥉'];

      for (let i = 0; i < top10.length; i++) {
        const player = top10[i];
        const rank = getRankFromElo(player.elo);
        const position = i < 3 ? medals[i] : `**${i + 1}.**`;
        leaderboardText += `${position} <@${player.userId}> - ${player.elo} ELO ${rank.emoji} ${rank.name}\n`;
      }

      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🏆 ELO Leaderboard - Top 10')
        .setDescription(leaderboardText)
        .addFields(
          { name: '📊 Rank Tiers', value: 
            '💎 DIAMOND: 1600-1700\n🏆 PLATINUM: 1400-1500\n🥇 GOLD: 1200-1300\n🥈 SILVER: 1000-1100\n🥉 BRONZE: 800-900', inline: false }
        )
        .setFooter({ text: 'Each win grants ELO to climb ranks!' });

      await interaction.reply({ embeds: [embed] });
    }

    else if (commandName === 'viewhosts') {
      const roleNames = settings.hostRoles.length > 0 
        ? settings.hostRoles.map(id => `<@&${id}>`).join('\n') 
        : 'No host roles set';

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Current Host Roles')
        .setDescription(roleNames)
        .setFooter({ text: 'Use /sethosts to change host roles' });

      await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
    }
  }

  else if (interaction.isButton()) {
    const { guild, member } = interaction;
    const settings = getSettings(guild.id);

    if (interaction.customId === 'start_1v1' || interaction.customId === 'start_2v2') {
      const matchType = interaction.customId === 'start_1v1' ? '1v1' : '2v2';

      if (settings.hostRoles.length === 0) {
        return interaction.reply({ 
          content: 'Host roles have not been configured. An administrator needs to use /sethosts first.', 
          ephemeral: true 
        });
      }

      try {
        const permissionOverwrites = [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: member.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory
            ]
          },
          {
            id: client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.ReadMessageHistory
            ]
          }
        ];

        for (const roleId of settings.hostRoles) {
          permissionOverwrites.push({
            id: roleId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageChannels
            ]
          });
        }

        const channelOptions = {
          name: `${matchType}-${member.user.username}`,
          type: ChannelType.GuildText,
          permissionOverwrites: permissionOverwrites
        };

        if (settings.matchCategory) {
          channelOptions.parent = settings.matchCategory;
        }

        const matchChannel = await guild.channels.create(channelOptions);

        const matchData = {
          type: matchType,
          creator: member.id,
          participants: [member.id],
          createdAt: Date.now()
        };

        activeMatches.set(matchChannel.id, matchData);
        saveMatches();

        const playerCount = matchType === '1v1' ? '2 players' : '4 players';

        const welcomeEmbed = new EmbedBuilder()
          .setColor(0x8B0000)
          .setTitle(`${matchType} Ranked Match`)
          .setDescription(`Welcome ${member}!\n\nA host will be with you shortly. Please wait for your opponent(s) to join.\n\n**Match Type:** ${matchType} (${playerCount})\n\n**Commands:**\n• \`/add @user\` - Add someone to this match\n• \`/stats\` - View your stats`)
          .setFooter({ text: 'Please be patient while waiting for a host' });

        await matchChannel.send({ 
          content: `${member} ${settings.hostRoles.map(id => `<@&${id}>`).join(' ')}`,
          embeds: [welcomeEmbed] 
        });

        await interaction.reply({ 
          content: `Your ${matchType} ranked match has been created: ${matchChannel}`, 
          ephemeral: true 
        });

      } catch (error) {
        console.error('Error creating match:', error);
        await interaction.reply({ 
          content: 'Failed to create match. Please try again or contact an administrator.', 
          ephemeral: true 
        }).catch(() => {});
      }
    }
  }
});

client.on('error', (error) => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

if (!process.env.DISCORD_BOT_TOKEN) {
  console.error('ERROR: DISCORD_BOT_TOKEN is not set!');
  console.log('Please add your Discord bot token as a secret named DISCORD_BOT_TOKEN');
  process.exit(1);
}

client.login(process.env.DISCORD_BOT_TOKEN);

