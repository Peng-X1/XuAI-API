const FIXED_PROVIDER_ID = "xuai";
const FIXED_PROVIDER_NAME = "XuAI API 中转站";
const FIXED_API_BASE = "https://api.xuai.chat";

const DEFAULT_IMAGE_MODEL = "gpt-image-2";
const DEFAULT_NANO_MODEL = "gemini-3-pro-image-preview";
const GPT5_IMAGE_MODEL_ORDER = [
  "gpt-5.5",
  "gpt-5.4",
  "gpt-5.3",
  "gpt-5.2",
  "gpt-5.1",
  "gpt-5",
];

// 自定义绘图模型保存在浏览器本地，不会提交到服务器或 GitHub。
// GPT/Grok-Imagine/豆包/千问默认按 Images API 调用；Nano Banana 默认按 Chat Completions 图片调用。
const CUSTOM_MODEL_STORAGE_KEY = "xuai-custom-image-models";
const HIDDEN_IMAGE_MODEL_STORAGE_KEY = "xuai-hidden-image-models";
const HIDDEN_IMAGE_MODELS = new Set(loadHiddenImageModels());
const CUSTOM_MODEL_FAMILY_CONFIG = {
  nano: {
    label: "Nano Banana",
    apiType: "chat",
    description: "自定义 Nano Banana / Gemini 兼容绘图模型，默认走 /v1/chat/completions。",
  },
  gpt: {
    label: "GPT-Image",
    apiType: "images",
    description: "自定义 GPT 绘图模型，默认走 /v1/images/generations。",
  },
  grok: {
    label: "Grok-Imagine",
    apiType: "images",
    description: "自定义 Grok-Imagine 绘图模型，默认走 /v1/images/generations。",
  },
  doubao: {
    label: "豆包",
    apiType: "images",
    description: "自定义豆包绘图模型，默认走 /v1/images/generations。",
  },
  qianwen: {
    label: "千问",
    apiType: "images",
    description: "自定义千问绘图模型，默认走 /v1/images/generations。",
  },
};

const CUSTOM_IMAGE_MODEL_RECORDS = new Map();

// GPT-5 系列不再作为固定预设，只在刷新模型接口返回后加入 Responses API 列表。
const RESPONSES_IMAGE_MODELS = new Set();

const GEMINI_IMAGE_MODELS = new Set([
  "gemini-3-pro-image-preview",
  "gemini-2.5-flash-image",
]);

const CHAT_COMPLETIONS_IMAGE_MODELS = new Set([
  "gemini-3-pro-image-preview",
  "gemini-2.5-flash-image",
]);

const MODEL_FAMILY_DEFAULTS = {
  nano: DEFAULT_NANO_MODEL,
  gpt: DEFAULT_IMAGE_MODEL,
  grok: "grok-imagine-image",
  doubao: "doubao-seedream-4-0-250828",
  qianwen: "qwen-image-edit-plus",
};

const MODEL_META = {
  "gemini-3-pro-image-preview": {
    family: "nano",
    title: "gemini-3-pro-image-preview",
    description: "Gemini 3 Pro 图片预览模型，适合更高质量的图像生成。",
  },

  "gemini-2.5-flash-image": {
    family: "nano",
    title: "gemini-2.5-flash-image",
    description: "Gemini 2.5 Flash 图片模型，速度更快，适合快速出图。",
  },

  "gpt-image-2": {
    family: "gpt",
    title: "gpt-image-2",
    description: "Images API",
  },

  "gpt-image-1": {
    family: "gpt",
    title: "gpt-image-1",
    description: "Images API",
  },

  "dall-e-3": {
    family: "gpt",
    title: "dall-e-3",
    description: "Images API",
  },

  "grok-imagine-image": {
    family: "grok",
    title: "grok-imagine-image",
    description: "Images API",
  },

  "grok-imagine-image-pro": {
    family: "grok",
    title: "grok-imagine-image-pro",
    description: "Images API",
  },

  "doubao-seedream-4-0-250828": {
    family: "doubao",
    title: "doubao-seedream-4-0-250828",
    description: "文生图 / Images API",
  },

  "doubao-seededit-3-0-i2i-250628": {
    family: "doubao",
    title: "doubao-seededit-3-0-i2i-250628",
    description: "图生图 / 编辑",
  },

  "doubao-seedream-3-0-t2i-250415": {
    family: "doubao",
    title: "doubao-seedream-3-0-t2i-250415",
    description: "文生图 / Images API",
  },

  "qwen-image-edit-plus": {
    family: "qianwen",
    title: "qwen-image-edit-plus",
    description: "图片编辑 / Images API",
  },

  "qwen-image-edit-plus-2025-10-30": {
    family: "qianwen",
    title: "qwen-image-edit-plus-2025-10-30",
    description: "图片编辑 / Images API",
  },
};

// gpt-5.4 模型不显示/不允许这些尺寸。
// 如果你已经从 UI 删除尺寸控件，这里仍然作为防御性兜底保留。
const GPT54_DISABLED_SIZES = new Set([
  "1024x1024",
  "2048x2048",
  "2160x3840",
]);

// gpt-5.4 只允许 PNG。
// 如果你已经从 UI 删除输出格式控件，这里仍然作为防御性兜底保留。
const GPT54_ALLOWED_FORMATS = new Set(["png"]);

// Responses API 图片生成可能会先返回 generating 状态，这里做轮询。
const RESPONSES_POLL_INTERVAL_MS = 3000;
const RESPONSES_MAX_POLL_ATTEMPTS = 20;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const form = $("#imageForm");
const provider = $("#provider");
const apiBase = $("#apiBase");
const apiKey = $("#apiKey");
const toggleKeyBtn = $("#toggleKeyBtn");
const refreshModelsBtn = $("#refreshModelsBtn");
const modelSelect = $("#model");
const promptInput = $("#prompt");
const sizeSelect = $("#size");
const countInput = $("#count");
const generateBtn = $("#generateBtn");

const currentModelText = $("#currentModelText");
const currentModelDesc = $("#currentModelDesc");
const modelBadge = $("#modelBadge");
const statusText = $("#statusText");
const apiModeBadge = $("#apiModeBadge");
const apiInfoTitle = $("#apiInfoTitle");
const apiInfoDesc = $("#apiInfoDesc");
const gallery = $("#gallery");
const emptyStateBadge = $(".empty-state .empty-badge");
const emptyStateTitle = $(".empty-state h4");
const emptyStateDesc = $(".empty-state p");
const debugBox = $("#debugBox");
const themeBtn = $("#themeBtn");
const modelSyncText = $("#modelSyncText");
const customModelInputs = $$("[data-custom-model-input]");
const customModelAddBtns = $$("[data-custom-model-add]");

// 生成中提示框相关 DOM。
// 如果 index.html 暂时没加这些节点，不会报错，只是不显示提示框。
const generationNotice = $("#generationNotice");
const generationNoticeIcon = $("#generationNoticeIcon");
const generationNoticeTitle = $("#generationNoticeTitle");
const generationNoticeDesc = $("#generationNoticeDesc");
const generationModelName = $("#generationModelName");
const generationTimer = $("#generationTimer");

let isGeneratingImage = false;
let generationStartTime = 0;
let generationTimerId = null;

// 缓存原始尺寸选项，用于模型切换时恢复。
// 如果你已经从 UI 删除尺寸控件，这里会是空数组，不影响运行。
const ORIGINAL_SIZE_OPTIONS = sizeSelect
  ? Array.from(sizeSelect.options).map((option) => ({
      value: option.value,
      text: option.textContent,
      disabled: option.disabled,
      hideFor: parseModelList(option.dataset.hideFor),
    }))
  : [];

// 缓存原始输出格式选项，用于模型切换时恢复。
// 如果你已经从 UI 删除格式控件，这里会是空数组，不影响运行。
const formatFieldRow = document
  .querySelector('input[name="format"]')
  ?.closest(".field-row");

