const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const admin = require("firebase-admin");
require("dotenv").config();

// 1. Firebase Realtime Database Initialization
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL:
    "https://reborn-5f1dc-default-rtdb.europe-west1.firebasedatabase.app",
});

const db = admin.database();

const MEMBERS_PATH = "iron_gates_members";
const EVENTS_PATH = "regroups/events";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once("ready", () => {
  console.log(`🤖 Iron Gates Manager is running as ${client.user.tag}!`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // ----------------------------------------------------------------
  // COMMAND /pvp [count] [target]
  // ----------------------------------------------------------------
  if (commandName === "pvp") {
    await interaction.deferReply({ ephemeral: true });

    const newPvpCount = interaction.options.getInteger("count");
    const targetUser =
      interaction.options.getUser("target") || interaction.user;
    const targetIdStr = String(targetUser.id);

    try {
      const ref = db.ref(MEMBERS_PATH);
      const snapshot = await ref.once("value");

      if (!snapshot.exists()) {
        return interaction.editReply({
          content: `❌ Path \`${MEMBERS_PATH}\` was not found or is empty. Please check the database path.`,
        });
      }

      let memberKey = null;
      let memberData = null;

      snapshot.forEach((child) => {
        const val = child.val();
        if (val && String(val.discordId) === targetIdStr) {
          memberKey = child.key;
          memberData = val;
        }
      });

      if (!memberKey || !memberData) {
        return interaction.editReply({
          content: `❌ Player <@${targetUser.id}> was not found. Please check if \`discordId\` exists in the database.`,
        });
      }

      const oldPvp = Number(memberData.pvp) || 0;

      await ref.child(memberKey).update({
        pvp: Number(newPvpCount),
        updatedAt: admin.database.ServerValue.TIMESTAMP,
      });

      const diff = newPvpCount - oldPvp;
      const diffFormatted = diff >= 0 ? `+${diff}` : `${diff}`;

      const pvpEmbed = new EmbedBuilder()
        .setColor("#6366F1")
        .setTitle("⚔️ PvP Statistics Update")
        .setDescription(
          `Successfully updated stats for **${memberData.name || targetUser.username}**`,
        )
        .addFields(
          { name: "Before", value: `${oldPvp}`, inline: true },
          { name: "After", value: `${newPvpCount}`, inline: true },
          { name: "Difference", value: diffFormatted, inline: true },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [pvpEmbed] });
    } catch (error) {
      console.error("Error in /pvp:", error);
      await interaction.editReply(
        "❌ An error occurred while updating the database.",
      );
    }
  }

  // ----------------------------------------------------------------
  // COMMAND /event
  // ----------------------------------------------------------------
  if (commandName === "event") {
    await interaction.deferReply();

    try {
      const ref = db.ref(EVENTS_PATH);
      const snapshot = await ref.once("value");

      if (!snapshot.exists()) {
        return interaction.editReply(`📅 Path \`${EVENTS_PATH}\` is empty.`);
      }

      const now = Date.now();
      const eventsList = [];

      snapshot.forEach((child) => {
        const data = child.val();
        if (!data) return;

        let rawTime =
          data.respawnTimestamp || data.timestamp || data.date || data.time;
        let eventMs = Number(rawTime);

        if (isNaN(eventMs)) {
          eventMs = Date.parse(rawTime);
        } else if (eventMs < 10000000000) {
          eventMs *= 1000;
        }

        if (eventMs && eventMs >= now) {
          eventsList.push({
            title:
              data.title || data.name || data.eventName || child.key || "Event",
            timestampMs: eventMs,
          });
        }
      });

      if (eventsList.length === 0) {
        return interaction.editReply(
          "📅 No upcoming events scheduled at the moment.",
        );
      }

      eventsList.sort((a, b) => a.timestampMs - b.timestampMs);
      const nextEvent = eventsList[0];
      const unixSeconds = Math.floor(nextEvent.timestampMs / 1000);

      // Precise time remaining calculation in English (Days, Hours, Minutes)
      const totalSeconds = Math.floor((nextEvent.timestampMs - now) / 1000);
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);

      const timeParts = [];
      if (days > 0) timeParts.push(`${days}d`);
      if (hours > 0 || days > 0) timeParts.push(`${hours}h`);
      timeParts.push(`${minutes}m`);

      const exactCountdown = timeParts.join(" ");

      const eventEmbed = new EmbedBuilder()
        .setColor("#F59E0B")
        .setTitle(`🛡️ Next Event: ${nextEvent.title}`)
        .addFields(
          {
            name: "⏰ Start Time",
            value: `<t:${unixSeconds}:F>`,
            inline: true,
          },
          {
            name: "⏳ Countdown",
            value: `**${exactCountdown}** (<t:${unixSeconds}:R>)`,
            inline: true,
          },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [eventEmbed] });
    } catch (error) {
      console.error("Error in /event:", error);
      await interaction.editReply("❌ An error occurred while loading events.");
    }
  }

  // ----------------------------------------------------------------
  // COMMAND /top (Strictly PvP Leaderboard)
  // ----------------------------------------------------------------
  if (commandName === "top") {
    await interaction.deferReply();

    try {
      const ref = db.ref(MEMBERS_PATH);
      const snapshot = await ref.once("value");

      if (!snapshot.exists()) {
        return interaction.editReply(`🏆 Path \`${MEMBERS_PATH}\` is empty.`);
      }

      const membersList = [];
      snapshot.forEach((childSnapshot) => {
        const data = childSnapshot.val();
        if (data) {
          membersList.push({
            name: data.name || "Unknown",
            value: Number(data.pvp) || 0,
          });
        }
      });

      membersList.sort((a, b) => b.value - a.value);

      const top10 = membersList.slice(0, 10);
      const medals = ["🥇", "🥈", "🥉"];
      let leaderboardText = "";

      top10.forEach((member, index) => {
        const icon = medals[index] || `**#${index + 1}**`;
        leaderboardText += `${icon} **${member.name}** — \`${member.value}\` PvP\n`;
      });

      const topEmbed = new EmbedBuilder()
        .setColor("#10B981")
        .setTitle("🏆 Top 10 Iron Gates — PvP Leaderboard")
        .setDescription(leaderboardText || "No data available.")
        .setTimestamp();

      await interaction.editReply({ embeds: [topEmbed] });
    } catch (error) {
      console.error("Error in /top:", error);
      await interaction.editReply(
        "❌ An error occurred while generating the leaderboard.",
      );
    }
  }

  // ----------------------------------------------------------------
  // COMMAND /help
  // ----------------------------------------------------------------
  if (commandName === "help") {
    await interaction.deferReply({ ephemeral: true });

    const helpEmbed = new EmbedBuilder()
      .setColor("#3B82F6")
      .setTitle("📖 Iron Gates Manager — Command Guide")
      .setDescription(
        "Welcome! Here is a breakdown of all available slash commands and how to use them.",
      )
      .addFields(
        {
          name: "⚔️ `/pvp [count] [target]`",
          value:
            "Update PvP score in the database.\n" +
            "• `count` *(required)*: Your new total PvP count.\n" +
            "• `target` *(optional)*: Mention another member to update their score (for Officers / PLs).",
        },
        {
          name: "🛡️ `/event`",
          value:
            "Displays the next scheduled clan event or epic boss spawn along with an exact real-time countdown.",
        },
        {
          name: "🏆 `/top`",
          value: "Shows the Top 10 PvP leaderboard of Iron Gates clan members.",
        },
        {
          name: "❓ `/help`",
          value: "Shows this help menu and user guide.",
        },
      )
      .setFooter({ text: "Iron Gates Manager • Guild Assistance" })
      .setTimestamp();

    await interaction.editReply({ embeds: [helpEmbed] });
  }
});

client.login(process.env.DISCORD_TOKEN);
