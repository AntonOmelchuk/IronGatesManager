const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
} = require("discord.js");
const admin = require("firebase-admin");
require("dotenv").config();

let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
  const decodedJson = Buffer.from(
    process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
    "base64",
  ).toString("utf-8");
  serviceAccount = JSON.parse(decodedJson);
} else {
  serviceAccount = require("./serviceAccountKey.json");
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL:
    "https://reborn-5f1dc-default-rtdb.europe-west1.firebasedatabase.app",
});

const db = admin.database();

const MEMBERS_PATH = "iron_gates_members";
const EVENTS_PATH = "regroups/events";
const ALLY_IMAGE_PATH = "images/ally";

// ----------------------------------------------------------------
// DICTIONARIES FOR EVENT STYLING
// ----------------------------------------------------------------
const EVENT_EMOJIS = {
  siege: "🏰",
  ch: "🛡️",
  mtb: "⚔️",
  ctb: "🚩",
  ebc: "🐲",
  dm: "☠️",
  qa: "🐜",
  core: "⚙️",
  orfen: "🕸️",
  zaken: "🏴‍☠️",
  tezza: "🎻",
  baium: "👑",
  antharas: "🐉",
  valakas: "🔥",
};

const EPIC_COLORS = {
  QueenAnt: "#C46100",
  Orfen: "#0066CC",
  Core: "#4CB140",
  Zaken: "#005F60",
  Baium: "#C58C00",
  Frintezza: "#a14e9a",
  Valakas: "#7D1007",
  Antharas: "#8A8D90",
};

// Helper function to resolve dynamic emoji by event title/type
function getEventEmoji(title = "", type = "") {
  const text = `${title} ${type}`.toLowerCase();

  if (text.includes("qa") || text.includes("queen") || text.includes("ant"))
    return EVENT_EMOJIS.qa;
  if (text.includes("core")) return EVENT_EMOJIS.core;
  if (text.includes("orfen")) return EVENT_EMOJIS.orfen;
  if (text.includes("zaken")) return EVENT_EMOJIS.zaken;
  if (text.includes("tezza") || text.includes("frintezza"))
    return EVENT_EMOJIS.tezza;
  if (text.includes("baium")) return EVENT_EMOJIS.baium;
  if (text.includes("antharas")) return EVENT_EMOJIS.antharas;
  if (text.includes("valakas")) return EVENT_EMOJIS.valakas;
  if (text.includes("siege")) return EVENT_EMOJIS.siege;
  if (text.includes("ch") || text.includes("hall")) return EVENT_EMOJIS.ch;
  if (text.includes("mtb")) return EVENT_EMOJIS.mtb;
  if (text.includes("ctb")) return EVENT_EMOJIS.ctb;
  if (text.includes("ebc") || text.includes("dragon")) return EVENT_EMOJIS.ebc;
  if (text.includes("dm") || text.includes("deathmatch"))
    return EVENT_EMOJIS.dm;

  return "🛡️"; // Fallback emoji
}

// Helper function to resolve dynamic color by event title/type
function getEventColor(title = "", type = "") {
  const text = `${title} ${type}`.toLowerCase();

  if (text.includes("qa") || text.includes("queen") || text.includes("ant"))
    return EPIC_COLORS.QueenAnt;
  if (text.includes("orfen")) return EPIC_COLORS.Orfen;
  if (text.includes("core")) return EPIC_COLORS.Core;
  if (text.includes("zaken")) return EPIC_COLORS.Zaken;
  if (text.includes("baium")) return EPIC_COLORS.Baium;
  if (text.includes("tezza") || text.includes("frintezza"))
    return EPIC_COLORS.Frintezza;
  if (text.includes("valakas")) return EPIC_COLORS.Valakas;
  if (text.includes("antharas")) return EPIC_COLORS.Antharas;

  return "#F59E0B"; // Default amber color
}

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
            type: data.type || "",
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

      // Precise time remaining calculation
      const totalSeconds = Math.floor((nextEvent.timestampMs - now) / 1000);
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);

      const timeParts = [];
      if (days > 0) timeParts.push(`${days}d`);
      if (hours > 0 || days > 0) timeParts.push(`${hours}h`);
      timeParts.push(`${minutes}m`);

      const exactCountdown = timeParts.join(" ");

      // Dynamic styling based on event title/type
      const emoji = getEventEmoji(nextEvent.title, nextEvent.type);
      const color = getEventColor(nextEvent.title, nextEvent.type);

      const eventEmbed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${emoji} Next Regroup: ${nextEvent.title}`)
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
  // COMMAND /top (PvP Leaderboard)
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
  // COMMAND /ally (Alliance Clan List Image)
  // ----------------------------------------------------------------
  if (commandName === "ally") {
    await interaction.deferReply();

    try {
      const ref = db.ref(ALLY_IMAGE_PATH);
      const snapshot = await ref.once("value");

      if (!snapshot.exists()) {
        return interaction.editReply(
          `❌ Path \`${ALLY_IMAGE_PATH}\` is empty in database.`,
        );
      }

      const val = snapshot.val();
      // Supports both string URL and object with url / imageUrl property
      const allyImgUrl =
        typeof val === "string" ? val : val?.url || val?.imageUrl || val?.src;

      if (!allyImgUrl) {
        return interaction.editReply(
          "❌ Alliance image URL is invalid or missing in database.",
        );
      }

      const allyEmbed = new EmbedBuilder()
        .setColor("#3B82F6")
        .setTitle("🛡️ Alliance Clan Roster")
        .setImage(allyImgUrl)
        .setTimestamp();

      await interaction.editReply({ embeds: [allyEmbed] });
    } catch (error) {
      console.error("Error in /ally:", error);
      await interaction.editReply(
        "❌ An error occurred while fetching the alliance image.",
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
            "• `count` *(required)*: Your new total PvP count.",
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
          name: "🤝 `/ally`",
          value:
            "Displays the current alliance structure and clan roster image.",
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

// ----------------------------------------------------------------
// REGISTER SLASH COMMANDS
// ----------------------------------------------------------------
const commands = [
  // Command /pvp [count] [target]
  new SlashCommandBuilder()
    .setName("pvp")
    .setDescription("Update PvP count for a player")
    .addIntegerOption((option) =>
      option
        .setName("count")
        .setDescription("New PvP count")
        .setRequired(true)
        .setMinValue(0),
    ),

  // Command /event
  new SlashCommandBuilder()
    .setName("event")
    .setDescription("Show the next upcoming event or boss spawn"),

  // Command /top
  new SlashCommandBuilder()
    .setName("top")
    .setDescription("Show Iron Gates PvP leaderboard"),

  // Command /ally
  new SlashCommandBuilder()
    .setName("ally")
    .setDescription("Show current alliance roster image"),

  // Command /help
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Display available commands and quick guide"),
].map((command) => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("⏳ Registering Slash commands globally...");

    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
      body: commands,
    });

    console.log("✅ Slash commands successfully registered!");
  } catch (error) {
    console.error("❌ Error registering commands:", error);
  }
})();
