import { MBTI_PERSONAS, STORAGE_KEYS, TRAVEL_LOCATIONS, locationToPostFields, resolvePersonality, getItemDescription, getItemMessage, pickRandom } from "./data.js";
import {
  bootstrapItems,
  DEFAULT_FAREWELL_MESSAGE,
  endItemTrip,
  getItems,
  ITEM_STATUS,
  read,
  write
} from "./storage.js";
import { initPageEffects } from "./effects.js";
import { generatePostContent, generateChatReply } from "./api.js";
import { applyAvatarToElement } from "./avatar.js";

const params = new URLSearchParams(window.location.search);
const itemId = params.get("id");

const profileNameEl = document.getElementById("profile-name");
const profileSignEl = document.getElementById("profile-sign");
const profileDaysEl = document.getElementById("profile-days");
const profileAvatarEl = document.getElementById("profile-avatar");
const menuBtnEl = document.getElementById("profile-menu-btn");

const timelineListEl = document.getElementById("timeline-list");
const refreshHintEl = document.getElementById("timeline-refresh");
const timelinePanelEl = document.getElementById("timeline-panel");
const chatPanelEl = document.getElementById("chat-panel");
const tabEls = [...document.querySelectorAll(".item-tab")];

const timelineHintEl = document.getElementById("timeline-hint");
const chatFormEl = document.getElementById("chat-form");
const chatInputEl = document.getElementById("chat-input");
const chatListEl = document.getElementById("chat-list");
const favToastEl = document.getElementById("fav-toast");
const itemMainEl = document.getElementById("item-main");
let toastTimer = null;
let autoPostTimer = null;
let chatBusy = false;

const now = () => new Date().toISOString();
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const personalityTheme = {
  quiet: ["#6f4cb3", "#235d74"],
  playful: ["#8b436f", "#384492"],
  gentle: ["#5f3e8f", "#2b3666"],
  longing: ["#7a4a7a", "#3a4a72"],
  /** 兼容旧性格键 */
  brave: ["#8b436f", "#384492"],
  dreamy: ["#5f3e8f", "#2b3666"]
};

const landmarks = Object.fromEntries(
  TRAVEL_LOCATIONS.map((loc) => [loc.name, loc.emoji])
);

const formatRelative = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min}分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}小时前`;
  const day = Math.floor(hour / 24);
  return `${day}天前`;
};

const daysFrom = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  return Math.max(1, Math.floor(diff / 86400000) + 1);
};

const getPostStore = () => read(STORAGE_KEYS.posts, []);
const setPostStore = (posts) => write(STORAGE_KEYS.posts, posts);

const getChatStore = () => read(STORAGE_KEYS.conversations, {});
const setChatStore = (convs) => write(STORAGE_KEYS.conversations, convs);

const getFavorites = () => read(STORAGE_KEYS.favorites, []);
const setFavorites = (items) => write(STORAGE_KEYS.favorites, items);

const getItem = () => getItems().find((it) => it.id === itemId);
const isTravelingItem = (item) => item?.status === ITEM_STATUS.traveling;

const getItemPosts = () =>
  getPostStore()
    .filter((p) => p.itemId === itemId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

const getPlaceholderImage = () =>
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

const getPersonaText = (item) => {
  const key = resolvePersonality(item?.personality);
  return MBTI_PERSONAS[key] || MBTI_PERSONAS.gentle;
};

const getRandomLocation = (exceptCity = "") => {
  const pool = TRAVEL_LOCATIONS.filter((loc) => loc.name !== exceptCity);
  return pool[Math.floor(Math.random() * pool.length)] || TRAVEL_LOCATIONS[0];
};

const createTravelPost = async (item, options = {}) => {
  const latest = getItemPosts()[0];
  const latestCity = latest?.city || "";
  const location = options.location || getRandomLocation(latestCity);
  const fields = locationToPostFields(location);
  const allItems = getItems();
  const canEncounter = allItems.length >= 2 && Math.random() < 0.3;
  const partner = canEncounter ? allItems.find((it) => it.id !== item.id) : null;

  let caption;
  if (partner) {
    caption = `在${fields.city}的${fields.spot}，我偶遇了${partner.name}。我们一起对着${fields.emoji}说：你一定也在认真生活。`;
  } else {
    caption = await generatePostContent(item, location);
  }

  return {
    id: `post-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    itemId: item.id,
    type: partner ? "encounter" : "normal",
    partnerItemId: partner?.id || null,
    city: fields.city,
    spot: fields.spot,
    emoji: fields.emoji,
    caption,
    createdAt: now()
  };
};

