const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ImageModel = require('../database/models');

const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID;

function normalizeTarget(target) {
  // Convert Message or Interaction into an object with .user, .member, .channel, .reply, .followUp
  if (!target) return null;
  if (target.user && target.channel) return target; // likely an Interaction
  if (target.author && target.channel) {
    return {
      user: { id: target.author.id },
      member: target.member,
      channel: target.channel,
      replied: false,
      deferred: false,
      reply: async (opts) => {
        if (typeof opts === 'string') return target.channel.send(opts);
        return target.channel.send(opts);
      },
      followUp: async (opts) => {
        if (typeof opts === 'string') return target.channel.send(opts);
        return target.channel.send(opts);
      }
    };
  }
  return null;
}

async function showPanel(target) {
  const t = normalizeTarget(target) || target;
  // تحقق من صلاحية الأدمن
  if (!t.member || !t.member.roles || !t.member.roles.cache.has(ADMIN_ROLE_ID)) {
    // if interaction-like, acknowledge ephemerally then delete ack to avoid visible reply
    if (typeof t.reply === 'function') {
      try { await t.deferReply({ ephemeral: true }).catch(()=>{}); } catch (e) {}
      try { await t.deleteReply().catch(()=>{}); } catch (e) {}
      return;
    }
    return t.reply({ content: 'غير مسموح: تحتاج إلى رتبة الأدمن لاستخدام هذه اللوحة.', ephemeral: true });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('admin_add_avatar').setLabel('إضافة Avatar').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('admin_add_banner').setLabel('إضافة Banner').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('admin_add_profile').setLabel('إضافة Profile').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('admin_delete_images').setLabel('حذف صور').setStyle(ButtonStyle.Danger)
  );

  const sendOptions = { content: 'لوحة الأدمن — اختر إجراء:', components: [row] };
  if (typeof t.reply === 'function') {
    try { await t.deferReply({ ephemeral: true }).catch(()=>{}); } catch (e) {}
    if (t.channel && typeof t.channel.send === 'function') await t.channel.send(sendOptions);
    try { await t.deleteReply().catch(()=>{}); } catch (e) {}
    return;
  }

  return t.channel.send(sendOptions);
}

// مساعدة لجمع الرسالة مع المرفق
async function collectAttachment(interaction, type) {
  await interaction.followUp({ content: `أرسل الآن رسالة في هذا القناة تحتوي على التصنيف (boy/girl/anime) وأرفق الصورة. سيتم حذف الرسالة بعد الرفع. لديك 60 ثانية.`, ephemeral: true });

  const filter = (m) => m.author.id === interaction.user.id && m.attachments.size > 0 && /^(boy|girl|anime)$/i.test(m.content.trim());
  const collector = interaction.channel.createMessageCollector({ filter, max: 1, time: 60000 });

  return new Promise((resolve, reject) => {
    collector.on('collect', async (m) => {
      try {
        const category = m.content.trim().toLowerCase();
        const attachment = m.attachments.first();
        const url = attachment.url;
        const res = await fetch(url);
        const array = await res.arrayBuffer();
        const buffer = Buffer.from(array);

        // حذف رسالة الرفع من الشات
        try { await m.delete(); } catch (e) {}

        // حفظ في MongoDB
        const doc = new ImageModel({ type, category, data: buffer, uploadedBy: interaction.user.id });
        await doc.save();
        resolve({ ok: true, doc });
      } catch (err) {
        reject(err);
      }
    });

    collector.on('end', (collected) => {
      if (collected.size === 0) resolve({ ok: false, reason: 'timeout' });
    });
  });
}

async function handleInteraction(interaction) {
  try {
    if (!interaction.member || !interaction.member.roles || !interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
      if (interaction.replied || interaction.deferred) return;
      return interaction.reply({ content: 'غير مسموح: تحتاج إلى رتبة الأدمن لاستخدام هذه الوظيفة.', ephemeral: true });
    }

    if (!interaction.isButton()) return;

    const id = interaction.customId;
    if (id === 'admin_add_avatar' || id === 'admin_add_banner' || id === 'admin_add_profile') {
      const type = id.replace('admin_add_', ''); // avatar | banner | profile
      await interaction.reply({ content: `ستضيف صورة من نوع: ${type}.` , ephemeral: true });
      const result = await collectAttachment(interaction, type);
      if (!result.ok) return interaction.followUp({ content: 'انتهى الوقت دون رفع صورة.', ephemeral: true });
      return interaction.followUp({ content: `تم حفظ الصورة بنجاح (نوع: ${type}, تصنيف: ${result.doc.category}).`, ephemeral: true });
    }

    if (id === 'admin_delete_images') {
      await interaction.reply({ content: 'لحذف صورة: اكتب في هذه القناة رسالة بصيغة: `type category index` (مثال: `avatar boy 3`). سيتم حذف الرسالة وتأكيد العملية.', ephemeral: true });

      const filter = (m) => m.author.id === interaction.user.id && /^\s*(avatar|banner|profile)\s+(boy|girl|anime)\s+\d+\s*$/i.test(m.content);
      const collector = interaction.channel.createMessageCollector({ filter, max: 1, time: 60000 });

      collector.on('collect', async (m) => {
        try {
          const parts = m.content.trim().split(/\s+/);
          const [type, category, idxStr] = parts;
          const index = parseInt(idxStr, 10);
          const images = await ImageModel.find({ type, category }).sort({ createdAt: 1 }).exec();
          if (index < 1 || index > images.length) {
            await interaction.followUp({ content: 'رقم الصورة غير صالح.', ephemeral: true });
            try { await m.delete(); } catch (e) {}
            return;
          }

          const doc = images[index - 1];
          await ImageModel.deleteOne({ _id: doc._id });
          try { await m.delete(); } catch (e) {}
          await interaction.followUp({ content: `تم حذف الصورة رقم ${index} من ${type} / ${category}.`, ephemeral: true });
        } catch (err) {
          console.error('delete collector error', err);
          try { await m.delete(); } catch (e) {}
          await interaction.followUp({ content: 'حدث خطأ أثناء الحذف.', ephemeral: true });
        }
      });

      collector.on('end', (collected) => {
        if (collected.size === 0) interaction.followUp({ content: 'انتهى الوقت دون إدخال بيانات الحذف.', ephemeral: true });
      });
    }
  } catch (err) {
    console.error('adminCommand handler error', err);
    if (!interaction.replied && !interaction.deferred) {
      try { await interaction.reply({ content: 'حدث خطأ.', ephemeral: true }); } catch (e) {}
    }
  }
}

module.exports = {
  showPanel,
  handleInteraction
};

