// Dessin de la story (1080x1920) et du message WhatsApp.
// Utilisé par la page du gérant ET par le robot (mode automatique) : un seul design.

const W = 1080, H = 1920;
const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
  "août", "septembre", "octobre", "novembre", "décembre"];
const F = { heavy: 900, bold: 700, demi: 600, medium: 500 };

export async function loadFonts() {
  await Promise.all(Object.values(F).map(w => document.fonts.load(`${w} 40px Montserrat`)));
}

export function loadImage(src) {
  return new Promise((ok, ko) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = ko;
    img.src = src;
  });
}

// "2026-11-06" -> "vendredi 6 novembre"
export function dateLabel(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${JOURS[dt.getUTCDay()]} ${d} ${MOIS[m - 1]}`;
}

const hh = start => start.replace(":", "h");
const doubles = n => `${n} double${n > 1 ? "s" : ""}`;
// "2 doubles + le single", "le single", "1 double"
const detail = s => [s.double && doubles(s.double), s.single && "le single"].filter(Boolean).join(" + ");
export const slotLabel = detail;

function font(ctx, weight, size) {
  ctx.font = `${F[weight]} ${size}px Montserrat`;
}

function text(ctx, str, x, y, weight, size, color, align = "left", baseline = "top") {
  font(ctx, weight, size);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(str, x, y);
}

function roundRect(ctx, x0, y0, x1, y1, r) {
  ctx.beginPath();
  ctx.roundRect(x0, y0, x1 - x0, y1 - y0, r);
}

function cover(ctx, img, cy = 0.45) {
  const s = Math.max(W / img.width, H / img.height);
  const w = img.width * s, h = img.height * s;
  ctx.drawImage(img, (W - w) / 2, (H - h) * cy, w, h);
}

function gradient(ctx, y0, y1, a0, a1) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, `rgba(12,8,6,${a0})`);
  g.addColorStop(1, `rgba(12,8,6,${a1})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, W, y1 - y0);
}

// Verre dépoli : on réduit puis agrandit la zone (flou compatible tous navigateurs, iPhone compris).
function glass(ctx, x0, y0, x1, y1, r) {
  const w = x1 - x0, h = y1 - y0, k = 24;
  const small = document.createElement("canvas");
  small.width = Math.ceil(w / k);
  small.height = Math.ceil(h / k);
  const sc = small.getContext("2d");
  sc.imageSmoothingQuality = "high";
  sc.drawImage(ctx.canvas, x0, y0, w, h, 0, 0, small.width, small.height);
  ctx.save();
  roundRect(ctx, x0, y0, x1, y1, r);
  ctx.clip();
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(small, x0, y0, w, h);
  ctx.fillStyle = "rgba(20,12,8,0.6)";
  ctx.fillRect(x0, y0, w, h);
  ctx.restore();
  roundRect(ctx, x0, y0, x1, y1, r);
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

/**
 * slots : [{ start: "18:00", double: 2, single: 1 }, ...] (heures avec au moins un terrain libre)
 * moment : entrée de config.moments ; day : "AAAA-MM-JJ"
 */
export function drawStory(canvas, { cfg, photo, moment, day, slots }) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const st = cfg.style, club = cfg.club;

  cover(ctx, photo);
  gradient(ctx, 0, 860, 0.92, 0);
  gradient(ctx, 900, H, 0, 0.92);

  // En-tête
  text(ctx, club.name.toLowerCase(), W / 2, 110, "heavy", 60, st.text, "center");
  text(ctx, club.city.toUpperCase(), W / 2, 190, "demi", 30, st.muted, "center");
  text(ctx, moment.titre, W / 2, 330, "medium", 96, st.text, "center");
  text(ctx, "on joue ?", W / 2, 440, "heavy", 132, st.text, "center");

  // Panneau des créneaux (les heures en trop sont résumées sur une dernière ligne)
  const max = cfg.max_lignes;
  const shown = slots.length > max ? slots.slice(0, max - 1) : slots;
  const extra = slots.length - shown.length;
  const rows = Math.max(shown.length + (extra ? 1 : 0), 1);
  const row = 92, bottom = H - 300, top = bottom - 120 - rows * row;
  glass(ctx, 70, top, W - 70, bottom, 44);

  const label = slots.length ? `Terrains dispo · ${dateLabel(day)}` : dateLabel(day).replace(/^./, c => c.toUpperCase());
  text(ctx, label, W / 2, top + 40, "demi", 36, st.muted, "center");

  let y = top + 104;
  if (!slots.length) text(ctx, "Tout est complet, merci à tous !", W / 2, y + 10, "bold", 44, st.text, "center");
  shown.forEach((s, i) => {
    if (i) {
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(120, y - 7, W - 240, 2);
    }
    text(ctx, hh(s.start), 130, y + 41, "heavy", 54, st.text, "left", "middle");
    // Pastilles alignées à droite : single (contour), puis doubles (pleine)
    let right = W - 130;
    if (s.single) right = chip(ctx, "single", right, y, null, st.text) - 12;
    if (s.double) chip(ctx, doubles(s.double), right, y, st.accent, st.text);
    y += row;
  });
  if (extra) {
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(120, y - 7, W - 240, 2);
    text(ctx, `+ ${extra} autre${extra > 1 ? "s" : ""} créneau${extra > 1 ? "x" : ""} dispo`, W / 2, y + 14, "demi", 38, st.muted, "center");
  }

  // Bouton de réservation + flèche dessinée
  roundRect(ctx, 70, H - 250, W - 70, H - 140, 55);
  ctx.fillStyle = st.accent;
  ctx.fill();
  const cta = `Réserve sur ${club.booking_url}`;
  font(ctx, "bold", 46);
  const cw = ctx.measureText(cta).width, x = (W - cw - 50) / 2;
  text(ctx, cta, x, H - 193, "bold", 46, st.text, "left", "middle");
  const ax = x + cw + 26, ay = H - 195;
  ctx.strokeStyle = st.text;
  ctx.lineWidth = 6;
  ctx.lineCap = ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(ax, ay); ctx.lineTo(ax + 30, ay);
  ctx.moveTo(ax + 16, ay - 14); ctx.lineTo(ax + 31, ay); ctx.lineTo(ax + 16, ay + 14);
  ctx.stroke();
  text(ctx, club.phone || "", W / 2, H - 108, "medium", 34, st.muted, "center");
}

// Pastille de texte dont le bord droit est en x ; renvoie son bord gauche.
function chip(ctx, label, x, y, fill, color) {
  font(ctx, "demi", 36);
  const left = x - ctx.measureText(label).width - 52;
  roundRect(ctx, left, y + 12, x, y + 70, 29);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  } else {
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  text(ctx, label, left + 26, y + 43, "demi", 36, color, "left", "middle");
  return left;
}

export function buildMessage({ cfg, moment, day, slots }) {
  const club = cfg.club;
  if (!slots.length) {
    return `✅ Tout est complet ${moment.jour ? "demain" : "aujourd'hui"} chez Team Padel, merci à tous ! 💪`;
  }
  return [
    `${moment.accroche} (${dateLabel(day)})`,
    "",
    ...slots.map(s => `• ${hh(s.start)} : ${detail(s)}`),
    "",
    `👉 Réserve sur ${club.booking_url} ou au ${club.phone}`,
  ].join("\n");
}
