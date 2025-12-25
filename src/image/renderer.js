const { createCanvas, loadImage } = require('canvas');
const path = require('path');

/**
 * إعدادات أماكن العناصر (عدّلها بدقة حسب تصميمك)
 */
const CANVAS_WIDTH = 1536;
const CANVAS_HEIGHT = 925;

// مسار الصورة الأساسية
const TEMPLATE_PATH = path.join(__dirname, '../../assets/template.png');

// مكان الأفتار (دائري)
const AVATAR = {
  x: 330,       // مركز الدائرة X (معدّل لليسار)
  y: 520,       // مركز الدائرة Y (مرفوع للأعلى)
  r: 210        // نصف القطر (قطر = 420px)
};

// مكان البنر (خلفية)
const BANNER = {
  x: 0,
  y: 0,
  w: CANVAS_WIDTH,
  h: 380        // ارتفاع منطقة البنر (يغطي الجزء العلوي من القالب)
};

// العداد فوق الصورة
const COUNTER = {
  x: Math.round(CANVAS_WIDTH / 2),
  y: 60
};

/**
 * يرسم صورة البروفايل النهائية
 * @param {Object} opts
 * @param {Buffer} opts.avatarBuffer - بيانات صورة الأفتار (Buffer)
 * @param {Buffer} opts.bannerBuffer - بيانات صورة البنر (Buffer)
 * @param {number} opts.index - رقم الصورة الحالي
 * @param {number} opts.total - إجمالي الصور
 * @returns {Buffer} PNG
 */
async function renderProfile({ avatarBuffer, bannerBuffer, index, total }) {
  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext('2d');

  // 1) الصورة الأساسية
  const base = await loadImage(TEMPLATE_PATH);
  ctx.drawImage(base, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 2) البنر (خلفية)
  if (bannerBuffer) {
    const banner = await loadImage(bannerBuffer);
    ctx.save();
    ctx.drawImage(banner, BANNER.x, BANNER.y, BANNER.w, BANNER.h);
    ctx.restore();
  }

  // 3) الأفتار (قص دائري)
  if (avatarBuffer) {
    const avatar = await loadImage(avatarBuffer);
    ctx.save();
    ctx.beginPath();
    ctx.arc(AVATAR.x, AVATAR.y, AVATAR.r, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();

    // Draw avatar with object-fit: cover behavior into a square of 420x420 centered
    const avatarDrawDiameter = AVATAR.r * 2; // 420

    // compute source crop to preserve aspect ratio (cover)
    let sx = 0, sy = 0, sw = avatar.width, sh = avatar.height;
    const imgAspect = avatar.width / avatar.height;
    if (imgAspect > 1) {
      // image is wider than tall -> crop width
      sw = avatar.height;
      sx = Math.round((avatar.width - sw) / 2);
    } else if (imgAspect < 1) {
      // image is taller than wide -> crop height
      sh = avatar.width;
      sy = Math.round((avatar.height - sh) / 2);
    }

    const dx = AVATAR.x - avatarDrawDiameter / 2;
    const dy = AVATAR.y - avatarDrawDiameter / 2;
    ctx.drawImage(avatar, sx, sy, sw, sh, dx, dy, avatarDrawDiameter, avatarDrawDiameter);
    ctx.restore();

    // draw subtle circular frame to blend with template
    ctx.beginPath();
    ctx.arc(AVATAR.x, AVATAR.y, AVATAR.r + 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 6;
    ctx.stroke();
  }

  // 4) العداد (مثال: 15 / 43)
  if (typeof index === 'number' && typeof total === 'number') {
    ctx.font = 'bold 28px Sans';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 6;
    ctx.fillText(`${index} / ${total}`, COUNTER.x, COUNTER.y);
    ctx.shadowBlur = 0;
  }

  return canvas.toBuffer('image/png');
}

module.exports = {
  renderProfile
};
