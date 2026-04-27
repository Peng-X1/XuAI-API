const providerPresets = {
  openai: {
    name: "OpenAI 官方",
    base: "https://api.openai.com/v1",
  },
  zetatechs: {
    name: "ZetaTechs Enterprise",
    base: "https://api.zetatechs.com/v1",
  },
  custom: {
    name: "自定义接口",
    base: "",
  },
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const form = $("#imageForm");
const provider = $("#provider");
const apiBase = $("#apiBase");
const apiKey = $("#apiKey");
const toggleKeyBtn = $("#toggleKeyBtn");
const modelSelect = $("#model");
const promptInput = $("#prompt");
const sizeSelect = $("#size");
const qualitySelect = $("#quality");
const countInput = $("#count");
const demoMode = $("#demoMode");
const generateBtn = $("#generateBtn");

const currentModelText = $("#currentModelText");
const modelBadge = $("#modelBadge");
const statusText = $("#statusText");
const apiModeBadge = $("#apiModeBadge");
const apiInfoTitle = $("#apiInfoTitle");
const apiInfoDesc = $("#apiInfoDesc");
const gallery = $("#gallery");
const debugBox = $("#debugBox");
const themeBtn = $("#themeBtn");

init();

function init() {
  const savedTheme = localStorage.getItem("xuai-theme");
  if (savedTheme === "light") {
    document.body.classList.add("light");
    themeBtn.textContent = "☀️";
  }

  const savedProvider = localStorage.getItem("xuai-provider") || "openai";
  provider.value = savedProvider;

  const savedApiBase = localStorage.getItem("xuai-api-base");
  apiBase.value = savedApiBase || providerPresets[savedProvider].base;

  const savedModel = localStorage.getItem("xuai-model") || "gpt-image-2";
  setModel(savedModel);

  bindEvents();
  updateApiInfo();
}

function bindEvents() {
  themeBtn.addEventListener("click", () => {
    document.body.classList.toggle("light");
    const isLight = document.body.classList.contains("light");
    localStorage.setItem("xuai-theme", isLight ? "light" : "dark");
    themeBtn.textContent = isLight ? "☀️" : "🌙";
  });

  provider.addEventListener("change", () => {
    const selected = provider.value;
    localStorage.setItem("xuai-provider", selected);

    if (selected !== "custom") {
      apiBase.value = providerPresets[selected].base;
      localStorage.setItem("xuai-api-base", apiBase.value);
    }

    updateApiInfo();
  });

  apiBase.addEventListener("input", () => {
    localStorage.setItem("xuai-api-base", apiBase.value.trim());
    updateApiInfo();
  });

  toggleKeyBtn.addEventListener("click", () => {
    const isPassword = apiKey.type === "password";
    apiKey.type = isPassword ? "text" : "password";
    toggleKeyBtn.textContent = isPassword ? "隐藏" : "显示";
  });

  $$(".model-card").forEach((card) => {
    card.addEventListener("click", () => {
      setModel(card.dataset.model);
    });
  });

  modelSelect.addEventListener("change", () => {
    setModel(modelSelect.value);
  });

  demoMode.addEventListener("change", updateApiInfo);

  form.addEventListener("submit", handleGenerate);
}

function setModel(model) {
  modelSelect.value = model;
  currentModelText.textContent = model;
  modelBadge.textContent = model;

  $$(".model-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.model === model);
  });

  localStorage.setItem("xuai-model", model);
  updateApiInfo();
}

function updateApiInfo() {
  const model = modelSelect.value;
  const isDemo = demoMode.checked;

  apiModeBadge.textContent = isDemo ? "演示模式" : "真实 API";
  apiInfoTitle.textContent = `当前使用 ${model}`;

  if (isDemo) {
    apiInfoDesc.textContent =
      "默认演示模式不会消耗额度，会在前端生成占位预览图，用来测试页面和 GitHub Pages 部署。";
  } else {
    apiInfoDesc.textContent =
      "真实 API 模式会尝试调用 API Base URL 下的 /images/generations 接口。请注意静态网页暴露 API Key 的风险。";
  }
}

async function handleGenerate(event) {
  event.preventDefault();

  const prompt = promptInput.value.trim();
  const model = modelSelect.value;
  const size = sizeSelect.value;
  const quality = qualitySelect.value;
  const count = clamp(Number(countInput.value || 1), 1, 4);
  const baseURL = normalizeBaseUrl(apiBase.value.trim());
  const key = apiKey.value.trim();

  if (!prompt) {
    setStatus("请先输入 Prompt。", "warning");
    promptInput.focus();
    return;
  }

  generateBtn.disabled = true;
  generateBtn.textContent = "生成中...";
  debugBox.classList.remove("show");
  debugBox.textContent = "";

  try {
    if (demoMode.checked) {
      setStatus("演示模式生成中...", "loading");
      await sleep(650);

      const images = Array.from({ length: count }, (_, index) =>
        createDemoImage({
          prompt,
          model,
          size,
          index: index + 1,
        })
      );

      renderImages(images, {
        model,
        prompt,
        isDemo: true,
      });

      setStatus("演示图片已生成。", "success");
      return;
    }

    if (!baseURL) {
      throw new Error("请填写 API Base URL。");
    }

    if (!key) {
      throw new Error("请填写 API Key，或者重新开启演示模式。");
    }

    setStatus("正在调用真实 API...", "loading");

    const result = await callImageGenerationApi({
      baseURL,
      key,
      model,
      prompt,
      size,
      quality,
      count,
    });

    renderImages(result.images, {
      model,
      prompt,
      isDemo: false,
    });

    showDebug(result.raw);
    setStatus("真实 API 调用完成。", "success");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "生成失败，请查看控制台。", "error");
    showDebug({
      error: error.message,
      tip: "如果是浏览器 CORS 报错，说明该 API 不允许静态网页直接调用，需要增加后端代理。",
    });
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = "生成图片";
  }
}