const ORIGINAL_FORMAT_OPTIONS = $$('input[name="format"]').map((input) => {
  const label = input.closest("label.radio");

  return {
    value: input.value,
    checked: input.checked,
    labelHTML: label ? label.outerHTML : "",
    hideFor: parseModelList(label?.dataset.hideFor || input.dataset.hideFor),
  };
});

init();

function init() {
  console.log("XuAI app.js 已加载");

  const savedTheme = localStorage.getItem("xuai-theme");
  if (savedTheme === "light") {
    document.body.classList.add("light");
    if (themeBtn) themeBtn.textContent = "☀️";
  }

  normalizeModelDom();
  restoreCustomImageModels();
  lockProviderSettings();
  initApiConnectionUi();

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

  if (refreshModelsBtn) {
    refreshModelsBtn.addEventListener("click", () => {
      refreshAvailableImageModels();
    });
  }

  if (apiKey) {
    apiKey.addEventListener("change", () => {
      if (apiKey.value.trim()) {
        refreshAvailableImageModels();
      }
    });
  }

  $$(".model-tabs button").forEach((tab) => {
    tab.addEventListener("click", () => {
      const family = tab.dataset.family || inferFamilyFromTabText(tab.textContent);
      setModelFamily(family);
    });
  });

  $$(".model-card").forEach(bindModelCard);

  bindCustomModelEvents();

  if (modelSelect) {
    modelSelect.addEventListener("change", () => {
      const model = normalizeModelName(modelSelect.value);
      setModel(model);
    });
  }

  if (form) {
    form.addEventListener("submit", handleGenerate);
  }

  window.addEventListener("beforeunload", handleBeforeUnload);
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

function initApiConnectionUi() {
  const providerRow = provider?.closest(".field-row");
  const apiBaseRow = apiBase?.closest(".field-row");
  const apiKeyRow = apiKey?.closest(".field-row");

  if (providerRow) {
    providerRow.classList.add("provider-row");
    providerRow.hidden = true;
  }

  if (apiBaseRow && apiBase) {
    apiBaseRow.classList.add("api-base-row", "form-row-horizontal");

    let apiBaseWrap = apiBaseRow.querySelector(".api-base-wrap");

    if (!apiBaseWrap) {
      apiBaseWrap = document.createElement("div");
      apiBaseWrap.className = "api-base-wrap";
      apiBase.insertAdjacentElement("beforebegin", apiBaseWrap);
      apiBaseWrap.appendChild(apiBase);
    }

    let apiBaseNote = apiBaseWrap.querySelector(".api-base-note");

    if (!apiBaseNote) {
      apiBaseNote = document.createElement("span");
      apiBaseNote.className = "api-base-note";
      apiBaseWrap.appendChild(apiBaseNote);
    }

    apiBaseNote.textContent = "无需修改";
  }

  if (apiKeyRow && apiKey) {
    apiKeyRow.classList.add("api-key-row", "form-row-horizontal");
    apiKey.placeholder = "填入个人APIKey";
  }
}

function normalizeModelDom() {
  if (modelSelect) {
    Array.from(modelSelect.options).forEach((option) => {
      if (option.value === "gpt-5.4-image") {
        option.value = "gpt-5.4";
        option.textContent = "gpt-5.4";
      }

      const model = normalizeModelName(option.value);
      const meta = getModelMeta(model);

      if (!option.dataset.family) {
        option.dataset.family = meta.family || "gpt";
      }
    });
  }

  $$(".model-card").forEach((card) => {
    if (card.dataset.model === "gpt-5.4-image") {
      card.dataset.model = "gpt-5.4";
    }

    const model = normalizeModelName(card.dataset.model);
    const meta = getModelMeta(model);

    if (!card.dataset.family) {
      card.dataset.family = meta.family || "gpt";
    }
  });

  $$(".model-tabs button").forEach((tab) => {
    if (!tab.dataset.family) {
      tab.dataset.family = inferFamilyFromTabText(tab.textContent);
    }

    tab.type = "button";
  });
}

function inferFamilyFromTabText(text) {
  const value = String(text || "").toLowerCase();

  if (value.includes("nano") || value.includes("banana") || value.includes("gemini")) {
    return "nano";
  }

  if (value.includes("grok")) {
    return "grok";
  }

  if (value.includes("豆包") || value.includes("doubao")) {
    return "doubao";
  }

  if (value.includes("千问") || value.includes("qianwen") || value.includes("qwen")) {
    return "qianwen";
  }

  return "gpt";
}

function normalizeModelName(model) {
  const value = String(model || "").trim();

  if (value === "gpt-5.4-image") {
    return "gpt-5.4";
  }

  return value;
}

function getModelMeta(model) {
  model = normalizeModelName(model);

  return (
    MODEL_META[model] || {
      family: "gpt",
      title: model,
      description: "当前模型。",
    }
  );
}

function bindModelCard(card) {
  if (!card || card.dataset.modelCardBound === "true") return;

  card.dataset.modelCardBound = "true";

  card.addEventListener("click", () => {
    const model = normalizeModelName(card.dataset.model);
    setModel(model);
  });
}

function getModelFamily(model) {
  return getModelMeta(model).family || "gpt";
}

function setModelFamily(family) {
  if (!family) return;

  const currentModel = normalizeModelName(
    modelSelect?.value || DEFAULT_IMAGE_MODEL
  );

  if (getModelFamily(currentModel) === family) {
    applyModelFamilyUi(family, currentModel);
    return;
  }

  const nextModel = MODEL_FAMILY_DEFAULTS[family];

  if (!nextModel) {
    applyModelFamilyUi(family, currentModel);
    setStatus(
      `${getModelFamilyLabel(family)} 分组暂无内置模型，请在下方添加自定义绘图模型。`,
      "warning"
    );
    return;
  }

  setModel(nextModel);
}

function applyModelFamilyUi(family, activeModel) {
  family = family || getModelFamily(activeModel);
  activeModel = normalizeModelName(activeModel);

  $$(".model-tabs button").forEach((tab) => {
    const tabFamily = tab.dataset.family || inferFamilyFromTabText(tab.textContent);
    tab.classList.toggle("active", tabFamily === family);
  });

  if (modelSelect) {
    Array.from(modelSelect.options).forEach((option) => {
      const optionModel = normalizeModelName(option.value);
      const optionFamily = option.dataset.family || getModelFamily(optionModel);
      const shouldShow = optionFamily === family;

      option.hidden = !shouldShow;
      option.disabled = !shouldShow;
    });
  }

  $$(".model-card").forEach((card) => {
    const cardModel = normalizeModelName(card.dataset.model);
    const cardFamily = card.dataset.family || getModelFamily(cardModel);
    const shouldShow = cardFamily === family;

    card.hidden = !shouldShow;
    card.classList.toggle("active", shouldShow && cardModel === activeModel);
  });

  $$(".custom-model-panel").forEach((panel) => {
    const panelFamily = panel.dataset.family || "gpt";
    panel.hidden = panelFamily !== family;
  });
}

function ensureModelOption(model) {
  if (!modelSelect || !model) return;

  const existingOption = Array.from(modelSelect.options).find(
    (option) => normalizeModelName(option.value) === model
  );

  const meta = getModelMeta(model);

  if (existingOption) {
    existingOption.textContent = meta.title || model;
    existingOption.dataset.family = meta.family || "gpt";
    return;
  }

  const option = document.createElement("option");
  option.value = model;
  option.textContent = meta.title || model;
  option.dataset.family = meta.family || "gpt";

  modelSelect.appendChild(option);
}

function bindCustomModelEvents() {
  customModelAddBtns.forEach((button) => {
    button.addEventListener("click", () => {
      addCustomModelFromControl(button);
    });
  });

  customModelInputs.forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;

      event.preventDefault();
      addCustomModelFromControl(input);
    });
  });
}

