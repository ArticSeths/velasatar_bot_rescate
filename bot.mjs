// Bot de Rescate Velasatar — Discord.js (Node.js LTS)
// ------------------------------------------------------------
// Funcionalidad principal
// - Comando /rescate solicitar abre un modal con la ficha.
// - Publica un embed en el canal de rescate, mencionando al rol @medico.
// - Crea un hilo automáticamente para la coordinación.
// - Botones: "Tomar caso", "Exitoso", "Fallido".
// - Solo quien tomó el caso (o moderadores) puede cerrarlo.
//
// Requisitos:
//   npm init -y
//   npm install discord.js dotenv
//   Node.js LTS (22+)
// ------------------------------------------------------------

import { Client, GatewayIntentBits, Partials, Routes, EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { REST } from '@discordjs/rest';
import dotenv from 'dotenv';

dotenv.config();

const TOKEN = process.env.DISCORD_TOKEN;
const RESCUE_CHANNEL_ID = process.env.RESCUE_CHANNEL_ID;
const MEDIC_ROLE_ID = process.env.MEDIC_ROLE_ID;

if (!TOKEN || !RESCUE_CHANNEL_ID || !MEDIC_ROLE_ID) {
  throw new Error("Faltan variables de entorno: DISCORD_TOKEN, RESCUE_CHANNEL_ID, MEDIC_ROLE_ID");
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ],
  partials: [Partials.Message, Partials.Channel]
});

// Estado en memoria (mensajeId -> caso)
const cases = new Map();

// Registro de slash command
const commands = [
  {
    name: 'rescate',
    description: 'Comandos del sistema de rescate',
    options: [
      {
        type: 1, // SUB_COMMAND
        name: 'solicitar',
        description: 'Solicita un rescate con el formulario'
      }
    ]
  }
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
  console.log(`Bot conectado como ${client.user.tag}`);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log("Comandos registrados.");
  } catch (err) {
    console.error("Error al registrar comandos:", err);
  }
});

// Interacciones
client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'rescate' && interaction.options.getSubcommand() === 'solicitar') {
      const modal = new ModalBuilder()
        .setCustomId('rescueModal')
        .setTitle('Ficha de Solicitud de Rescate')
        .addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('causa').setLabel('Causa').setStyle(TextInputStyle.Short)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('galaxia_sistema').setLabel('Galaxia/Sistema').setStyle(TextInputStyle.Short)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ubicacion').setLabel('Ubicación').setStyle(TextInputStyle.Paragraph)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tiempo').setLabel('Tiempo restante hasta la muerte').setStyle(TextInputStyle.Short)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('peligros').setLabel('¿Hay peligros en el área?').setStyle(TextInputStyle.Paragraph))
        );

      await interaction.showModal(modal);
    }
  } else if (interaction.isModalSubmit()) {
    if (interaction.customId === 'rescueModal') {
      const fields = {
        causa: interaction.fields.getTextInputValue('causa'),
        galaxia_sistema: interaction.fields.getTextInputValue('galaxia_sistema'),
        ubicacion: interaction.fields.getTextInputValue('ubicacion'),
        tiempo: interaction.fields.getTextInputValue('tiempo'),
        peligros: interaction.fields.getTextInputValue('peligros')
      };

      const embed = new EmbedBuilder()
        .setTitle('🪖 Ficha de Solicitud de Rescate')
        .setColor('Red')
        .addFields(
          { name: '🪖 Causa', value: fields.causa },
          { name: '🪖 Galaxia/Sistema', value: fields.galaxia_sistema },
          { name: '🪖 Ubicación', value: fields.ubicacion },
          { name: '🪖 Tiempo restante', value: fields.tiempo },
          { name: '🪖 ¿Hay peligros?', value: fields.peligros }
        )
        .setFooter({ text: `Solicitante: ${interaction.user.username}` });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('take_case').setLabel('Tomar caso').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('mark_success').setLabel('Exitoso').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('mark_failed').setLabel('Fallido').setStyle(ButtonStyle.Danger)
      );

      const channel = await client.channels.fetch(RESCUE_CHANNEL_ID);
      const message = await channel.send({
        content: `<@&${MEDIC_ROLE_ID}> — 🚨 Nueva solicitud de rescate de ${interaction.user}`,
        embeds: [embed],
        components: [row]
      });

      const thread = await message.startThread({ name: `Rescate #${message.id} — ${interaction.user.username}`, autoArchiveDuration: 60 });
      cases.set(message.id, { requester: interaction.user.id, threadId: thread.id, claimer: null, status: 'PENDIENTE' });

      await interaction.reply({ content: `Tu solicitud ha sido publicada en ${channel}.`, ephemeral: true });
    }
  } else if (interaction.isButton()) {
    const message = interaction.message;
    const state = cases.get(message.id);
    if (!state) return interaction.reply({ content: "No se encontró el caso.", ephemeral: true });

    if (interaction.customId === 'take_case') {
      if (state.claimer && state.claimer !== interaction.user.id) {
        return interaction.reply({ content: "El caso ya fue tomado por otro rescatista.", ephemeral: true });
      }
      state.claimer = interaction.user.id;
      state.status = 'EN_CAMINO';
      const embed = EmbedBuilder.from(message.embeds[0]).setTitle('🚑 Rescatista en camino').setColor('Orange');
      await message.edit({ embeds: [embed], components: message.components });
      const thread = await client.channels.fetch(state.threadId);
      await thread.send(`🚑 ${interaction.user} ha tomado el caso.`);
      return interaction.reply({ content: "Has tomado el caso.", ephemeral: true });
    }

    if (interaction.customId === 'mark_success' || interaction.customId === 'mark_failed') {
      if (!state.claimer) {
        return interaction.reply({ content: "Nadie ha tomado el caso aún.", ephemeral: true });
      }
      if (interaction.user.id !== state.claimer && !interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
        return interaction.reply({ content: "Solo quien tomó el caso (o un moderador) puede cerrarlo.", ephemeral: true });
      }

      state.status = interaction.customId === 'mark_success' ? 'EXITOSO' : 'FALLIDO';
      const embed = EmbedBuilder.from(message.embeds[0])
        .setTitle(state.status === 'EXITOSO' ? '✅ Rescate Exitoso' : '❌ Rescate Fallido')
        .setColor(state.status === 'EXITOSO' ? 'Green' : 'Red');

      // Deshabilitar botones
      const disabledRow = new ActionRowBuilder().addComponents(
        message.components[0].components.map(btn => ButtonBuilder.from(btn).setDisabled(true))
      );

      await message.edit({ embeds: [embed], components: [disabledRow] });
      const thread = await client.channels.fetch(state.threadId);
      await thread.send(`Cierre de caso: **${state.status}** por ${interaction.user}`);
      await thread.setArchived(true, 'Caso cerrado');
      return interaction.reply({ content: "Caso cerrado.", ephemeral: true });
    }
  }
});

client.login(TOKEN);
