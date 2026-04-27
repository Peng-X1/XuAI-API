const FIXED_PROVIDER_ID = "xuai";
const FIXED_PROVIDER_NAME = "XuAI API 中转站";
const FIXED_API_BASE = "https://api.xuai.chat";

const DEFAULT_IMAGE_MODEL = "gpt-image-2";

const RESPONSES_IMAGE_MODELS = new Set(["gpt-5.4"]);

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

  normalizeModelDom();
  lockProviderSettings();

  const savedModel = normalizeModelName(
    localStorage.getItem("xuai-model") || DEFAULT_IMAGE_MODEL
  );

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
      const model = normalizeModelName(card.dataset.model);
      setModel(model);
    });
  });

  if (modelSelect) {
    modelSelect.addEventListener("change", () => {
      const model = normalizeModelName(modelSelect.value);
      setModel(model);
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

function normalizeModelDom() {
  if (modelSelect) {
    Array.from(modelSelect.options).forEach((option) => {
      if (option.value === "gpt-5.4-image") {
        option.value = "gpt-5.4";
        option.textContent = "gpt-5.4";
      }
    });
  }

  $$(".model-card").forEach((card) => {
    if (card.dataset.model === "gpt-5.4-image") {
      card.dataset.model = "gpt-5.4";
    }
  });
}

function normalizeModelName(model) {
  const value = String(model || "").trim();

  if (value === "gpt-5.4-image") {
    return "gpt-5.4";
  }

  return value;
}

function ensureModelOption(model) {
  if (!modelSelect || !model) return;

  const exists = Array.from(modelSelect.options).some(
    (option) => option.value === model
  );

  if (!exists) {
    const option = document.createElement("option");
    option.value = model;
    option.textContent = model;
    modelSelect.appendChild(option);
  }
}

function setModel(model) {
  model = normalizeModelName(model);

  if (!model) {
    model = DEFAULT_IMAGE_MODEL;
  }

  ensureModelOption(model);

  if (modelSelect) {
    modelSelect.value = model;
  }

  if (currentModelText) {
    currentModelText.textContent = model;
  }

  if (modelBadge) {
    modelBadge.textContent = model;
  }

  $$(".model-card").forEach((card) => {
    const cardModel = normalizeModelName(card.dataset.model);
    card.classList.toggle("active", cardModel === model);
  });

  localStorage.setItem("xuai-model", model);

  updateApiInfo();
}

function getEndpointForModel(model) {
  model = normalizeModelName(model);

  if (RESPONSES_IMAGE_MODELS.has(model)) {
    return `${FIXED_API_BASE}/v1/responses`;
  }

  return `${FIXED_API_BASE}/v1/images/generations`;
}

function updateApiInfo() {
  const model = normalizeModelName(
    modelSelect?.value || DEFAULT_IMAGE_MODEL
  );

  if (apiModeBadge) {
    apiModeBadge.textContent = "真实 API";
  }

  if (apiInfoTitle) {
    apiInfoTitle.textContent = `当前使用 ${model}`;
  }

  if (apiInfoDesc) {
    apiInfoDesc.textContent = `真实 API 模式会调用 ${getEndpointForModel(model)}。`;
  }
}

async function handleGenerate(event) {
  event.preventDefault();

  console.log("点击了生成图片按钮");

  lockProviderSettings();

  const prompt = promptInput?.value.trim() || "";
  const model = normalizeModelName(modelSelect?.value || DEFAULT_IMAGE_MODEL);
  const size = sizeSelect?.value || "auto";
  const quality = document.querySelector('input[name="quality"]:checked')?.value || "auto";
  const background = document.querySelector('input[name="background"]:checked')?.value || "auto";
  const format = document.querySelector('input[name="format"]:checked')?.value || "png";
  const count = clamp(Number(countInput?.value || 1), 1, 4);
  const baseURL = normalizeBaseUrl(FIXED_API_BASE);
  const key = apiKey?.value.trim() || "";

  if (!prompt) {
    setStatus("请先输入 Prompt。", "warning");
    promptInput?.focus();
    return;
  }

  if (!key) {
    setStatus("请填写 API Key。", "warning");
    apiKey?.focus();
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

  console.log("准备发送的生成参数：", { size, quality, background, format });

  try {
    setStatus("正在调用 XuAI API 中转站...", "loading");

    const result = await callImageGenerationApi({
      baseURL,
      key,
      model,
      prompt,
      size,
      quality,
      background,
      format,
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
      model,
      request_url: getEndpointForModel(model),
      tip: "如果是 504 Gateway Timeout，通常表示中转站请求上游模型超时；如果是 CORS，则需要在中转站配置跨域。",
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
  background,
  format,
  count,
}) {
  model = normalizeModelName(model);

  if (RESPONSES_IMAGE_MODELS.has(model)) {
    return await callResponsesImageApi({
      baseURL,
      key,
      model,
      prompt,
      size,
      quality,
      background,
      format,
      count,
    });
  }

  return await callImagesGenerationsApi({
    baseURL,
    key,
    model,
    prompt,
    size,
    quality,
    background,
    format,
    count,
  });
}

async function callImagesGenerationsApi({
  baseURL,
  key,
  model,
  prompt,
  size,
  quality,
  background,
  format,
  count,
}) {
  const url = `${baseURL}/v1/images/generations`;

  console.log("准备请求 Images API：", url);

  const payload = {
    model,
    prompt,
    n: count,
  };

  if (size && size !== "auto") payload.size = size;
  if (quality && quality !== "auto") payload.quality = quality;
  if (background && background !== "auto") payload.background = background;
  if (format && format !== "png") payload.response_format = format;

  console.log("Images API 请求参数（最终发给大模型的 payload）：", payload);

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
    throw new Error(buildApiErrorMessage(raw, response, "Images API"));
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
    throw new Error("Images API 返回成功，但没有找到图片 URL 或 base64 图片数据。");
  }

  return {
    images,
    raw,
  };
}

async function callResponsesImageApi({
  baseURL,
  key,
  model,
  prompt,
  size,
  quality,
  background,
  format,
  count,
}) {
  const url = `${baseURL}/v1/responses`;

  console.log("准备请求 Responses API：", url);

  const images = [];
  const raws = [];

  for (let i = 0; i < count; i++) {
    const imageTool = {
      type: "image_generation",
    };

    if (size && size !== "auto") imageTool.size = size;
    if (quality && quality !== "auto") imageTool.quality = quality;
    if (background && background !== "auto") imageTool.background = background;
    if (format && format !== "png") imageTool.response_format = format;

    const payload = {
      model,
      input: prompt,
      tools: [imageTool],
    };

    console.log(`Responses API 请求参数 #${i + 1}：`, payload);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(payload),
    });

    const raw = await safeJson(response);
    raws.push(raw);

    if (!response.ok) {
      throw new Error(buildApiErrorMessage(raw, response, "Responses API"));
    }

    const currentImages = extractImagesFromResponses(raw);

    if (!currentImages.length) {
      throw new Error("Responses API 返回成功，但没有找到图片数据。");
    }

    images.push(...currentImages);
  }

  return {
    images: images.slice(0, count),
    raw: count === 1 ? raws[0] : raws,
  };
}

function extractImagesFromResponses(raw) {
  const images = [];

  const pushImage = (value) => {
    if (!value) return;

    if (Array.isArray(value)) {
      value.forEach((item) => pushImage(item));
      return;
    }

    if (typeof value === "string") {
      const text = value.trim();

      if (text.startsWith("http://") || text.startsWith("https://")) {
        images.push(text);
        return;
      }

      if (text.startsWith("data:image/")) {
        images.push(text);
        return;
      }

      if (looksLikeBase64Image(text)) {
        images.push(`data:image/png;base64,${text}`);
        return;
      }

      return;
    }

    if (typeof value === "object") {
      if (value.url) {
        pushImage(value.url);
      }

      if (value.image_url) {
        pushImage(value.image_url);
      }

      if (value.b64_json) {
        pushImage(value.b64_json);
      }

      if (value.image_base64) {
        pushImage(value.image_base64);
      }

      if (value.base64) {
        pushImage(value.base64);
      }

      if (value.result) {
        pushImage(value.result);
      }

      if (value.data) {
        pushImage(value.data);
      }

      if (value.content) {
        pushImage(value.content);
      }

      if (value.output) {
        pushImage(value.output);
      }
    }
  };

  if (Array.isArray(raw?.output)) {
    raw.output.forEach((item) => {
      if (item.type === "image_generation_call") {
        pushImage(item.result);
      }

      pushImage(item);
    });
  }

  if (Array.isArray(raw?.data)) {
    raw.data.forEach((item) => {
      pushImage(item);
    });
  }

  if (raw?.image) {
    pushImage(raw.image);
  }

  if (raw?.result) {
    pushImage(raw.result);
  }

  return uniqueArray(images);
}

function looksLikeBase64Image(value) {
  if (!value || value.length < 100) return false;

  const cleaned = value.replace(/\s/g, "");

  if (cleaned.length < 100) return false;

  return /^[A-Za-z0-9+/=]+$/.test(cleaned);
}

function buildApiErrorMessage(raw, response, apiName) {
  let detail = "";

  if (typeof raw?.error === "string") {
    detail = raw.error;
  } else if (raw?.error?.message) {
    detail = raw.error.message;
  } else if (raw?.error?.code) {
    detail = raw.error.code;
  } else if (raw?.message) {
    detail = raw.message;
  } else if (raw?.raw) {
    detail = raw.raw;
  }

  if (response.status === 504) {
    return `${apiName} 返回 504 Gateway Timeout：中转站请求上游模型超时。${
      detail ? `上游返回：${detail}` : ""
    }`;
  }

  if (response.status === 401) {
    return `${apiName} 返回 401 Unauthorized：API Key 无效或没有权限。${
      detail ? `详细信息：${detail}` : ""
    }`;
  }

  if (response.status === 403) {
    return `${apiName} 返回 403 Forbidden：当前 API Key 没有权限访问该模型。${
      detail ? `详细信息：${detail}` : ""
    }`;
  }

  if (response.status === 404) {
    return `${apiName} 返回 404 Not Found：请检查请求路径或模型是否支持。${
      detail ? `详细信息：${detail}` : ""
    }`;
  }

  if (response.status === 429) {
    return `${apiName} 返回 429 Too Many Requests：请求过快或额度不足。${
      detail ? `详细信息：${detail}` : ""
    }`;
  }

  return detail || `${apiName} 请求失败：HTTP ${response.status}`;
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
                <small>API #${index + 1}</small>
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

function uniqueArray(array) {
  return Array.from(new Set(array));
}