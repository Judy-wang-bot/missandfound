/**
 * 剪影推断与样式
 * 根据物品描述推断剪影类型，并生成对应的 CSS 背景与标签。
 */

import { pickRandom } from "./data.js";

const SILHOUETTE_KINDS = {
  book: {
    label: "书本剪影",
    keywords: ["书", "笔记本", "日记", "本子", "页", "纸", "笔", "写"],
    style: (seed) => {
      const hues = ["#6f4cb3", "#384492", "#5f3e8f"];
      const c1 = pickBySeed(hues, seed);
      const c2 = pickBySeed(hues, seed + 1);
      return `radial-gradient(circle at 40% 35%, rgba(255,255,255,0.45), transparent 42%), radial-gradient(circle at 70% 70%, ${c1}, ${c2})`;
    }
  },
  pet: {
    label: "小动物剪影",
    keywords: ["狗", "犬", "猫", "宠", "毛", "尾巴", "铃铛", "爪", "喵", "汪"],
    style: (seed) => {
      const hues = ["#8b5a3c", "#7a4a7a", "#8b436f"];
      const c1 = pickBySeed(hues, seed);
      const c2 = pickBySeed(hues, seed + 1);
      return `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.5), transparent 40%), radial-gradient(circle at 65% 68%, ${c1}, ${c2})`;
    }
  },
  jewelry: {
    label: "小物剪影",
    keywords: ["戒", "链", "手", "表", "项", "环", "饰", "钥匙", "扣", "包", "钱包"],
    style: (seed) => {
      const hues = ["#a85d7b", "#4a6fa5", "#5a8f6e"];
      const c1 = pickBySeed(hues, seed);
      const c2 = pickBySeed(hues, seed + 1);
      return `radial-gradient(circle at 50% 35%, rgba(255,255,255,0.48), transparent 38%), radial-gradient(circle at 50% 70%, ${c1}, ${c2})`;
    }
  },
  toy: {
    label: "玩偶剪影",
    keywords: ["娃", "熊", "玩偶", "玩具", "偶", "布", "软"],
    style: (seed) => {
      const hues = ["#8b436f", "#a85d7b", "#7a4a7a"];
      const c1 = pickBySeed(hues, seed);
      const c2 = pickBySeed(hues, seed + 1);
      return `radial-gradient(circle at 42% 32%, rgba(255,255,255,0.52), transparent 44%), radial-gradient(circle at 60% 72%, ${c1}, ${c2})`;
    }
  },
  default: {
    label: "温柔剪影",
    keywords: [],
    style: (seed) => {
      const hues = ["#5f3e8f", "#235d74", "#3a4a72"];
      const c1 = pickBySeed(hues, seed);
      const c2 = pickBySeed(hues, seed + 1);
      return `radial-gradient(circle at 38% 30%, rgba(255,255,255,0.5), transparent 40%), radial-gradient(circle at 62% 70%, ${c1}, ${c2})`;
    }
  }
};

const seededRandom = (seed) => {
  const n = Number.isFinite(seed) ? seed : 0;
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const pickBySeed = (list, seed) => {
  if (!Array.isArray(list) || list.length === 0) return "";
  return list[Math.floor(seededRandom(seed) * list.length)];
};

/**
 * 根据描述推断剪影类型
 * @param {string} description
 * @returns {string} kind 键名
 */
const inferSilhouetteKind = (description = "") => {
  const text = String(description).toLowerCase();
  for (const [kind, config] of Object.entries(SILHOUETTE_KINDS)) {
    if (kind === "default") continue;
    if (config.keywords.some((kw) => text.includes(kw))) return kind;
  }
  return "default";
};

/**
 * 获取剪影样式
 * @param {string} kind
 * @param {number} seed
 * @returns {string} CSS background 值
 */
const silhouetteStyleForKind = (kind, seed = 0) => {
  const config = SILHOUETTE_KINDS[kind] || SILHOUETTE_KINDS.default;
  return config.style(seed);
};

/**
 * 获取剪影标签
 * @param {string} kind
 * @returns {string}
 */
const silhouetteLabelForKind = (kind) => {
  const config = SILHOUETTE_KINDS[kind] || SILHOUETTE_KINDS.default;
  return config.label;
};

export { inferSilhouetteKind, silhouetteStyleForKind, silhouetteLabelForKind };