const ensureInitialPost = async (item) => {
  const posts = getPostStore();
  const existed = posts.some((p) => p.itemId === item.id);
  if (existed) return;
  const initPost = await createTravelPost(item, { location: getRandomLocation() });
  setPostStore([initPost, ...posts]);
};

const travelSign = (item, latestPost) => {
  if (!isTravelingItem(item)) {
    return "它已经安稳回家了。";
  }
  const city = latestPost?.city || "远方";
  const persona = getPersonaText(item);
  return `正在${city}替你看雾。${persona.tag}上线中。`;
};

const applyProfile = (item) => {
  const posts = getItemPosts();
  const latest = posts[0];
  profileNameEl.textContent = item.name || item.title || "未命名回忆";
  profileSignEl.textContent = travelSign(item, latest);
  profileDaysEl.textContent = `旅行第 ${daysFrom(item.createdAt || now())} 天`;
  applyAvatarToElement(profileAvatarEl, item);

  const [a, b] = personalityTheme[resolvePersonality(item.personality)] || personalityTheme.gentle;
  document.body.style.setProperty("--profile-grad-a", a);
  document.body.style.setProperty("--profile-grad-b", b);
};

const applyChatAvailability = (item) => {
  const canChat = isTravelingItem(item);
  chatInputEl.disabled = !canChat || chatBusy;
  chatInputEl.placeholder = canChat ? "输入想说的话..." : "它已经安稳回家了";
  chatInputEl.setAttribute("aria-disabled", String(!canChat));
  chatInputEl.classList.toggle("chat-input--disabled", !canChat);
};

const postImageMarkup = (post) => {
  const icon = post.emoji || landmarks[post.city] || "✨";
  const imageAlt = `${post.city} 旅行占位图`;
  const imageSrc = getPlaceholderImage();
  if (post.type === "encounter") {
    return `
      <div class="post-card__image">
        <img class="post-card__img-el" loading="lazy" src="${imageSrc}" alt="${escapeHtml(imageAlt)}" />
        <span class="encounter-flag">❤❤ 偶遇</span>
        <span class="post-card__landmark">${escapeHtml(post.city)} · ${escapeHtml(icon)}</span>
      </div>
    `;
  }
  return `
    <div class="post-card__image">
      <img class="post-card__img-el" loading="lazy" src="${imageSrc}" alt="${escapeHtml(imageAlt)}" />
      <span class="post-card__landmark">${escapeHtml(post.city)} · ${escapeHtml(icon)}</span>
    </div>
  `;
};

const isPostFaved = (postId) => getFavorites().some((it) => it.postId === postId);

const setFavButtonState = (btn, isFaved) => {
  btn.classList.toggle("is-faved", isFaved);
  const iconEl = btn.querySelector(".post-card__fav-icon");
  const textEl = btn.querySelector(".post-card__fav-text");
  if (iconEl) iconEl.textContent = isFaved ? "★" : "☆";
  if (textEl) textEl.textContent = isFaved ? "已珍藏" : "收藏";
};

const showSoftToast = (text) => {
  if (!favToastEl) return;
  favToastEl.textContent = text;
  favToastEl.classList.add("is-show");
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => favToastEl.classList.remove("is-show"), 1500);
};

const renderTimeline = () => {
  const posts = getItemPosts();
  if (!posts.length) {
    timelineListEl.innerHTML = `<article class="post-card"><p class="post-card__body text-body">正在准备第一条旅途动态...</p></article>`;
    return;
  }

  timelineListEl.innerHTML = posts
    .map((post) => {
      const faved = isPostFaved(post.id);
      return `
      <article class="post-card" data-post-id="${post.id}">
        ${postImageMarkup(post)}
        <p class="post-card__body text-body">${escapeHtml(post.caption)}</p>
        <p class="post-card__meta">
          <span>#${escapeHtml(post.city)} · ${formatRelative(post.createdAt)}</span>
          <button class="post-card__fav ${faved ? "is-faved" : ""}" type="button" data-fav-post="${post.id}">
            <span class="post-card__fav-icon" aria-hidden="true">${faved ? "★" : "☆"}</span>
            <span class="post-card__fav-text">${faved ? "已珍藏" : "收藏"}</span>
          </button>
        </p>
      </article>
      `;
    })
    .join("");
};