async function refreshAvailableImageModels() {
  const key = apiKey?.value.trim() || "";

  if (!key) {
    setModelSyncStatus("请先填入个人 API Key。", "warning");
    setStatus("请先填入个人 API Key。", "warning");
    apiKey?.focus();
    return;
  }

  const baseURL = normalizeBaseUrl(FIXED_API_BASE);
  const url = `${baseURL}/v1/models`;

  setModelSyncStatus("正在刷新可用绘图模型...", "loading");
  setStatus("正在读取当前 API Key 可用模型...", "loading");

  if (refreshModelsBtn) {
    refreshModelsBtn.disabled = true;
    refreshModelsBtn.textContent = "刷新中";
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
      },
    });

    const raw = await safeJson(response);

    if (!response.ok) {
      const error = new Error(buildApiErrorMessage(raw, response, "Models API"));
      error.raw = {
        request_url: url,
        response: raw,
      };
      throw error;
    }

    const modelNames = extractModelNamesFromModelsResponse(raw);
    const registered = registerAvailableImageModels(modelNames);

    showDebug({
      request_url: url,
      response: raw,
      detected_image_models: registered.models,
      detected_by_family: registered.byFamily,
    });

    if (!registered.total) {
      const message = "没有从当前 API Key 的模型列表中识别到绘图模型。";
      setModelSyncStatus(message, "warning");
      setStatus(message, "warning");
      return;
    }

    const activeFamily = getModelFamily(modelSelect?.value || DEFAULT_IMAGE_MODEL);
    applyModelFamilyUi(activeFamily, modelSelect?.value || DEFAULT_IMAGE_MODEL);

    const message = `已刷新 ${registered.total} 个可用绘图模型。`;
    setModelSyncStatus(message, "success");
    setStatus(message, "success");
  } catch (error) {
    console.error(error);

    const message = error.message || "刷新可用模型失败。";
    setModelSyncStatus(message, "error");
    setStatus("刷新可用模型失败，请查看调试信息。", "error");

    showDebug(
      error.raw || {
        error: message,
        request_url: url,
      }
    );
  } finally {
    if (refreshModelsBtn) {
      refreshModelsBtn.disabled = false;
      refreshModelsBtn.textContent = "刷新模型";
    }
  }
}

function extractModelNamesFromModelsResponse(raw) {
  const values = [];

  const pushModel = (value) => {
    const model = normalizeModelName(value);
    if (model) values.push(model);
  };

  const readItem = (item) => {
    if (!item) return;

    if (typeof item === "string") {
      pushModel(item);
      return;
    }

    if (typeof item === "object") {
      pushModel(item.id || item.model || item.name || item.model_name);
    }
  };

  if (Array.isArray(raw)) {
    raw.forEach(readItem);
  }

  if (Array.isArray(raw?.data)) {
    raw.data.forEach(readItem);
  }

  if (Array.isArray(raw?.models)) {
    raw.models.forEach(readItem);
  }

  return uniqueArray(values);
}

function registerAvailableImageModels(modelNames) {
  const byFamily = {};
  const models = [];

  modelNames.forEach((model) => {
    if (HIDDEN_IMAGE_MODELS.has(normalizeModelName(model))) return;

    const family = inferImageFamilyFromModelName(model);

    if (!family) return;

    registerAvailableImageModel({
      model,
      family,
      apiType: isGpt5ImageCandidate(model)
        ? "responses"
        : CUSTOM_MODEL_FAMILY_CONFIG[family]?.apiType || "images",
    });

    models.push(model);
    byFamily[family] = (byFamily[family] || 0) + 1;
  });

  sortModelCards();
  sortModelOptions();

  return {
    total: models.length,
    models,
    byFamily,
  };
}

function registerAvailableImageModel({ model, family, apiType }) {
  model = normalizeModelName(model);
  family = normalizeCustomModelFamily(family);
  apiType = normalizeCustomModelApiType(apiType, family);

  if (!model) return;

  const builtInMeta = MODEL_META[model];

  if (!builtInMeta || builtInMeta.custom || builtInMeta.discovered) {
    MODEL_META[model] = {
      family,
      title: model,
      description: getAvailableModelDescription(family, apiType),
      discovered: true,
      apiType,
    };
  }

  configureModelApiType(model, apiType);
  ensureModelOption(model);
  ensureCustomModelCard(model, family, apiType);
}

function configureModelApiType(model, apiType) {
  if (apiType === "chat") {
    GEMINI_IMAGE_MODELS.add(model);
    CHAT_COMPLETIONS_IMAGE_MODELS.add(model);
    RESPONSES_IMAGE_MODELS.delete(model);
    return;
  }

  if (apiType === "responses") {
    RESPONSES_IMAGE_MODELS.add(model);
    GEMINI_IMAGE_MODELS.delete(model);
    CHAT_COMPLETIONS_IMAGE_MODELS.delete(model);
    return;
  }

  GEMINI_IMAGE_MODELS.delete(model);
  CHAT_COMPLETIONS_IMAGE_MODELS.delete(model);
  RESPONSES_IMAGE_MODELS.delete(model);
}

function inferImageFamilyFromModelName(model) {
  const value = String(model || "").toLowerCase();

  if (!isLikelyImageModelName(value)) return "";

  if (value.includes("gemini") || value.includes("nano") || value.includes("banana")) {
    return "nano";
  }

  if (value.includes("grok")) {
    return "grok";
  }

  if (
    value.includes("doubao") ||
    value.includes("seedream") ||
    value.includes("seededit")
  ) {
    return "doubao";
  }

  if (value.includes("qwen-image") || value.includes("qianwen")) {
    return "qianwen";
  }

  if (
    isGpt5ImageCandidate(value) ||
    value.includes("gpt-image") ||
    value.includes("dall-e") ||
    value.includes("dalle")
  ) {
    return "gpt";
  }

  return "";
}

function isLikelyImageModelName(model) {
  const value = String(model || "").toLowerCase();

  return (
    isGpt5ImageCandidate(value) ||
    value.includes("image") ||
    value.includes("imagine") ||
    value.includes("dall-e") ||
    value.includes("dalle") ||
    value.includes("seedream") ||
    value.includes("seededit")
  );
}

function isGpt5ImageCandidate(model) {
  return /^gpt-5(?:\.[1-5])?$/.test(normalizeModelName(model).toLowerCase());
}

function getAvailableModelDescription(family, apiType) {
  if (family === "nano") {
    return "Chat Completions";
  }

  if (apiType === "responses") {
    return "Responses API";
  }

  return "Images API";
}

function setModelSyncStatus(message, type = "info") {
  if (!modelSyncText) return;

  modelSyncText.textContent = message;

  const colorMap = {
    info: "",
    loading: "var(--primary)",
    success: "var(--success)",
    warning: "var(--warning)",
    error: "var(--danger)",
  };

  modelSyncText.style.color = colorMap[type] || "";
}

function addCustomModelFromControl(control) {
  const family = normalizeCustomModelFamily(control?.dataset.family);
  const config = CUSTOM_MODEL_FAMILY_CONFIG[family];
  const input = document.querySelector(
    `[data-custom-model-input][data-family="${family}"]`
  );
  const model = normalizeModelName(input?.value || "");

  if (!model) {
    setStatus("请输入自定义模型名称。", "warning");
    input?.focus();
    return;
  }

  const record = registerCustomImageModel({
    model,
    family,
    apiType: control?.dataset.apiType || input?.dataset.apiType || config.apiType,
    persist: true,
  });

  if (input) {
    input.value = "";
  }

  setModel(record.model);
  setStatus(
    record.custom
      ? `已添加并切换到自定义模型 ${record.model}。`
      : `已切换到已有模型 ${record.model}。`,
    "success"
  );
}

