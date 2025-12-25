require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType, EmbedBuilder } = require('discord.js');
const connectDB = require('./database/connect');
const publicCommand = require('./components/publicCommand');
const adminCommand = require('./components/adminCommand');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.once('ready', async () => {
	console.log(`✅ Logged in as ${client.user.tag}`);

	try {
		await connectDB();
	} catch (err) {
		console.error('DB connection failed:', err);
	}

		// Register minimal slash commands for opening the public and admin panels
		try {
			const data = [
				{ name: 'publicpanel', description: 'Open public panel' },
				{ name: 'adminpanel', description: 'Open admin panel (admins only)' }
			];
			await client.application.commands.set(data);
			console.log('✅ Registered slash commands');
		} catch (err) {
			console.warn('Could not register slash commands yet:', err.message);
		}

	client.user.setPresence({
		activities: [{
			name: 'Eyvora',
			type: ActivityType.Streaming,
			url: 'https://twitch.tv/discord'
		}],
		status: 'dnd'
	});

	// periodic log embed: send embed every 5 minutes, delete previous one
	let lastLogMessageId = null;
	async function sendLog() {
		try {
			if (!process.env.LOG_CHANNEL_ID) return;
			const ch = await client.channels.fetch(process.env.LOG_CHANNEL_ID).catch(() => null);
			if (!ch || !ch.isTextBased()) return;
			const embed = new EmbedBuilder().setTitle('Bot Heartbeat').setDescription('البوت يعمل — تحديث حالة').setTimestamp(new Date());
			const msg = await ch.send({ embeds: [embed] });
			if (lastLogMessageId) {
				try {
					const prev = await ch.messages.fetch(lastLogMessageId).catch(()=>null);
					if (prev) await prev.delete().catch(()=>{});
				} catch (e) {}
			}
			lastLogMessageId = msg.id;
		} catch (err) {
			console.error('log send error', err);
		}
	}

	// send one immediately and then every 5 minutes
	sendLog().catch(()=>{});
	setInterval(() => sendLog().catch(()=>{}), 5 * 60 * 1000);
});

client.on('interactionCreate', async (interaction) => {
	try {
		if (interaction.isChatInputCommand()) {
			if (interaction.commandName === 'publicpanel') return publicCommand.showPanel(interaction);
			if (interaction.commandName === 'adminpanel') return adminCommand.showPanel(interaction);
		}

		// Delegate component interactions based on customId prefix
		if (interaction.isButton() || interaction.isStringSelectMenu()) {
			const id = interaction.customId || '';
			if (id.startsWith('public_')) return publicCommand.handleInteraction(interaction);
			if (id.startsWith('admin_')) return adminCommand.handleInteraction(interaction);
			// fallback: try both
			await publicCommand.handleInteraction(interaction).catch(()=>{});
			await adminCommand.handleInteraction(interaction).catch(()=>{});
			return;
		}
	} catch (err) {
		console.error('Interaction handler error:', err);
		if (!interaction.replied && !interaction.deferred) {
			try { await interaction.reply({ content: 'حدث خطأ.', ephemeral: true }); } catch (e) {}
		}
	}
});

// Prefix command support: !public and !admin
client.on('messageCreate', async (message) => {
	try {
		if (!message.content) return;
		if (message.author?.bot) return;
		if (!message.content.startsWith('!')) return;

		const [cmd] = message.content.slice(1).trim().split(/\s+/);
		if (!cmd) return;

		if (cmd.toLowerCase() === 'public') {
			return publicCommand.showPanel(message);
		}
		if (cmd.toLowerCase() === 'admin') {
			return adminCommand.showPanel(message);
		}
	} catch (err) {
		console.error('messageCreate handler error:', err);
	}
});

process.on('unhandledRejection', (reason) => console.error('Unhandled Rejection:', reason));

client.login(process.env.DISCORD_TOKEN).catch(err => console.error('Login failed:', err));


