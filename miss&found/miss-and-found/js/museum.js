import { STORAGE_KEYS } from "./data.js";
import { bootstrapItems, endItemTrip, getItems, ITEM_STATUS, read } from "./storage.js";
import { initPageEffects } from "./effects.js";
import { avatarStyleFromSeed, avatarMarkup } from "./avatar.js";

const gridEl = document.getElementById("museum-grid");
const emptyEl = document.getElementById("museum-empty");
const unreadDotEl = document.getElementById("unread-dot");
const contextMenuEl = document.getElementById("context-menu");
const endTripBtnEl = document.getElementById("end-trip-btn");

let contextItemId = null;
let longPressTimer = null;

const STATUS = {
  traveling: "旅行中",
  home: "已回家"
};

const getFavoritesUnreadCount = () => {
  const favorites = read(STORAGE_KEYS.favorites, []);

  if (Array.isArray(favorites)) {
    return favorites.filter((item) => item && (item.unread === true || item.isNew === true)).length;
  }

  if (favorites && typeof favorites === "object") {
    if (Number.isFinite(favorites.unreadCount)) {
      return favorites.unreadCount;
    }
    if (Array.isArray(favorites.items)) {
      return favorites.items.filter((item) => item && (item.unread === true || item.isNew === true)).length;
    }
  }

  return 0;
};

const getAvatarStyle = (seed = 0) => avatarStyleFromSeed(seed);

const getStatusMarkup = (status) => {
  const isTraveling = status === ITEM_STATUS.traveling;
  const label = isTraveling ? STATUS.traveling : STATUS.home;
  const dotClass = isTraveling ? "item-card__dot item-card__dot--traveling" : "item-card__dot";
  return `<p class="item-card__status"><span class="${dotClass}" aria-hidden="true"></span>${label}</p>`;
};

const cardTemplate = (item) => {
  const nickname = item.name || item.title || "未命名回忆";
  const traveling = item.status === ITEM_STATUS.traveling;
  const avatarInner = avatarMarkup(item, "avatar-img") || "";
  const avatarStyle = item.avatarImage ? "" : ` style="${getAvatarStyle(item.avatarSeed)}"`;
  return `
    <article
      class="item-card card-standard parallax-layer"
      role="listitem"
      tabindex="0"
      data-item-id="${item.id}"
      data-status="${item.status || ITEM_STATUS.traveling}"
      data-traveling="${traveling ? "1" : "0"}"
      data-parallax-depth="1.05"
      aria-label="${nickname}"
    >
      <div class="item-card__avatar"${avatarStyle}>${avatarInner}</div>
      <h2 class="item-card__name">${nickname}</h2>
      ${getStatusMarkup(item.status)}
    </article>
  `;
};

const render = () => {
  const items = getItems();

  if (!items.length) {
    gridEl.innerHTML = "";
    emptyEl.hidden = false;
    return;
  }

  emptyEl.hidden = true;
  gridEl.innerHTML = items.map(cardTemplate).join("");

  const cards = [...gridEl.querySelectorAll(".item-card")];
  cards.forEach((card, index) => {
    window.setTimeout(() => {
      card.classList.add("is-visible");
    }, 130 + index * 80);
  });
};

const navigateToItem = (id) => {
  if (!id) return;
  const item = getItems().find((it) => it.id === id);
  if (item?.status === ITEM_STATUS.home) {
    window.location.href = `./goodbye.html?id=${encodeURIComponent(id)}`;
    return;
  }
  window.location.href = `./item.html?id=${encodeURIComponent(id)}`;
};

const closeContextMenu = () => {
  contextMenuEl.hidden = true;
  contextItemId = null;
};

const openContextMenu = (event, itemId) => {
  contextItemId = itemId;
  contextMenuEl.hidden = false;

  const menuWidth = 140;
  const menuHeight = 52;
  const maxX = window.innerWidth - menuWidth - 8;
  const maxY = window.innerHeight - menuHeight - 8;
  const x = Math.min(event.clientX, maxX);
  const y = Math.min(event.clientY, maxY);

  contextMenuEl.style.left = `${Math.max(8, x)}px`;
  contextMenuEl.style.top = `${Math.max(8, y)}px`;
};

const endTrip = (itemId) => {
  if (!itemId) return;
  const result = endItemTrip(itemId);
  if (!result.ok) {
    window.alert("结束旅程失败，请稍后再试。");
    return;
  }
  window.location.assign(`./goodbye.html?id=${encodeURIComponent(itemId)}`);
};

const setupUnreadDot = () => {
  const unreadCount = getFavoritesUnreadCount();
  unreadDotEl.hidden = unreadCount <= 0;
};

const bindCardEvents = () => {
  gridEl.addEventListener("click", (event) => {
    const card = event.target.closest(".item-card");
    if (!card) return;
    navigateToItem(card.dataset.itemId);
  });

  gridEl.addEventListener("keydown", (event) => {
    const card = event.target.closest(".item-card");
    if (!card) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      navigateToItem(card.dataset.itemId);
    }
  });

  gridEl.addEventListener("contextmenu", (event) => {
    const card = event.target.closest(".item-card");
    if (!card) return;

    if (card.dataset.traveling !== "1") {
      closeContextMenu();
      return;
    }

    event.preventDefault();
    openContextMenu(event, card.dataset.itemId);
  });

  gridEl.addEventListener("pointerdown", (event) => {
    const card = event.target.closest(".item-card");
    if (!card || card.dataset.traveling !== "1") return;

    longPressTimer = window.setTimeout(() => {
      openContextMenu(event, card.dataset.itemId);
    }, 520);
  });

  const cancelLongPress = () => {
    if (longPressTimer) {
      window.clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  gridEl.addEventListener("pointerup", cancelLongPress);
  gridEl.addEventListener("pointercancel", cancelLongPress);
  gridEl.addEventListener("pointerleave", cancelLongPress);
};

const bindContextMenuEvents = () => {
  endTripBtnEl.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const itemId = contextItemId;
    if (!itemId) return;

    const first = window.confirm("确认要结束这段旅程吗？");
    if (!first) return;
    const second = window.confirm("确认后它会标记为“已回家”，并进入告别页。继续吗？");
    if (!second) return;

    closeContextMenu();
    endTrip(itemId);
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".context-menu")) {
      closeContextMenu();
    }
  });

  window.addEventListener("resize", closeContextMenu);
  window.addEventListener("scroll", closeContextMenu, { passive: true });
};

const init = () => {
  bootstrapItems();
  initPageEffects();
  render();
  setupUnreadDot();
  bindCardEvents();
  bindContextMenuEvents();
};

init();