function registerCustomImageModel({ model, family, apiType, persist = false }) {
  model = normalizeModelName(model);
  family = normalizeCustomModelFamily(family);
  apiType = normalizeCustomModelApiType(apiType, family);

  const builtInMeta = MODEL_META[model];

  // 如果用户输入的是已有内置模型，只切换模型，不覆盖内置配置。
  if (builtInMeta && !builtInMeta.custom) {
    return {
      model,
      family: builtInMeta.family || family,
      apiType: getApiTypeForModel(model),
      custom: false,
    };
  }

  const record = {
    model,
    family,
    apiType,
    custom: true,
  };

  CUSTOM_IMAGE_MODEL_RECORDS.set(model, record);

  MODEL_META[model] = {
    family,
    title: model,
    description: getCustomModelDescription(family, apiType),
    custom: true,
    apiType,
  };

  // apiType 决定自定义模型最终走哪套请求体。
  configureModelApiType(model, apiType);

  ensureModelOption(model);
  ensureCustomModelCard(model, family, apiType);

  if (persist) {
    saveCustomImageModels();
  }

  return record;
}

function ensureCustomModelCard(model, family, apiType) {
  const cards = document.querySelector(".cards");
  if (!cards) return;

  const meta = MODEL_META[model] || {};
  const isDiscovered = meta.discovered === true;

  const existingCard = $$(".model-card").find(
    (card) => normalizeModelName(card.dataset.model) === model
  );

  if (existingCard) {
    existingCard.dataset.family = family;
    existingCard.dataset.apiType = apiType;
    existingCard.dataset.customModel = meta.custom ? "true" : "";
    existingCard.dataset.discoveredModel = isDiscovered ? "true" : "";
    existingCard.hidden = getModelFamily(modelSelect?.value || DEFAULT_IMAGE_MODEL) !== family;

    const title = existingCard.querySelector("strong");
    if (title) {
      title.textContent = model;
    }

    const desc = existingCard.querySelector("span");
    if (desc) {
      desc.textContent = getCustomCardDescription(family, apiType);
    }

    syncDiscoveredModelCloseButton(existingCard, isDiscovered);
    bindModelCard(existingCard);
    return;
  }

  const card = document.createElement("button");
  card.type = "button";
  card.className = "model-card custom-model-card";
  card.dataset.family = family;
  card.dataset.model = model;
  card.dataset.apiType = apiType;
  card.dataset.customModel = meta.custom ? "true" : "";
  card.dataset.discoveredModel = isDiscovered ? "true" : "";
  card.hidden = getModelFamily(modelSelect?.value || DEFAULT_IMAGE_MODEL) !== family;

  const title = document.createElement("strong");
  title.textContent = model;

  const desc = document.createElement("span");
  desc.textContent = getCustomCardDescription(family, apiType);

  card.append(title, desc);
  syncDiscoveredModelCloseButton(card, isDiscovered);
  cards.appendChild(card);
  bindModelCard(card);
}

function syncDiscoveredModelCloseButton(card, isDiscovered) {
  const existingButton = card.querySelector(".model-card__close");

  if (!isDiscovered) {
    existingButton?.remove();
    return;
  }

  if (existingButton) return;

  const button = document.createElement("span");
  button.role = "button";
  button.tabIndex = 0;
  button.className = "model-card__close";
  button.setAttribute("aria-label", "隐藏这个刷新出来的模型");
  button.title = "隐藏这个刷新出来的模型";
  button.textContent = "×";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    hideImageModel(normalizeModelName(card.dataset.model));
  });
  button.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    event.stopPropagation();
    hideImageModel(normalizeModelName(card.dataset.model));
  });

  card.appendChild(button);
}

function hideImageModel(model) {
  model = normalizeModelName(model);
  const meta = MODEL_META[model];

  if (!model || !meta?.discovered) return;

  HIDDEN_IMAGE_MODELS.add(model);
  saveHiddenImageModels();
  const wasActive = normalizeModelName(modelSelect?.value || DEFAULT_IMAGE_MODEL) === model;

  $$("[data-model]").forEach((element) => {
    if (normalizeModelName(element.dataset.model) === model) {
      element.remove();
    }
  });

  if (modelSelect) {
    Array.from(modelSelect.options)
      .filter((option) => normalizeModelName(option.value) === model)
      .forEach((option) => option.remove());
  }

  delete MODEL_META[model];
  RESPONSES_IMAGE_MODELS.delete(model);
  CHAT_COMPLETIONS_IMAGE_MODELS.delete(model);
  GEMINI_IMAGE_MODELS.delete(model);

  const family = meta.family || "gpt";
  const activeModel = normalizeModelName(modelSelect?.value || DEFAULT_IMAGE_MODEL);

  if (wasActive) {
    setModel(findFirstModelInFamily(family) || MODEL_FAMILY_DEFAULTS[family] || DEFAULT_IMAGE_MODEL);
  } else {
    applyModelFamilyUi(family, activeModel);
  }

  sortModelCards();
  sortModelOptions();
  setModelSyncStatus(`已隐藏模型 ${model}，刷新时不会再显示。`, "success");
}

function findFirstModelInFamily(family) {
  const card = $$(".model-card").find((item) => {
    const model = normalizeModelName(item.dataset.model);
    const meta = getModelMeta(model);
    return (item.dataset.family || meta.family) === family && !HIDDEN_IMAGE_MODELS.has(model);
  });

  if (card) return normalizeModelName(card.dataset.model);

  const option = Array.from(modelSelect?.options || []).find((item) => {
    const model = normalizeModelName(item.value);
    const meta = getModelMeta(model);
    return (item.dataset.family || meta.family) === family && !HIDDEN_IMAGE_MODELS.has(model);
  });

  return normalizeModelName(option?.value || "");
}

function restoreCustomImageModels() {
  let savedModels = [];

  try {
    savedModels = JSON.parse(localStorage.getItem(CUSTOM_MODEL_STORAGE_KEY) || "[]");
  } catch {
    savedModels = [];
  }

  if (!Array.isArray(savedModels)) return;

  savedModels.forEach((item) => {
    if (!item?.model) return;

    registerCustomImageModel({
      model: item.model,
      family: item.family,
      apiType: item.apiType,
      persist: false,
    });
  });
}

function saveCustomImageModels() {
  const records = Array.from(CUSTOM_IMAGE_MODEL_RECORDS.values()).map((item) => ({
    model: item.model,
    family: item.family,
    apiType: item.apiType,
  }));

  localStorage.setItem(CUSTOM_MODEL_STORAGE_KEY, JSON.stringify(records));
}

function loadHiddenImageModels() {
  try {
    const value = JSON.parse(
      localStorage.getItem(HIDDEN_IMAGE_MODEL_STORAGE_KEY) || "[]"
    );

    if (Array.isArray(value)) {
      return value.map(normalizeModelName).filter(Boolean);
    }
  } catch {
    // 本地隐藏列表损坏时直接忽略，避免影响页面启动。
  }

  return [];
}

function saveHiddenImageModels() {
  localStorage.setItem(
    HIDDEN_IMAGE_MODEL_STORAGE_KEY,
    JSON.stringify(Array.from(HIDDEN_IMAGE_MODELS))
  );
}

function getModelSortRank(model, family) {
  model = normalizeModelName(model);

  if (family === "gpt") {
    const gpt5Rank = GPT5_IMAGE_MODEL_ORDER.indexOf(model);
    if (gpt5Rank >= 0) return gpt5Rank;

    const gptImageRank = ["gpt-image-2", "gpt-image-1", "dall-e-3"].indexOf(model);
    if (gptImageRank >= 0) return 100 + gptImageRank;
  }

  return 1000;
}

function getFamilySortRank(family) {
  const rank = ["nano", "gpt", "grok", "doubao", "qianwen"].indexOf(family);
  return rank >= 0 ? rank : 999;
}

