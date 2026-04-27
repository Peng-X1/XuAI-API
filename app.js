const FIXED_PROVIDER_ID = "xuai";
const FIXED_PROVIDER_NAME = "XuAI API 中转站";
const FIXED_API_BASE = "https://api.xuai.chat";

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
  console.log("XuAI app.js 已加载");

  const savedTheme = localStorage.getItem("xuai-theme");
  if (savedTheme === "light") {
    document.body.classList.add("light");
    if (themeBtn) themeBtn.textContent = "☀️";
  }

  lockProviderSettings();

  const savedModel = localStorage.getItem("xuai-model") || "gpt-image-2";
  setModel(savedModel);

  bindEvents();
  updateApiInfo();
}

function bindEvents() {
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      document.body.classList.toggle("light");
      const isLight = document.body.classList.contains("light");
      localStorage.setItem("xuai-theme", isLight ? "light" : "dark");
      themeBtn.textContent = isLight ? "☀️" : "🌙";
    });
  }

  if (provider) {
    provider.addEventListener("change", lockProviderSettings);
  }

  if (apiBase) {
    apiBase.addEventListener("input", lockProviderSettings);
  }

  if (toggleKeyBtn && apiKey) {
    toggleKeyBtn.addEventListener("click", () => {
      const isPassword = apiKey.type === "password";
      apiKey.type = isPassword ? "text" : "password";
      toggleKeyBtn.textContent = isPassword ? "隐藏" : "显示";
    });
  }

  $$(".model-card").forEach((card) => {
    card.addEventListener("click", () => {
      setModel(card.dataset.model);
    });
  });

  if (modelSelect) {
    modelSelect.addEventListener("change", () => {
      setModel(modelSelect.value);
    });
  }

  if (demoMode) {
    demoMode.addEventListener("change", updateApiInfo);
  }

  if (form) {
    form.addEventListener("submit", handleGenerate);
  }
}

function lockProviderSettings() {
  localStorage.removeItem("xuai-provider");
  localStorage.removeItem("xuai-api-base");

  if (provider) {
    provider.innerHTML = `<option value="${FIXED_PROVIDER_ID}" selected>${FIXED_PROVIDER_NAME}</option>`;
    provider.value = FIXED_PROVIDER_ID;
    provider.disabled = true;
  }

  if (apiBase) {
    apiBase.value = FIXED_API_BASE;
    apiBase.readOnly = true;
    apiBase.disabled = true;
  }
}

function setModel(model) {
  if (!model) model = "gpt-image-2";

  if (modelSelect) {
    const exists = Array.from(modelSelect.options).some((option) => option.value === model);
    if (exists) {
      modelSelect.value = model;
    }
  }

  if (currentModelText) currentModelText.textContent = model;
  if (modelBadge) modelBadge.textContent = model;

  $$(".model-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.model === model);
  });

  localStorage.setItem("xuai-model", model);
  updateApiInfo();
}

function updateApiInfo() {
  const model = modelSelect?.value || "gpt-image-2";
  const isDemo = demoMode?.checked;

  if (apiModeBadge) {
    apiModeBadge.textContent = isDemo ? "演示模式" : "真实 API";
  }

  if (apiInfoTitle) {
    apiInfoTitle.textContent = `当前使用 ${model}`;
  }

  if (apiInfoDesc) {
    if (isDemo) {
      apiInfoDesc.textContent =
        "当前为演示模式，不会调用真实 API，只会生成占位预览图。";
    } else {
      apiInfoDesc.textContent =
        `真实 API 模式会调用 ${FIXED_API_BASE}/v1/images/generations。`;
    }
  }
}

async function handleGenerate(event) {
  event.preventDefault();

  console.log("点击了生成图片按钮");

  lockProviderSettings();

  const prompt = promptInput?.value.trim() || "";
  const model = modelSelect?.value || "gpt-image-2";
  const size = sizeSelect?.value || "1024x1024";
  const quality = qualitySelect?.value || "auto";
  const count = clamp(Number(countInput?.value || 1), 1, 4);
  const baseURL = normalizeBaseUrl(FIXED_API_BASE);
  const key = apiKey?.value.trim() || "";

  if (!prompt) {
    setStatus("请先输入 Prompt。", "warning");
    promptInput?.focus();
    return;
  }

  if (generateBtn) {
    generateBtn.disabled = true;
    generateBtn.textContent = "生成中...";
  }

  if (debugBox) {
    debugBox.classList.remove("show");
    debugBox.textContent = "";
  }

  try {
    if (demoMode?.checked) {
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

    if (!key) {
      throw new Error("请填写 API Key，或者开启演示模式。");
    }

    setStatus("正在调用 XuAI API 中转站...", "loading");

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
    setStatus("图片生成完成。", "success");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "生成失败，请查看控制台。", "error");

    showDebug({
      error: error.message,
      request_url: `${FIXED_API_BASE}/v1/images/generations`,
      tip: "如果浏览器控制台显示 CORS 错误，需要在你的中转站配置跨域访问。",
    });
  } finally {
    if (generateBtn) {
      generateBtn.disabled = false;
      generateBtn.textContent = "生成图片";
    }
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
  const url = `${baseURL}/v1/images/generations`;

  console.log("准备请求：", url);

  const payload = {
    model,
    prompt,
    size,
    n: count,
  };

  if (quality && quality !== "auto") {
    payload.quality = quality;
  }

  console.log("请求参数：", payload);

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
      raw?.raw ||
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
    throw new Error("API 返回成功，但没有找到图片 URL 或 base64 图片数据。");
  }

  return {
    images,
    raw,
  };
}

function renderImages(images, meta) {
  if (!gallery) return;

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
  if (!statusText) return;

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
  if (!debugBox) return;

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
  return String(url || "").replace(/\/+$/, "");
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
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}