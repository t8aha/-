const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const fs = require('fs');

/**
 * ينشئ صورة بروفايل احترافية
 * - أفتار دائري
 * - بنر بالخلفية
 * - بدون روابط (Buffer)
 */
async function composeProfile({
  avatarBuffer,
  bannerBuffer
}) {
  // حجم الصورة النهائي
  const width = 900;
  const height = 500;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // تحميل البنر
  const banner = await loadImage(bannerBuffer);
  ctx.drawImage(banner, 0, 0, width, height);

  // إعداد مكان الأفتار
  const avatarSize = 220;
  const avatarX = 60;
  const avatarY = height / 2 - avatarSize / 2;

  // قص دائري للأفتار
  ctx.save();
  ctx.beginPath();
  ctx.arc(
    avatarX + avatarSize / 2,
    avatarY + avatarSize / 2,
    avatarSize / 2,
    0,
    Math.PI * 2
  );
  ctx.closePath();
  ctx.clip();

  const avatar = await loadImage(avatarBuffer);
  ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
  ctx.restore();

  // إطار أبيض حول الأفتار
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(
    avatarX + avatarSize / 2,
    avatarY + avatarSize / 2,
    avatarSize / 2 + 2,
    0,
    Math.PI * 2
  );
  ctx.stroke();

  // إرجاع الصورة كـ Buffer
  return canvas.toBuffer('image/png');
}

module.exports = {
  composeProfile
};