const renderChat = () => {
  const store = getChatStore();
  const list = store[itemId] || [];
  if (!list.length) {
    chatListEl.innerHTML = `<p class="chat-empty text-body">还没有对话，发第一条消息吧。</p>`;
    return;
  }
  chatListEl.innerHTML = list
    .map(
      (msg) => `
      <div class="chat-msg chat-msg--${msg.from === "user" ? "user" : "bot"} text-body">${escapeHtml(msg.text)}</div>
    `
    )
    .join("");

  chatListEl.scrollTop = chatListEl.scrollHeight;
};

const buildTravelIntroMessages = (item) => {
  const name = item.name || "旅伴";
  const description = getItemDescription(item);
  const message = getItemMessage(item);
  const persona = getPersonaText(item);
  const tone = pickRandom(persona.tones || ["路上风景很好，我会慢慢寄给你。"]);

  const lines = [`${name}：我已经平安出发啦。`];
  if (description) {
    const snippet = description.length > 48 ? `${description.slice(0, 48)}…` : description;
    lines.push(`我还记得你描述我的样子：${snippet}`);
  } else {
    lines.push(tone);
  }
  if (message) {
    lines.push(`你留下的话，我会一直带着：「${message}」`);
  } else {
    lines.push("路上风景很好，我会慢慢寄给你。");
  }
  return lines;
};

const ensureInitialChat = (item) => {
  const store = getChatStore();
  if (Array.isArray(store[item.id]) && store[item.id].length > 0) return;
  const ts = Date.now();
  store[item.id] = buildTravelIntroMessages(item).map((text, index) => ({
    id: `c-${ts}-${index + 1}`,
    from: "bot",
    text,
    createdAt: now()
  }));
  setChatStore(store);
};

const addPost = (post) => {
  const posts = getPostStore();
  setPostStore([post, ...posts]);
};

const addAutoPost = async (item, source = "timer") => {
  const post = await createTravelPost(item);
  addPost(post);
  renderTimeline();
  if (source === "refresh") {
    refreshHintEl.textContent = "刷新完成，新的风景已抵达。";
    window.setTimeout(() => {
      refreshHintEl.textContent = "下拉可刷新动态";
    }, 1200);
  }
  applyProfile(item);
};

const bindFavorite = (item) => {
  timelineListEl.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-fav-post]");
    if (!btn) return;

    const postId = btn.dataset.favPost;
    const posts = getPostStore();
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const favorites = getFavorites();
    const existed = favorites.some((it) => it.postId === postId);
    if (!existed) {
      favorites.unshift({
        id: `fav-${Date.now()}`,
        postId,
        itemId: post.itemId,
        itemName: item.name || item.title || "匿名旅伴",
        postImage: getPlaceholderImage(),
        postText: post.caption,
        postLocation: post.city,
        favoritedAt: now(),
        city: post.city,
        caption: post.caption,
        createdAt: now(),
        unread: true
      });
      setFavorites(favorites);
      setFavButtonState(btn, true);
      btn.classList.add("is-pressed", "is-bounce");
      if (navigator.vibrate) navigator.vibrate(20);
      showSoftToast("已珍藏到明信片墙");
      window.setTimeout(() => btn.classList.remove("is-pressed", "is-bounce"), 180);
      return;
    }

    setFavorites(favorites.filter((it) => it.postId !== postId));
    setFavButtonState(btn, false);
    btn.classList.add("is-pressed", "is-bounce");
    if (navigator.vibrate) navigator.vibrate(12);
    showSoftToast("已取消珍藏");
    window.setTimeout(() => btn.classList.remove("is-pressed", "is-bounce"), 180);
  });
};

