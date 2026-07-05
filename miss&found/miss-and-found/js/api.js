/**
 * 内容生成 API（本地模板版）
 * 基于物品性格与旅行地点生成朋友圈文案和聊天回复。
 */

import {
  POST_TEMPLATES,
  TRAVEL_LOCATIONS,
  WEATHER_WORDS,
  DEFAULT_REPLIES,
  pickRandom,
  fillTemplate,
  matchKeywordReply,
  locationToPostFields,
  resolvePersonality
} from "./data.js";

/**
 * 生成旅行朋友圈文案
 * @param {object} item
 * @param {object} location - TRAVEL_LOCATIONS 中的地点对象
 * @returns {Promise<string>}
 */
const generatePostContent = async (item, location) => {
  const fields = locationToPostFields(location);
  const personality = resolvePersonality(item?.personality);
  const templates = POST_TEMPLATES[personality] || POST_TEMPLATES.gentle;
  const template = pickRandom(templates);
  const weather = pickRandom(WEATHER_WORDS);
  return fillTemplate(template, {
    location: fields.city,
    spot: fields.spot,
    weather,
    emoji: fields.emoji,
    name: item?.name || item?.title || "你"
  });
};

/**
 * 生成聊天回复
 * @param {object} item
 * @param {string} text - 用户输入
 * @param {Array} list - 当前对话历史
 * @returns {Promise<string>}
 */
const generateChatReply = async (item, text, list) => {
  const keywordReply = matchKeywordReply(text);
  if (keywordReply) return keywordReply;

  const fields = locationToPostFields(pickRandom(TRAVEL_LOCATIONS));
  const weather = pickRandom(WEATHER_WORDS);
  const template = pickRandom(DEFAULT_REPLIES);
  return fillTemplate(template, {
    name: item?.name || item?.title || "你",
    location: fields.city,
    weather
  });
};

export { generatePostContent, generateChatReply };