function sortModelCards() {
  const cards = document.querySelector(".cards");
  if (!cards) return;

  Array.from(cards.querySelectorAll(".model-card"))
    .sort((a, b) => {
      const aFamily = a.dataset.family || getModelFamily(a.dataset.model);
      const bFamily = b.dataset.family || getModelFamily(b.dataset.model);

      if (aFamily !== bFamily) {
        return getFamilySortRank(aFamily) - getFamilySortRank(bFamily);
      }

      return (
        getModelSortRank(a.dataset.model, aFamily) -
        getModelSortRank(b.dataset.model, bFamily)
      );
    })
    .forEach((card) => cards.appendChild(card));
}

function sortModelOptions() {
  if (!modelSelect) return;

  Array.from(modelSelect.options)
    .sort((a, b) => {
      const aFamily = a.dataset.family || getModelFamily(a.value);
      const bFamily = b.dataset.family || getModelFamily(b.value);

      if (aFamily !== bFamily) {
        return getFamilySortRank(aFamily) - getFamilySortRank(bFamily);
      }

      return (
        getModelSortRank(a.value, aFamily) -
        getModelSortRank(b.value, bFamily)
      );
    })
    .forEach((option) => modelSelect.appendChild(option));
}

function normalizeCustomModelFamily(family) {
  return CUSTOM_MODEL_FAMILY_CONFIG[family] ? family : "gpt";
}

function normalizeCustomModelApiType(apiType, family) {
  const value = String(apiType || "").trim().toLowerCase();

  if (value === "chat" || value === "responses" || value === "images") {
    return value;
  }

  return CUSTOM_MODEL_FAMILY_CONFIG[normalizeCustomModelFamily(family)].apiType;
}

function getApiTypeForModel(model) {
  model = normalizeModelName(model);

  if (CHAT_COMPLETIONS_IMAGE_MODELS.has(model)) return "chat";
  if (RESPONSES_IMAGE_MODELS.has(model)) return "responses";

  return "images";
}

function getModelFamilyLabel(family) {
  return CUSTOM_MODEL_FAMILY_CONFIG[family]?.label || "GPT-Image";
}

function getCustomModelDescription(family, apiType) {
  if (family === "nano") {
    return "自定义 Nano Banana / Gemini 兼容绘图模型，使用 Chat Completions 图片请求。";
  }

  const label = getModelFamilyLabel(family);

  if (apiType === "responses") {
    return `自定义 ${label} 绘图模型，使用 Responses API 图片工具请求。`;
  }

  return `自定义 ${label} 绘图模型，使用 Images API 图片生成请求。`;
}

function getCustomCardDescription(family, apiType) {
  if (family === "nano") {
    return "Chat Completions";
  }

  if (apiType === "responses") {
    return "Responses API";
  }

  return "Images API";
}

function setModel(model) {
  model = normalizeModelName(model);

  if (!model || HIDDEN_IMAGE_MODELS.has(model) || !MODEL_META[model]) {
    model = DEFAULT_IMAGE_MODEL;
  }

  ensureModelOption(model);

  const meta = getModelMeta(model);
  const family = meta.family || "gpt";

  applyModelFamilyUi(family, model);

  if (modelSelect) {
    modelSelect.value = model;
  }

  if (currentModelText) {
    currentModelText.textContent = meta.title || model;
  }

  if (currentModelDesc) {
    currentModelDesc.textContent = meta.description || "";
  }

  if (modelBadge) {
    modelBadge.textContent = model;
  }

  updateEmptyPreviewState(model);
  applyModelUiRestrictions(model);

  localStorage.setItem("xuai-model", model);

  updateApiInfo();
}

function updateEmptyPreviewState(model) {
  if (!gallery?.classList.contains("empty")) return;

  // 空状态是初始 HTML，不会随 modelBadge 自动变化，所以切换模型时手动同步。
  if (emptyStateBadge) {
    emptyStateBadge.textContent = model;
  }

  if (emptyStateTitle) {
    emptyStateTitle.textContent = `${model} 结果会显示在这里`;
  }

  if (emptyStateDesc) {
    emptyStateDesc.textContent = "填写 Prompt 后点击生成按钮。";
  }

  setStatus("等待生成，结果会显示在这里。", "info");
}

function getEndpointForModel(model) {
  model = normalizeModelName(model);

  if (CHAT_COMPLETIONS_IMAGE_MODELS.has(model)) {
    return `${FIXED_API_BASE}/v1/chat/completions`;
  }

  if (RESPONSES_IMAGE_MODELS.has(model)) {
    return `${FIXED_API_BASE}/v1/responses`;
  }

  return `${FIXED_API_BASE}/v1/images/generations`;
}

function updateApiInfo() {
  const model = normalizeModelName(modelSelect?.value || DEFAULT_IMAGE_MODEL);

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

function parseModelList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isGpt54Model(model) {
  return RESPONSES_IMAGE_MODELS.has(normalizeModelName(model));
}

function shouldHideForModel(item, model) {
  model = normalizeModelName(model);

  if (!item?.hideFor?.length) {
    return false;
  }

  return item.hideFor.includes(model);
}

function applyModelUiRestrictions(model) {
  model = normalizeModelName(model);

  applySizeOptionsForModel(model);
  applyFormatOptionsForModel(model);
}

function applySizeOptionsForModel(model) {
  if (!sizeSelect) return;

  const currentValue = sizeSelect.value;

  sizeSelect.innerHTML = "";

  const options = ORIGINAL_SIZE_OPTIONS.filter((option) => {
    if (shouldHideForModel(option, model)) {
      return false;
    }

    if (isGpt54Model(model) && GPT54_DISABLED_SIZES.has(option.value)) {
      return false;
    }

    return true;
  });

  options.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.text;
    option.disabled = item.disabled;
    sizeSelect.appendChild(option);
  });

  const values = options.map((item) => item.value);

  if (values.includes(currentValue)) {
    sizeSelect.value = currentValue;
  } else {
    sizeSelect.value = values.includes("auto") ? "auto" : values[0] || "";
  }
}

function applyFormatOptionsForModel(model) {
  if (!formatFieldRow) return;

  const currentValue =
    document.querySelector('input[name="format"]:checked')?.value || "png";

  const options = ORIGINAL_FORMAT_OPTIONS.filter((option) => {
    if (shouldHideForModel(option, model)) {
      return false;
    }

    if (isGpt54Model(model) && !GPT54_ALLOWED_FORMATS.has(option.value)) {
      return false;
    }

    return true;
  });

  formatFieldRow.innerHTML = `
    <label>输出格式</label>
    ${options.map((option) => option.labelHTML).join("")}
  `;

  const allowedValues = options.map((option) => option.value);

  let nextValue = currentValue;

  if (!allowedValues.includes(nextValue)) {
    nextValue = "png";
  }

  const inputs = Array.from(
    formatFieldRow.querySelectorAll('input[name="format"]')
  );

  const targetInput = inputs.find((input) => input.value === nextValue);

  if (targetInput) {
    targetInput.checked = true;
  }
}

