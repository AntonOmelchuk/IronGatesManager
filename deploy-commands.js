const { REST, Routes, SlashCommandBuilder } = require("discord.js");
require("dotenv").config();

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
    )
    .addUserOption((option) =>
      option
        .setName("target")
        .setDescription("Target member (optional for Officers / PLs)")
        .setRequired(false),
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
