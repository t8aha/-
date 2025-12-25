const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const ImageModel = require('../database/models');
const { renderProfile } = require('../image/renderer');
const path = require('path');
const PUBLIC_IMAGE = path.join(__dirname, '../../assets/public.png');

// يرسل لوحة عامة مع أزرار Avatar/Banner/Profile
async function showPanel(target) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('public_select_avatar').setLabel('Avatar').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('public_select_banner').setLabel('Banner').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('public_select_profile').setLabel('Profile').setStyle(ButtonStyle.Secondary)
  );

  const sendOptions = { components: [row], files: [{ attachment: PUBLIC_IMAGE, name: 'public.png' }] };

  // support both Interaction and Message
  if (typeof target.reply === 'function') {
    // interaction: acknowledge without replying to the user, send channel message and remove ack
    try {
      await target.deferReply({ ephemeral: true }).catch(()=>{});
    } catch (e) {}
    if (target.channel && typeof target.channel.send === 'function') {
      await target.channel.send(sendOptions);
    }
    try { await target.deleteReply().catch(()=>{}); } catch (e) {}
  } else if (target && target.channel && typeof target.channel.send === 'function') {
    await target.channel.send(sendOptions);
  }
}

// معالجة تفاعلات الأزرار و الـ Select Menu
async function handleInteraction(interaction) {
  try {
    if (interaction.isButton()) {
      const id = interaction.customId;
      if (id.startsWith('public_select_')) {
        const type = id.replace('public_select_', ''); // avatar | banner | profile

        const select = new StringSelectMenuBuilder()
          .setCustomId(`public_category|${type}`)
          .setPlaceholder('اختر القسم')
          .addOptions([
            { label: 'Boy', value: 'boy' },
            { label: 'Girl', value: 'girl' },
            { label: 'Anime', value: 'anime' }
          ]);

        const row = new ActionRowBuilder().addComponents(select);
        return interaction.reply({ content: `اختر القسم لـ **${type}**:`, components: [row], ephemeral: true });
      }

      if (id.startsWith('public_nav|')) {
        // format: public_nav|type|category|index|action
        const parts = id.split('|');
        const [, type, category, idxStr, action] = parts;
        let index = parseInt(idxStr, 10);

        const images = await ImageModel.find({ type, category }).sort({ createdAt: 1 }).exec();
        const total = images.length;
        if (total === 0) return interaction.update({ content: null, components: [], files: [] });

        if (action === 'next') index = index + 1;
        if (action === 'prev') index = index - 1;

        // clamp index to valid range in case images were added/deleted
        if (index < 1) index = 1;
        if (index > total) index = total;

        const record = images[index - 1];
        if (!record) return interaction.update({ content: null, components: [], files: [] });

        // download action: send original image to the user ephemerally
        if (action === 'download') {
          try {
            if (!record || !record.data) return interaction.reply({ content: 'الصورة غير متوفرة للتحميل.', ephemeral: true });

            // Handle mongoose Buffer/Binary
            let fileBuffer = record.data;
            if (record.data.buffer && typeof record.data.buffer === 'object') {
              fileBuffer = Buffer.from(record.data.buffer);
            } else if (!(record.data instanceof Buffer)) {
              fileBuffer = Buffer.from(record.data);
            }

            if (interaction.replied || interaction.deferred) {
              return interaction.followUp({ files: [{ attachment: fileBuffer, name: 'original.png' }], ephemeral: true });
            }

            return interaction.reply({ files: [{ attachment: fileBuffer, name: 'original.png' }], ephemeral: true });
          } catch (e) {
            console.error('download reply error', e);
            try { return interaction.reply({ content: 'حدث خطأ أثناء التحميل.', ephemeral: true }); } catch (e2) { return; }
          }
        }

        const avatarBuffer = type === 'avatar' ? record.data : null;
        const bannerBuffer = type === 'banner' || type === 'profile' ? record.data : null;

        const buffer = await renderProfile({ avatarBuffer, bannerBuffer, index, total });

        const navRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`public_nav|${type}|${category}|${index}|prev`).setLabel('السابق').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`public_nav|${type}|${category}|${index}|next`).setLabel('التالي').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`public_nav|${type}|${category}|${index}|download`).setLabel('تحميل').setStyle(ButtonStyle.Secondary)
        );

        // update the original message: only image + buttons (no text)
        return interaction.update({ components: [navRow], files: [{ attachment: buffer, name: 'profile.png' }], content: null });
      }
    }

    if (interaction.isStringSelectMenu()) {
      const [prefix, type] = interaction.customId.split('|');
      if (prefix !== 'public_category') return;

      const category = interaction.values[0];

      const images = await ImageModel.find({ type, category }).sort({ createdAt: 1 }).exec();
      const total = images.length;
      if (total === 0) return interaction.update({ content: null, components: [] });

      const index = 1;
      const record = images[0];
      if (!record) return interaction.update({ content: null, components: [] });
      const avatarBuffer = type === 'avatar' ? record.data : null;
      const bannerBuffer = type === 'banner' || type === 'profile' ? record.data : null;

      const buffer = await renderProfile({ avatarBuffer, bannerBuffer, index, total });

      const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`public_nav|${type}|${category}|${index}|prev`).setLabel('السابق').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`public_nav|${type}|${category}|${index}|next`).setLabel('التالي').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`public_nav|${type}|${category}|${index}|download`).setLabel('تحميل').setStyle(ButtonStyle.Secondary)
      );

      return interaction.update({ content: null, components: [navRow], files: [{ attachment: buffer, name: 'profile.png' }] });
    }
  } catch (err) {
    console.error('publicCommand handler error', err);
    if (interaction.replied || interaction.deferred) {
      try { await interaction.followUp({ content: 'حدث خطأ أثناء معالجة التفاعل.', ephemeral: true }); } catch (e) {}
    } else {
      try { await interaction.reply({ content: 'حدث خطأ.', ephemeral: true }); } catch (e) {}
    }
  }
}

module.exports = {
  showPanel,
  handleInteraction
};