async function handleGenerate(event) {
  event.preventDefault();

  console.log("点击了生成图片按钮");

  lockProviderSettings();

  const prompt = promptInput?.value.trim() || "";
  const model = normalizeModelName(modelSelect?.value || DEFAULT_IMAGE_MODEL);

  // 这些参数已经从 UI 中移除。
  // 如果需要控制尺寸、质量、背景、风格，请直接写进 Prompt。
  // 默认不主动提交 size / quality / background。
  let size = "auto";
  const quality = "auto";
  const background = "auto";

  // 输出格式不再暴露给 UI。
  // 普通图片模型默认不额外提交格式；gpt-5.4 会兜底固定为 png。
  let format = "png";

  // 生成数量已从 UI 移除，默认每次生成 1 张。
  const count = 1;

  const baseURL = normalizeBaseUrl(FIXED_API_BASE);
  const key = apiKey?.value.trim() || "";

  if (isGpt54Model(model)) {
    if (GPT54_DISABLED_SIZES.has(size)) {
      console.warn(`gpt-5.4 不允许尺寸 ${size}，已自动改为 auto`);
      size = "auto";
    }

    if (!GPT54_ALLOWED_FORMATS.has(format)) {
      console.warn(`gpt-5.4 不允许输出格式 ${format}，已自动改为 png`);
      format = "png";
    }
  }

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

  startGenerationIndicator(model);

  console.log("准备发送的生成参数：", {
    model,
    size,
    quality,
    background,
    format,
    count,
  });

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

    finishGenerationIndicator(
      "success",
      `模型 ${model} 已完成图片生成。`
    );

    setStatus("图片生成完成。", "success");
  } catch (error) {
    console.error(error);

    finishGenerationIndicator(
      "error",
      error.message || "生成失败，请查看控制台或下方调试信息。"
    );

    setStatus("图片生成失败，请查看下方提示和调试信息。", "error");

    showDebug(
      error.raw || {
        error: error.message,
        model,
        request_url: getEndpointForModel(model),
        tip: "如果是 504 Gateway Timeout，通常表示中转站请求上游模型超时；如果是 CORS，则需要在中转站配置跨域。",
      }
    );
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

  if (GEMINI_IMAGE_MODELS.has(model)) {
    return await callGeminiImageApi({
      baseURL,
      key,
      model,
      prompt,
      count,
    });
  }

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

  // 对 gpt-image 系列通常是 output_format。
  // 现在 UI 已经移除输出格式，默认 format=png 时不提交。
  if (format && format !== "png") payload.output_format = format;

  console.log("Images API 请求参数：", payload);

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
    const error = new Error(buildApiErrorMessage(raw, response, "Images API"));
    error.raw = {
      request_url: url,
      request_payload: payload,
      response: raw,
    };
    throw error;
  }

  const data = Array.isArray(raw?.data) ? raw.data : [];

  const images = data
    .map((item) => {
      if (item.url) return item.url;
      if (item.b64_json) return `data:image/png;base64,${item.b64_json}`;
      if (item.image_base64) return `data:image/png;base64,${item.image_base64}`;
      if (item.base64) return `data:image/png;base64,${item.base64}`;
      return null;
    })
    .filter(Boolean);

  if (!images.length) {
    const error = new Error(
      "Images API 返回成功，但没有找到图片 URL 或 base64 图片数据。"
    );
    error.raw = {
      request_url: url,
      request_payload: payload,
      response: raw,
      tip: "请检查返回结构中图片字段名称，或确认接口是否返回了 file_id/sandbox 路径而不是可直接显示的图片数据。",
    };
    throw error;
  }

  return {
    images,
    raw: {
      request_url: url,
      request_payload: payload,
      response: raw,
      extracted_images_count: images.length,
    },
  };
}

async function callGeminiImageApi({
  baseURL,
  key,
  model,
  prompt,
  count,
}) {
  const url = `${baseURL}/v1/chat/completions`;

  console.log("准备请求 Gemini / Nano Banana 图片 API：", url);

  const images = [];
  const debugItems = [];

  for (let i = 0; i < count; i++) {
    const payload = {
      model,

      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],

      // Gemini 图片模型通常需要声明希望返回 text + image。
      // 如果你的中转站不支持 modalities，返回 400 时可以删除这一行。
      modalities: ["text", "image"],

      stream: false,
    };

    console.log(`Gemini 图片请求参数 #${i + 1}：`, payload);

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
      const error = new Error(
        buildApiErrorMessage(raw, response, "Gemini 图片 API")
      );

      error.raw = {
        request_url: url,
        request_payload: payload,
        response: raw,
        tip: "如果返回 400，可能是中转站不支持 modalities 字段，可以先删除 payload.modalities 再试。",
      };

      throw error;
    }

    console.log("Gemini 图片 API 返回：", raw);

    const currentImages = extractImagesFromAnyResponse(raw);

    if (!currentImages.length) {
      const outputText = extractTextFromAnyResponse(raw);

      const error = new Error(
        outputText
          ? `Gemini 模型没有生成图片，而是返回了文字：${outputText}`
          : "Gemini 图片 API 返回成功，但没有找到图片数据。"
      );

      error.raw = {
        request_url: url,
        request_payload: payload,
        response: raw,
        output_text: outputText || undefined,
        tip: "请查看 response 结构。如果图片在 inline_data / inlineData / image_url / b64_json 等字段里，可以继续扩展提取逻辑。",
      };

      throw error;
    }

    images.push(...currentImages);

    debugItems.push({
      request_url: url,
      request_payload: payload,
      response: raw,
      extracted_images_count: currentImages.length,
    });
  }

  return {
    images: images.slice(0, count),
    raw: count === 1 ? debugItems[0] : debugItems,
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
  const debugItems = [];

  for (let i = 0; i < count; i++) {
    const imageTool = {
      type: "image_generation",
    };

    if (size && size !== "auto") {
      imageTool.size = size;
    }

    if (quality && quality !== "auto") {
      imageTool.quality = quality;
    }

    if (background && background !== "auto") {
      imageTool.background = background;
    }

    // gpt-5.4 只允许 PNG；Responses API 图片工具使用 output_format。
    if (isGpt54Model(model)) {
      imageTool.output_format = "png";
    } else if (format) {
      imageTool.output_format = format;
    }

    const payload = {
      model,
      input: prompt,
      tools: [imageTool],

      // 尽量让 Responses API 直接调用图片工具，避免只返回一段文字。
      // 如果你的中转站不支持 tool_choice，出现 400 时可以删除这一行。
      tool_choice: "required",
    };

    console.log(`Responses API 请求参数 #${i + 1}：`, payload);
    console.log("最终发送给 Responses API 的 imageTool =", imageTool);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(payload),
    });

    let raw = await safeJson(response);

    if (!response.ok) {
      const error = new Error(
        buildApiErrorMessage(raw, response, "Responses API")
      );
      error.raw = {
        request_url: url,
        request_payload: payload,
        response: raw,
      };
      throw error;
    }

    console.log("Responses API 初始返回：", raw);

    const waitResult = await waitForResponsesImageResult({
      baseURL,
      key,
      initialRaw: raw,
      requestPayload: payload,
    });

    raw = waitResult.raw;

    const currentImages = extractImagesFromResponses(raw);

    if (!currentImages.length) {
      const outputText = extractOutputTextFromResponses(raw);

      const error = new Error(
        outputText
          ? `模型没有生成图片，而是返回了文字：${outputText}`
          : "Responses API 返回成功，但没有找到图片数据。请查看下方 request_payload 和 response。"
      );

      error.raw = {
        request_url: url,
        request_payload: payload,
        response: raw,
        output_text: outputText || undefined,
        pending_image_call: hasPendingImageCall(raw),
        tip: outputText
          ? "模型返回了文字说明，说明这次没有调用图片生成工具。通常是 Prompt 触发安全限制，或者模型判断不应生成图片。"
          : "如果 response.output 里 image_generation_call.status 仍是 generating，说明图片还没真正生成完成；如果 result 是空，则需要继续轮询或降低尺寸/质量。如果返回 file_id 或 sandbox:/mnt/data 路径，前端不能直接用 <img> 显示，需要服务端转换成公网 URL 或 base64。",
      };

      throw error;
    }

    images.push(...currentImages);

    debugItems.push({
      request_url: url,
      request_payload: payload,
      response: raw,
      poll_attempts: waitResult.pollAttempts,
      extracted_images_count: currentImages.length,
      note:
        getResponseQuality(raw) && getResponseQuality(raw) !== quality
          ? `注意：前端请求 quality=${quality}，但响应里显示 quality=${getResponseQuality(
              raw
            )}，说明服务端或上游模型可能做了自动降级。`
          : undefined,
    });
  }

  return {
    images: images.slice(0, count),
    raw: count === 1 ? debugItems[0] : debugItems,
  };
}

