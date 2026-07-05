/**
 * 头像与照片处理
 * 提供头像上传压缩、剪影生成、头像渲染等工具函数。
 */

const AVATAR_PALETTES = [
  ["#6f4cb3", "#235d74"],
  ["#8b436f", "#384492"],
  ["#5f3e8f", "#2b3666"],
  ["#7a4a7a", "#3a4a72"],
  ["#4a6fa5", "#2e5a6b"],
  ["#8f5a3c", "#3d4a6b"],
  ["#5a8f6e", "#3b4a72"],
  ["#a85d7b", "#2b4f66"]
];

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
 * 将文件压缩为 base64 Data URL
 * @param {File} file - 图片文件
 * @param {number} maxSize - 最大边长（像素）
 * @param {number} quality - JPEG 压缩质量 0-1
 * @returns {Promise<string>} base64 Data URL
 */
const compressImage = (file, maxSize = 300, quality = 0.7) =>
  new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("请选择图片文件"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else if (height > maxSize) {
          width *= maxSize / height;
          height = maxSize;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("图片加载失败"));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });

/**
 * 根据 seed 生成剪影渐变
 * @param {number} seed
 * @returns {string} CSS background 值
 */
const avatarStyleFromSeed = (seed = 0) => {
  const [a, b] = pickBySeed(AVATAR_PALETTES, seed);
  return `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.55), transparent 40%), radial-gradient(circle at 62% 68%, ${a}, ${b})`;
};

/**
 * 生成头像 HTML
 * @param {object} item
 * @param {string} imgClass - 图片元素类名
 * @returns {string} HTML 字符串
 */
const avatarMarkup = (item, imgClass = "avatar-img") => {
  const src = item?.avatarImage;
  if (!src) return "";
  const alt = escapeHtml(item?.name || item?.title || "头像");
  return `<img class="${imgClass}" src="${src}" alt="${alt}" loading="lazy" />`;
};

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

/**
 * 将头像渲染到容器元素中
 * @param {HTMLElement} element
 * @param {object} item
 */
const applyAvatarToElement = (element, item) => {
  if (!element) return;
  const src = item?.avatarImage;
  if (src) {
    element.classList.add("has-avatar-img");
    element.style.background = "";
    element.innerHTML = avatarMarkup(item, "avatar-img");
    return;
  }
  element.classList.remove("has-avatar-img");
  element.innerHTML = "";
  const seed = Number.isFinite(item?.avatarSeed) ? item.avatarSeed : Math.floor(Math.random() * 1000);
  element.style.background = avatarStyleFromSeed(seed);
};

export { compressImage, avatarStyleFromSeed, avatarMarkup, applyAvatarToElement };
