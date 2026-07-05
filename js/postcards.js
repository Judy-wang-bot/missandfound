import { STORAGE_KEYS } from "./data.js";
import { bootstrapItems, getItems, read, write } from "./storage.js";
import { initPageEffects } from "./effects.js";

const wallEl = document.getElementById("postcards-wall");
const emptyEl = document.getElementById("empty-state");
const exportAllBtn = document.getElementById("export-all-btn");
const previewMaskEl = document.getElementById("preview-mask");
const previewCardEl = document.getElementById("preview-card");
const softTipEl = document.getElementById("soft-tip");

let tipTimer = null;
let longPressTimer = null;

const nowText = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "未知时间";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const showTip = (text) => {
  softTipEl.textContent = text;
  softTipEl.classList.add("is-show");
  if (tipTimer) window.clearTimeout(tipTimer);
  tipTimer = window.setTimeout(() => {
    softTipEl.classList.remove("is-show");
  }, 1500);
};

const getFallbackImage = () =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='720' height='540' viewBox='0 0 720 540'>
      <defs>
        <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
          <stop stop-color='#8b9fd4' offset='0%' />
          <stop stop-color='#e8b4d4' offset='100%' />
        </linearGradient>
      </defs>
      <rect width='100%' height='100%' fill='url(#g)'/>
    </svg>`
  )}`;

const getFavorites = () => read(STORAGE_KEYS.favorites, []);
const setFavorites = (value) => write(STORAGE_KEYS.favorites, value);

const normalizeFavorites = () => {
  const items = getItems();
  const itemMap = new Map(items.map((it) => [it.id, it]));
  const favorites = getFavorites();

  if (!Array.isArray(favorites)) return [];

  return favorites.map((fav, index) => {
    const item = itemMap.get(fav.itemId);
    return {
      id: fav.id || `fav-${Date.now()}-${index}`,
      itemId: fav.itemId || "",
      itemName: fav.itemName || item?.name || item?.title || "匿名旅伴",
      postImage: fav.postImage || getFallbackImage(),
      postText: fav.postText || fav.caption || "把这段风景留在了明信片里。",
      postLocation: fav.postLocation || fav.city || "远方",
      favoritedAt: fav.favoritedAt || fav.createdAt || new Date().toISOString(),
      unread: fav.unread === true
    };
  });
};

const buildCardHtml = (card) => {
  const imageSrc = card.postImage || getFallbackImage();
  const imageAlt = `${card.postLocation} 旅行照片`;
  return `
    <article
      class="postcard"
      data-fav-id="${escapeHtml(card.id)}"
      tabindex="0"
      role="button"
      aria-label="查看明信片"
    >
      <div class="postcard__img">
        <img class="postcard__img-el" loading="lazy" src="${escapeHtml(imageSrc)}" alt="${escapeHtml(imageAlt)}" />
        <span class="postcard__landmark">#${escapeHtml(card.postLocation)}</span>
      </div>
      <p class="postcard__text text-body">${escapeHtml(card.postText)}</p>
      <p class="postcard__meta">
        <span>来自：${escapeHtml(card.itemName)}</span>
        <span>收藏于：${escapeHtml(nowText(card.favoritedAt))}</span>
      </p>
    </article>
  `;
};

const render = () => {
  const cards = normalizeFavorites();
  if (!cards.length) {
    wallEl.hidden = true;
    emptyEl.hidden = false;
    exportAllBtn.disabled = true;
    exportAllBtn.textContent = "暂无可导出的明信片";
    return;
  }

  wallEl.hidden = false;
  emptyEl.hidden = true;
  exportAllBtn.disabled = false;
  exportAllBtn.textContent = "生成我的收藏长图";
  wallEl.innerHTML = cards.map(buildCardHtml).join("");

  const cardEls = [...wallEl.querySelectorAll(".postcard")];
  cardEls.forEach((el, index) => {
    window.setTimeout(() => {
      el.classList.add("is-visible");
    }, 120 + index * 70);
  });
};

const setFavoritesRead = () => {
  const favorites = getFavorites();
  if (!Array.isArray(favorites) || favorites.length === 0) return;
  const next = favorites.map((fav) => ({ ...fav, unread: false }));
  setFavorites(next);
};

const downloadCanvas = (canvas, fileName) => {
  const link = document.createElement("a");
  link.download = fileName;
  link.href = canvas.toDataURL("image/png");
  link.click();
};

const saveSingleCard = async (cardEl) => {
  if (!window.html2canvas) {
    showTip("导出组件未加载完成");
    return;
  }
  const canvas = await window.html2canvas(cardEl, {
    useCORS: true,
    backgroundColor: null,
    scale: Math.min(2, window.devicePixelRatio || 1.5)
  });
  downloadCanvas(canvas, `miss-found-postcard-${Date.now()}.png`);
  showTip("明信片已保存");
};

const showPreview = (cardEl) => {
  previewCardEl.innerHTML = cardEl.outerHTML;
  previewMaskEl.hidden = false;
};

const closePreview = () => {
  previewMaskEl.hidden = true;
  previewCardEl.innerHTML = "";
};

const exportAll = async () => {
  const cardEls = [...wallEl.querySelectorAll(".postcard")];
  if (!cardEls.length) {
    showTip("还没有可导出的明信片");
    return;
  }
  if (!window.html2canvas) {
    showTip("导出组件未加载完成");
    return;
  }

  const holder = document.createElement("div");
  holder.style.position = "fixed";
  holder.style.left = "-99999px";
  holder.style.top = "0";
  holder.style.width = "520px";
  holder.style.padding = "18px";
  holder.style.background = "linear-gradient(150deg, #4a5578 0%, #6b5a8a 100%)";
  holder.style.display = "grid";
  holder.style.gap = "16px";
  holder.style.zIndex = "-1";

  cardEls.forEach((card) => {
    const clone = card.cloneNode(true);
    clone.style.transform = "none";
    clone.style.opacity = "1";
    holder.appendChild(clone);
  });

  document.body.appendChild(holder);
  const canvas = await window.html2canvas(holder, {
    useCORS: true,
    backgroundColor: null,
    scale: Math.min(2, window.devicePixelRatio || 1.5)
  });
  holder.remove();

  downloadCanvas(canvas, `miss-found-postcards-long-${Date.now()}.png`);
  showTip("收藏长图已生成");
};

const bindEvents = () => {
  wallEl.addEventListener("click", (event) => {
    const card = event.target.closest(".postcard");
    if (!card) return;
    showPreview(card);
  });

  wallEl.addEventListener("keydown", (event) => {
    const card = event.target.closest(".postcard");
    if (!card) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      showPreview(card);
    }
  });

  wallEl.addEventListener("pointerdown", (event) => {
    const card = event.target.closest(".postcard");
    if (!card) return;
    longPressTimer = window.setTimeout(() => {
      saveSingleCard(card);
    }, 520);
  });

  const clearLongPress = () => {
    if (longPressTimer) {
      window.clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };
  wallEl.addEventListener("pointerup", clearLongPress);
  wallEl.addEventListener("pointerleave", clearLongPress);
  wallEl.addEventListener("pointercancel", clearLongPress);

  previewMaskEl.addEventListener("click", (event) => {
    if (event.target === previewMaskEl) closePreview();
  });

  exportAllBtn.addEventListener("click", exportAll);
};

const init = () => {
  initPageEffects();
  bootstrapItems();
  setFavoritesRead();
  render();
  bindEvents();
};

init();
