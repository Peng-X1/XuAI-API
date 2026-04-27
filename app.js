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
  const model = modelSelect?.value || "gpt-image-1";

  if (apiModeBadge) {
    apiModeBadge.textContent = "真实 API";
  }

  if (apiInfoTitle) {
    apiInfoTitle.textContent = `当前使用 ${model}`;
  }

  if (apiInfoDesc) {
    apiInfoDesc.textContent =
      `真实 API 模式会调用 ${FIXED_API_BASE}/v1/images/generations。`;
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
    if (!key) {
      throw new Error("请填写 API Key。");
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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}