const renderItemError = (text) => {
  const profile = document.getElementById("item-profile");
  const dock = document.querySelector(".item-dock");
  if (profile) profile.hidden = true;
  if (dock) dock.hidden = true;
  itemMainEl.innerHTML = `
    <section class="glass-card card-standard item-error">
      <h1 class="title">这段旅程暂时找不到了</h1>
      <p class="subtitle text-body">${text}</p>
      <a class="btn" href="./museum.html">回到博物馆</a>
    </section>
  `;
};

const bindKeyboardAvoid = () => {
  chatInputEl.addEventListener("focus", () => {
    window.setTimeout(() => {
      chatFormEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 120);
  });
};

const bindTabs = () => {
  tabEls.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      tabEls.forEach((el) => el.classList.toggle("is-active", el === tab));
      const timelineOn = target === "timeline";
      timelinePanelEl.classList.toggle("is-active", timelineOn);
      chatPanelEl.classList.toggle("is-active", !timelineOn);
      timelineHintEl.hidden = !timelineOn;
      chatFormEl.hidden = timelineOn;
    });
  });
};

const bindChat = (item) => {
  chatFormEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!isTravelingItem(item) || chatBusy) return;
    const text = chatInputEl.value.trim();
    if (!text) return;

    chatBusy = true;
    applyChatAvailability(item);

    const store = getChatStore();
    const list = store[item.id] || [];
    list.push({ id: `c-${Date.now()}-u`, from: "user", text, createdAt: now() });
    store[item.id] = list;
    setChatStore(store);
    chatInputEl.value = "";
    renderChat();

    try {
      const reply = await generateChatReply(item, text, list);
      list.push({ id: `c-${Date.now()}-b`, from: "bot", text: reply, createdAt: now() });
      store[item.id] = list;
      setChatStore(store);
      renderChat();
    } finally {
      chatBusy = false;
      applyChatAvailability(item);
    }
  });
};

const bindEndTrip = (item) => {
  menuBtnEl.addEventListener("click", () => {
    const first = window.confirm("确认要结束这段旅程吗？");
    if (!first) return;
    const second = window.confirm("确认后它会标记为“已回家”，并进入告别页。继续吗？");
    if (!second) return;

    const result = endItemTrip(item.id, DEFAULT_FAREWELL_MESSAGE);
    if (!result.ok) {
      window.alert("结束旅程失败，请稍后再试。");
      return;
    }
    window.location.assign(`./goodbye.html?id=${encodeURIComponent(item.id)}`);
  });
};

const bindPullToRefresh = (item) => {
  let startY = 0;
  let delta = 0;
  let pulling = false;

  window.addEventListener(
    "touchstart",
    (event) => {
      if (!timelinePanelEl.classList.contains("is-active")) return;
      if (window.scrollY > 0) return;
      startY = event.touches[0].clientY;
      pulling = true;
    },
    { passive: true }
  );

  window.addEventListener(
    "touchmove",
    (event) => {
      if (!pulling) return;
      delta = clamp(event.touches[0].clientY - startY, 0, 120);
      if (delta > 8) {
        refreshHintEl.textContent = delta > 72 ? "松手刷新动态" : "继续下拉以刷新";
      }
    },
    { passive: true }
  );

  window.addEventListener("touchend", async () => {
    if (!pulling) return;
    if (delta > 72) {
      await addAutoPost(item, "refresh");
    } else {
      refreshHintEl.textContent = "下拉可刷新动态";
    }
    pulling = false;
    delta = 0;
  });
};

const init = async () => {
  initPageEffects();
  bootstrapItems();
  const item = getItem();
  if (!itemId || !item) {
    renderItemError("链接参数缺失或这个物品已不存在。");
    return;
  }

  if (!isTravelingItem(item)) {
    window.location.replace(`./goodbye.html?id=${encodeURIComponent(item.id)}`);
    return;
  }

  await ensureInitialPost(item);
  ensureInitialChat(item);
  applyProfile(item);
  applyChatAvailability(item);
  renderTimeline();
  renderChat();

  bindFavorite(item);
  bindTabs();
  bindChat(item);
  bindEndTrip(item);
  bindPullToRefresh(item);
  bindKeyboardAvoid();

  autoPostTimer = window.setInterval(() => {
    if (!document.hidden && isTravelingItem(item)) {
      addAutoPost(item, "timer");
    }
  }, 30000);
};

init();