async function waitForResponsesImageResult({
  baseURL,
  key,
  initialRaw,
  requestPayload,
}) {
  let raw = initialRaw;
  let pollAttempts = 0;

  for (let attempt = 0; attempt <= RESPONSES_MAX_POLL_ATTEMPTS; attempt++) {
    const images = extractImagesFromResponses(raw);

    if (images.length) {
      return {
        raw,
        pollAttempts,
      };
    }

    const pending = hasPendingImageCall(raw);

    if (!pending) {
      return {
        raw,
        pollAttempts,
      };
    }

    const responseId = raw?.id;

    if (!responseId) {
      return {
        raw,
        pollAttempts,
      };
    }

    if (attempt === RESPONSES_MAX_POLL_ATTEMPTS) {
      return {
        raw,
        pollAttempts,
      };
    }

    pollAttempts += 1;

    const message = `图片仍在生成中，正在轮询结果 ${pollAttempts}/${RESPONSES_MAX_POLL_ATTEMPTS}...`;
    console.log(message);
    setStatus(message, "loading");
    updateGenerationIndicatorDesc(message);

    await delay(RESPONSES_POLL_INTERVAL_MS);

    const retrieveUrl = `${baseURL}/v1/responses/${encodeURIComponent(
      responseId
    )}`;

    const retrieveResponse = await fetch(retrieveUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
      },
    });

    const nextRaw = await safeJson(retrieveResponse);

    if (!retrieveResponse.ok) {
      const error = new Error(
        buildApiErrorMessage(nextRaw, retrieveResponse, "Responses API 轮询")
      );

      error.raw = {
        request_url: `${baseURL}/v1/responses`,
        request_payload: requestPayload,
        retrieve_url: retrieveUrl,
        initial_response: initialRaw,
        retrieve_response: nextRaw,
        tip: "中转站可能不支持 GET /v1/responses/{id} 轮询接口。如果不支持，需要降低尺寸/质量，或者让后端实现异步任务。",
      };

      throw error;
    }

    console.log(`Responses API 轮询返回 #${pollAttempts}：`, nextRaw);

    raw = nextRaw;
  }

  return {
    raw,
    pollAttempts,
  };
}

function hasPendingImageCall(raw) {
  if (!raw) return false;

  const responseStatus = String(raw.status || "").toLowerCase();

  if (
    responseStatus === "queued" ||
    responseStatus === "in_progress" ||
    responseStatus === "generating"
  ) {
    return true;
  }

  if (!Array.isArray(raw.output)) {
    return false;
  }

  return raw.output.some((item) => {
    if (item?.type !== "image_generation_call") return false;

    const status = String(item.status || "").toLowerCase();
    const result = item.result;

    if (result) return false;

    return (
      status === "queued" ||
      status === "pending" ||
      status === "in_progress" ||
      status === "generating"
    );
  });
}

function getResponseQuality(raw) {
  if (!Array.isArray(raw?.output)) return "";

  const imageCall = raw.output.find(
    (item) => item?.type === "image_generation_call"
  );

  return imageCall?.quality || "";
}

function extractOutputTextFromResponses(raw) {
  const texts = [];

  if (Array.isArray(raw?.output)) {
    raw.output.forEach((item) => {
      if (item?.type === "message" && Array.isArray(item.content)) {
        item.content.forEach((contentItem) => {
          if (contentItem?.type === "output_text" && contentItem.text) {
            texts.push(contentItem.text);
          }
        });
      }

      if (item?.type === "output_text" && item.text) {
        texts.push(item.text);
      }
    });
  }

  if (typeof raw?.output_text === "string") {
    texts.push(raw.output_text);
  }

  return texts.join("\n\n").trim();
}

function extractImagesFromAnyResponse(raw) {
  return extractImagesFromResponses(raw);
}

function extractTextFromAnyResponse(raw) {
  const texts = [];

  const responsesText = extractOutputTextFromResponses(raw);
  if (responsesText) {
    texts.push(responsesText);
  }

  if (Array.isArray(raw?.choices)) {
    raw.choices.forEach((choice) => {
      const message = choice?.message;

      if (!message) return;

      if (typeof message.content === "string") {
        texts.push(message.content);
      }

      if (Array.isArray(message.content)) {
        message.content.forEach((item) => {
          if (typeof item === "string") {
            texts.push(item);
          }

          if (item?.type === "text" && item.text) {
            texts.push(item.text);
          }

          if (item?.text) {
            texts.push(item.text);
          }
        });
      }
    });
  }

  if (Array.isArray(raw?.candidates)) {
    raw.candidates.forEach((candidate) => {
      const parts = candidate?.content?.parts;

      if (Array.isArray(parts)) {
        parts.forEach((part) => {
          if (part?.text) {
            texts.push(part.text);
          }
        });
      }
    });
  }

  return texts.join("\n\n").trim();
}

function extractImagesFromResponses(raw) {
  const images = [];
  const visited = new WeakSet();

  const pushDisplayableImage = (value) => {
    if (!value) return;

    const text = String(value).trim();

    if (text.startsWith("http://") || text.startsWith("https://")) {
      images.push(text);
      return;
    }

    if (text.startsWith("data:image/")) {
      images.push(text);
      return;
    }
  };

  const pushBase64Image = (value, format = "png", force = false) => {
    if (!value) return;

    const cleaned = String(value).replace(/\s/g, "");

    if (force) {
      if (cleaned.length < 50) return;
      if (!/^[A-Za-z0-9+/=_-]+$/.test(cleaned)) return;
    } else {
      if (!looksLikeBase64Image(cleaned)) return;
    }

    const imageFormat = normalizeImageFormat(format);
    images.push(`data:image/${imageFormat};base64,${cleaned}`);
  };

  const walk = (value, context = {}) => {
    if (!value) return;

    if (Array.isArray(value)) {
      value.forEach((item) => walk(item, context));
      return;
    }

    if (typeof value === "string") {
      const text = value.trim();

      if (!text) return;

      if (text.startsWith("http://") || text.startsWith("https://")) {
        pushDisplayableImage(text);
        return;
      }

      if (text.startsWith("data:image/")) {
        pushDisplayableImage(text);
        return;
      }

      if (looksLikeBase64Image(text)) {
        pushBase64Image(text, context.output_format || context.format || "png");
        return;
      }

      const markdownImages = [...text.matchAll(/!\[[^\]]*]\(([^)]+)\)/g)];
      markdownImages.forEach((match) => {
        const src = match[1];

        if (src.startsWith("http://") || src.startsWith("https://")) {
          pushDisplayableImage(src);
        }

        if (src.startsWith("data:image/")) {
          pushDisplayableImage(src);
        }
      });

      const urls = text.match(/https?:\/\/[^\s"'<>)]*/g);
      if (urls) {
        urls.forEach(pushDisplayableImage);
      }

      if (
        (text.startsWith("{") && text.endsWith("}")) ||
        (text.startsWith("[") && text.endsWith("]"))
      ) {
        try {
          walk(JSON.parse(text), context);
        } catch {
          // ignore
        }
      }

      return;
    }

    if (typeof value === "object") {
      if (visited.has(value)) return;
      visited.add(value);

      const localContext = {
        ...context,
        output_format:
          value.output_format ||
          value.outputFormat ||
          value.format ||
          mimeTypeToImageFormat(value.mime_type || value.mimeType) ||
          context.output_format ||
          context.format ||
          "png",
      };

      // 常见图片 URL 字段。
      if (value.url) {
        pushDisplayableImage(value.url);
      }

      if (value.image_url) {
        if (typeof value.image_url === "string") {
          pushDisplayableImage(value.image_url);
        } else {
          walk(value.image_url, localContext);
        }
      }

      // 常见 base64 字段。
      if (value.b64_json) {
        pushBase64Image(value.b64_json, localContext.output_format);
      }

      if (value.image_base64) {
        pushBase64Image(value.image_base64, localContext.output_format);
      }

      if (value.base64) {
        pushBase64Image(value.base64, localContext.output_format);
      }

      // Gemini / Google 常见 inline image 字段：inlineData / inline_data。
      if (value.inlineData?.data) {
        pushBase64Image(
          value.inlineData.data,
          mimeTypeToImageFormat(value.inlineData.mimeType) ||
            localContext.output_format,
          true
        );
      }

      if (value.inline_data?.data) {
        pushBase64Image(
          value.inline_data.data,
          mimeTypeToImageFormat(value.inline_data.mime_type) ||
            localContext.output_format,
          true
        );
      }

      // 某些兼容接口可能会用 data + mime_type 存放图片。
      if (
        value.data &&
        (String(value.mime_type || value.mimeType || "").startsWith("image/"))
      ) {
        pushBase64Image(
          value.data,
          mimeTypeToImageFormat(value.mime_type || value.mimeType) ||
            localContext.output_format,
          true
        );
      }

      // Responses API image_generation_call 常见 result 字段。
      if (value.result) {
        if (typeof value.result === "string") {
          if (
            value.result.startsWith("http://") ||
            value.result.startsWith("https://") ||
            value.result.startsWith("data:image/")
          ) {
            pushDisplayableImage(value.result);
          } else {
            pushBase64Image(value.result, localContext.output_format);
          }
        } else {
          walk(value.result, localContext);
        }
      }

      Object.values(value).forEach((child) => {
        walk(child, localContext);
      });
    }
  };

  walk(raw);

  return uniqueArray(images);
}

