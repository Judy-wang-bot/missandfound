import { SAMPLE_ITEMS, STORAGE_KEYS } from "./data.js";
import { inferSilhouetteKind } from "./silhouette.js";

const ITEM_STATUS = {
  traveling: "traveling",
  home: "home"
};

const DEFAULT_FAREWELL_MESSAGE = "我替你看过这个世界啦，现在要回心里去了。别难过，我一直在。";

const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.error("[Miss&Found] 读取存储失败:", error);
    return fallback;
  }
};

const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error("[Miss&Found] 写入存储失败:", error);
    return false;
  }
};

const createItem = (draft) => {
  const now = new Date().toISOString();
  const description = String(draft.description || draft.memory || "").trim();
  const message = String(draft.message || "").trim();
  return {
    id: `item-${Date.now()}`,
    type: draft.type || "object",
    name: draft.name?.trim() || "未命名回忆",
    title: draft.title?.trim() || draft.name?.trim() || "未命名回忆",
    ownerAlias: draft.ownerAlias?.trim() || "匿名旅人",
    lostDate: draft.lostDate || new Date().toISOString().slice(0, 10),
    personality: draft.personality || "gentle",
    avatarSeed: Number.isFinite(draft.avatarSeed) ? draft.avatarSeed : Math.floor(Math.random() * 1000),
    avatarImage: draft.avatarImage || "",
    description,
    message,
    memory: description,
    silhouetteKind: draft.silhouetteKind || inferSilhouetteKind(description),
    status: ITEM_STATUS.traveling,
    createdAt: now,
    updatedAt: now
  };
};

const normalizeStatus = (status) =>
  status === ITEM_STATUS.home ? ITEM_STATUS.home : ITEM_STATUS.traveling;

const normalizeItem = (item) => {
  const description = String(item?.description || item?.memory || "").trim();
  const message = String(item?.message || "").trim();
  return {
    ...item,
    description,
    message,
    memory: description || item?.memory || "",
    silhouetteKind: item?.silhouetteKind || inferSilhouetteKind(description),
    status: normalizeStatus(item?.status)
  };
};

const getItems = () => {
  const items = read(STORAGE_KEYS.items, []);
  if (!Array.isArray(items)) return [];
  return items.map(normalizeItem);
};
const saveItems = (items) => write(STORAGE_KEYS.items, items);

const addItem = (draft) => {
  const items = getItems();
  const created = createItem(draft);
  const nextItems = [created, ...items];
  saveItems(nextItems);
  return created;
};

const bootstrapItems = () => {
  const existed = getItems();
  if (existed.length > 0) {
    return existed;
  }
  saveItems(SAMPLE_ITEMS);
  return SAMPLE_ITEMS;
};

const clearNamespace = () => {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
};

const endItemTrip = (itemId, farewellText = DEFAULT_FAREWELL_MESSAGE) => {
  if (!itemId) return { ok: false, reason: "missing-id" };

  const items = getItems();
  const target = items.find((item) => item.id === itemId);
  if (!target) return { ok: false, reason: "not-found" };

  const nextStatus = ITEM_STATUS.home;
  const endedAt = new Date().toISOString();
  const normalizedFarewell = String(farewellText || DEFAULT_FAREWELL_MESSAGE).trim() || DEFAULT_FAREWELL_MESSAGE;

  const nextItems = items.map((item) =>
    item.id === itemId
      ? {
          ...item,
          status: nextStatus,
          updatedAt: endedAt
        }
      : item
  );
  saveItems(nextItems);

  const conversations = read(STORAGE_KEYS.conversations, {});
  const list = Array.isArray(conversations[itemId]) ? conversations[itemId] : [];
  const alreadyAppended = list.some((msg) => msg?.type === "farewell");

  if (!alreadyAppended) {
    list.push({
      id: `c-${Date.now()}-farewell`,
      from: "bot",
      type: "farewell",
      text: normalizedFarewell,
      createdAt: endedAt
    });
    conversations[itemId] = list;
    write(STORAGE_KEYS.conversations, conversations);
  }

  return {
    ok: true,
    status: nextStatus,
    farewell: normalizedFarewell
  };
};

export {
  read,
  write,
  ITEM_STATUS,
  DEFAULT_FAREWELL_MESSAGE,
  getItems,
  saveItems,
  addItem,
  bootstrapItems,
  clearNamespace,
  endItemTrip
};