async function callImageGenerationApi({
  baseURL,
  key,
  model,
  prompt,
  size,
  quality,
  count,
}) {
  const url = `${baseURL}/images/generations`;

  const payload = {
    model,
    prompt,
    size,
    n: count,
  };

  if (quality && quality !== "auto") {
    payload.quality = quality;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(payload),
  });

  const raw = await safeJson(response);

  if (!response.ok) {
    const message =
      raw?.error?.message ||
      raw?.message ||
      `API 请求失败：HTTP ${response.status}`;
    throw new Error(message);
  }

  const data = Array.isArray(raw?.data) ? raw.data : [];

  const images = data
    .map((item) => {
      if (item.url) return item.url;
      if (item.b64_json) return `data:image/png;base64,${item.b64_json}`;
      if (item.image_base64) return `data:image/png;base64,${item.image_base64}`;
      return null;
    })
    .filter(Boolean);

  if (!images.length) {
    throw new Error("API 返回成功，但没有找到图片 URL 或 base64 数据。");
  }

  return {
    images,
    raw,
  };
}

function renderImages(images, meta) {
  gallery.classList.remove("empty");

  const html = `
    <div class="result-grid">
      ${images
        .map((src, index) => {
          const filename = `xuai-${meta.model}-${index + 1}.png`;
          return `
            <article class="result-card">
              <img src="${src}" alt="AI 生成图片 ${index + 1}" />
              <footer>
                <small>${meta.isDemo ? "Demo" : "API"} #${index + 1}</small>
                <a href="${src}" download="${filename}" target="_blank" rel="noreferrer">
                  下载
                </a>
              </footer>
            </article>
          `;
        })
        .join("")}
    </div>
  `;

  gallery.innerHTML = html;
}

function createDemoImage({ prompt, model, size, index }) {
  const [w, h] = size.split("x").map(Number);
  const safePrompt = escapeXml(truncate(prompt, 120));
  const now = new Date().toLocaleString();

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#10243d"/>
      <stop offset="45%" stop-color="#101827"/>
      <stop offset="100%" stop-color="#25134a"/>
    </linearGradient>
    <radialGradient id="glow" cx="35%" cy="25%" r="60%">
      <stop offset="0%" stop-color="#19b7ff" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#19b7ff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect width="100%" height="100%" fill="url(#glow)"/>
  <circle cx="${w * 0.78}" cy="${h * 0.22}" r="${Math.min(w, h) * 0.16}" fill="#65e8ff" opacity="0.18"/>
  <circle cx="${w * 0.22}" cy="${h * 0.76}" r="${Math.min(w, h) * 0.22}" fill="#7c3aed" opacity="0.2"/>
  <rect x="${w * 0.08}" y="${h * 0.08}" width="${w * 0.84}" height="${h * 0.84}" rx="36"
    fill="rgba(255,255,255,0.05)" stroke="rgba(101,232,255,0.35)" stroke-width="3"/>
  <text x="${w * 0.12}" y="${h * 0.18}" fill="#65e8ff" font-size="${Math.max(28, w * 0.045)}" font-family="Arial, Microsoft YaHei" font-weight="700">
    XuAI Demo Image #${index}
  </text>
  <text x="${w * 0.12}" y="${h * 0.28}" fill="#e8eef8" font-size="${Math.max(24, w * 0.035)}" font-family="Arial, Microsoft YaHei" font-weight="700">
    ${model}
  </text>
  <foreignObject x="${w * 0.12}" y="${h * 0.36}" width="${w * 0.76}" height="${h * 0.28}">
    <div xmlns="http://www.w3.org/1999/xhtml"
      style="font-family:Arial,'Microsoft YaHei';color:#cbd5e1;font-size:${Math.max(18, w * 0.025)}px;line-height:1.55;">
      ${safePrompt}
    </div>
  </foreignObject>
  <text x="${w * 0.12}" y="${h * 0.82}" fill="#9aa4b6" font-size="${Math.max(16, w * 0.02)}" font-family="Arial, Microsoft YaHei">
    ${escapeXml(now)} · ${w}x${h}
  </text>
</svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function setStatus(message, type = "info") {
  statusText.textContent = message;

  const colorMap = {
    info: "",
    loading: "var(--primary)",
    success: "var(--success)",
    warning: "var(--warning)",
    error: "var(--danger)",
  };

  statusText.style.color = colorMap[type] || "";
}

function showDebug(data) {
  debugBox.textContent =
    typeof data === "string" ? data : JSON.stringify(data, null, 2);
  debugBox.classList.add("show");
}

async function safeJson(response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return {
      raw: text,
    };
  }
}

function normalizeBaseUrl(url) {
  return url.replace(/\/+$/, "");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function truncate(text, length) {
  if (text.length <= length) return text;
  return `${text.slice(0, length)}...`;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