function looksLikeBase64Image(value) {
  if (!value) return false;

  const cleaned = String(value).replace(/\s/g, "");

  if (cleaned.length < 100) return false;

  // 常见图片 base64 开头：
  // PNG:  iVBORw0KGgo
  // JPEG: /9j/
  // WEBP: UklGR
  // GIF:  R0lGOD
  const hasImageMagicHeader = /^(iVBORw0KGgo|\/9j\/|UklGR|R0lGOD)/.test(
    cleaned
  );

  if (!hasImageMagicHeader) return false;

  return /^[A-Za-z0-9+/=_-]+$/.test(cleaned);
}

function normalizeImageFormat(format) {
  const value = String(format || "png").toLowerCase();

  if (value === "jpg") return "jpeg";
  if (value === "jpeg") return "jpeg";
  if (value === "webp") return "webp";
  if (value === "gif") return "gif";
  if (value === "png") return "png";

  return "png";
}

function mimeTypeToImageFormat(mimeType) {
  const value = String(mimeType || "").toLowerCase();

  if (value.includes("image/png")) return "png";
  if (value.includes("image/jpeg")) return "jpeg";
  if (value.includes("image/jpg")) return "jpeg";
  if (value.includes("image/webp")) return "webp";
  if (value.includes("image/gif")) return "gif";

  return "";
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
    return `${apiName} 返回 404 Not Found：请检查请求路径、模型是否支持，或中转站是否支持该接口。${
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

  const redacted = redactLargeImageData(data);

  debugBox.textContent =
    typeof redacted === "string" ? redacted : JSON.stringify(redacted, null, 2);

  debugBox.classList.add("show");
}

function redactLargeImageData(value, seen = new WeakSet()) {
  if (value == null) return value;

  if (typeof value === "string") {
    const text = value.trim();

    if (text.startsWith("data:image/")) {
      return `[data:image 已隐藏，长度 ${text.length}]`;
    }

    if (looksLikeBase64Image(text)) {
      return `[base64 图片已隐藏，长度 ${text.length}]`;
    }

    if (text.length > 12000) {
      return `${text.slice(0, 12000)}\n...[内容过长，已截断，原长度 ${text.length}]`;
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactLargeImageData(item, seen));
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }

    seen.add(value);

    const output = {};

    Object.entries(value).forEach(([key, child]) => {
      const lowerKey = key.toLowerCase();

      if (
        lowerKey.includes("b64") ||
        lowerKey.includes("base64") ||
        lowerKey === "result" ||
        lowerKey === "data"
      ) {
        if (typeof child === "string" && child.length > 100) {
          output[key] = redactLargeImageData(child, seen);
          return;
        }
      }

      output[key] = redactLargeImageData(child, seen);
    });

    return output;
  }

  return value;
}

function handleBeforeUnload(event) {
  if (!isGeneratingImage) return;

  event.preventDefault();
  event.returnValue = "";
}

function startGenerationIndicator(model) {
  isGeneratingImage = true;
  generationStartTime = Date.now();

  if (generationTimerId) {
    clearInterval(generationTimerId);
    generationTimerId = null;
  }

  if (generationNotice) {
    generationNotice.hidden = false;
    generationNotice.classList.remove(
      "success",
      "error",
      "is-success",
      "is-error"
    );
    generationNotice.classList.add("loading", "is-loading");
  }

  if (generationNoticeIcon) {
    generationNoticeIcon.textContent = "!";
  }

  if (generationNoticeTitle) {
    generationNoticeTitle.textContent =
      "正在生成图片，请不要刷新页面或关闭当前标签页。";
  }

  if (generationNoticeDesc) {
    generationNoticeDesc.textContent =
      "生成任务已经提交，正在等待模型返回结果。大尺寸或高质量图片可能需要更长时间。";
  }

  if (generationModelName) {
    generationModelName.textContent = `生成模型：${model}`;
  }

  updateGenerationTimer();

  // 50ms 刷新一次，配合 formatElapsedTime 显示两位小数。
  generationTimerId = setInterval(updateGenerationTimer, 50);
}

function finishGenerationIndicator(type = "success", message = "") {
  const elapsed = generationStartTime ? Date.now() - generationStartTime : 0;

  isGeneratingImage = false;

  if (generationTimerId) {
    clearInterval(generationTimerId);
    generationTimerId = null;
  }

  if (!generationNotice) return;

  generationNotice.hidden = false;
  generationNotice.classList.remove(
    "loading",
    "success",
    "error",
    "is-loading",
    "is-success",
    "is-error"
  );

  const isError = type === "error";

  generationNotice.classList.add(isError ? "error" : "success");
  generationNotice.classList.add(isError ? "is-error" : "is-success");

  if (isError) {
    if (generationNoticeIcon) {
      generationNoticeIcon.textContent = "!";
    }

    if (generationNoticeTitle) {
      generationNoticeTitle.textContent = "图片生成失败。";
    }

    if (generationNoticeDesc) {
      generationNoticeDesc.textContent =
        message || "生成过程中发生错误，请查看下方调试信息。";
    }
  } else {
    if (generationNoticeIcon) {
      generationNoticeIcon.textContent = "✓";
    }

    if (generationNoticeTitle) {
      generationNoticeTitle.textContent = "图片生成完成。";
    }

    if (generationNoticeDesc) {
      generationNoticeDesc.textContent =
        message || "图片已经生成完成，结果已显示在下方。";
    }
  }

  if (generationTimer) {
    generationTimer.textContent = `总用时 ${formatElapsedTime(elapsed)}`;
  }
}

function updateGenerationIndicatorDesc(message) {
  if (!generationNoticeDesc || !message) return;

  generationNoticeDesc.textContent = message;
}

function updateGenerationTimer() {
  if (!generationTimer || !generationStartTime) return;

  const elapsed = Date.now() - generationStartTime;
  generationTimer.textContent = `已用时 ${formatElapsedTime(elapsed)}`;
}

function formatElapsedTime(milliseconds) {
  const totalCentiseconds = Math.max(0, Math.floor(milliseconds / 10));

  const centiseconds = totalCentiseconds % 100;
  const totalSeconds = Math.floor(totalCentiseconds / 100);

  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);

  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  const cs = String(centiseconds).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");

  if (hours > 0) {
    const hh = String(hours).padStart(2, "0");
    return `${hh}:${mm}:${ss}.${cs}`;
  }

  return `${mm}:${ss}.${cs}`;
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
