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
const modeInputs = $$('input[name="mode"]');
const imageEditFields = $("#imageEditFields");
const editImageInput = $("#editImageInput");
const editMaskInput = $("#editMaskInput");
const modelPickerLabel = $("[data-model-picker-label]");
const sizeSelect = $("#size");
const countInput = $("#count");
const generateBtn = $("#generateBtn");

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
const navItems = $$(".nav-item[data-tool]");
const toolPanels = $$("[data-tool-panel]");
const hero = $(".hero");
const heroTitle = $(".hero h2");
const heroTitleText = $(".hero [data-hero-title]");
const heroIcon = $(".hero .hero-icon");
const heroDesc = $(".hero p");
const heroActions = $(".hero-actions");

const videoForm = $("#videoForm");
const videoModelInput = $("#videoModel");
const videoPromptInput = $("#videoPrompt");
const videoSizeSelect = $("#videoSize");
const videoSecondsInput = $("#videoSeconds");
const videoGenerateBtn = $("#videoGenerateBtn");
const videoStatusText = $("#videoStatusText");
const videoModelBadge = $("#videoModelBadge");
const videoGallery = $("#videoGallery");
const videoDebugBox = $("#videoDebugBox");
const videoModelCards = $("#videoModelCards");
const videoModelSyncText = $("#videoModelSyncText");

const transcriptionForm = $("#transcriptionForm");
const transcriptionModelInput = $("#transcriptionModel");
const transcriptionPromptInput = $("#transcriptionPrompt");
const audioFileInput = $("#audioFileInput");
const transcriptionBtn = $("#transcriptionBtn");
const transcriptionStatusText = $("#transcriptionStatusText");
const transcriptionResult = $("#transcriptionResult");
const transcriptionDebugBox = $("#transcriptionDebugBox");
const transcriptionModelCards = $("#transcriptionModelCards");
const transcriptionModelSyncText = $("#transcriptionModelSyncText");
const transcriptionStatusBadge = $('[data-status-badge="transcription"]');

const realtimeModelInput = $("#realtimeModel");
const realtimeInstructionsInput = $("#realtimeInstructions");
const realtimeStartBtn = $("#realtimeStartBtn");
const realtimeStopBtn = $("#realtimeStopBtn");
const realtimeStatusText = $("#realtimeStatusText");
const realtimeAudio = $("#realtimeAudio");
const realtimeLog = $("#realtimeLog");
const realtimeDebugBox = $("#realtimeDebugBox");
const realtimeModelCards = $("#realtimeModelCards");
const realtimeModelSyncText = $("#realtimeModelSyncText");
const realtimeStatusBadge = $('[data-status-badge="realtime"]');

const ttsForm = $("#ttsForm");
const ttsModelInput = $("#ttsModel");
const ttsVoiceInput = $("#ttsVoice");
const ttsTextInput = $("#ttsText");
const ttsBtn = $("#ttsBtn");
const ttsStatusText = $("#ttsStatusText");
const ttsResult = $("#ttsResult");
const ttsDebugBox = $("#ttsDebugBox");
const ttsModelCards = $("#ttsModelCards");
const ttsModelSyncText = $("#ttsModelSyncText");
const ttsStatusBadge = $('[data-status-badge="tts"]');

const historyList = $("#historyList");
const historyStatusText = $("#historyStatusText");
const clearHistoryBtn = $("#clearHistoryBtn");
const historyFilters = $("#historyFilters");
const IMAGE_EDIT_ENABLED = true;
const HISTORY_STORAGE_KEY = "xuai-task-history";
const HIDDEN_TOOL_MODEL_STORAGE_KEY = "xuai-hidden-tool-models";
const HIDDEN_TOOL_MODELS = loadHiddenToolModels();
const TOOL_SWITCH_OUT_MS = 85;
const TOOL_SWITCH_IN_MS = 233;
const TOOL_META = {
  image: {
    title: "图片生成",
    desc: "输入画面描述，调用绘图模型生成高质量图片。",
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"></rect><circle cx="8.5" cy="10" r="1.5"></circle><path d="m3 16 5-5 4 4 2.5-2.5L21 18"></path></svg>',
  },
  video: {
    title: "视频生成",
    desc: "输入镜头、风格和时长描述，选择可用视频模型后提交任务。",
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="13" height="10" rx="2"></rect><path d="m16 11 5-3v8l-5-3"></path></svg>',
  },
  transcription: {
    title: "音频转文字",
    desc: "上传音频或视频文件，将语音内容转写成可复制文本。",
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><path d="M12 19v3"></path><path d="M8 22h8"></path></svg>',
  },
  realtime: {
    title: "实时语音",
    desc: "通过浏览器麦克风连接实时语音模型，进行低延迟对话。",
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8a4 4 0 0 1 0 8"></path><path d="M8.5 5.5a8 8 0 0 1 0 13"></path><path d="M15.5 5.5a8 8 0 0 1 0 13"></path><circle cx="12" cy="12" r="1"></circle></svg>',
  },
  tts: {
    title: "文字转语音",
    desc: "输入文本并选择音色，合成为可播放和下载的语音。",
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z"></path><path d="M16 9a5 5 0 0 1 0 6"></path><path d="M19 6a9 9 0 0 1 0 12"></path></svg>',
  },
  history: {
    title: "历史记录",
    desc: "查看、筛选和重新加载保存在本地浏览器中的最近任务。",
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"></path><path d="M3 4v5h5"></path><path d="M12 7v5l3 2"></path></svg>',
  },
};

let realtimePeerConnection = null;
let realtimeDataChannel = null;
let realtimeLocalStream = null;
let toolApiKeyInputs = [];
let toolModelRefreshBtns = [];
let historyFilter = "all";
let activeTool = "image";
let toolSwitchTimers = [];
const taskIndicators = {};
const taskStatusBadges = {};

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
  lockProviderSettings();
  initSharedApiKeyInputs();
  normalizeToolModelCards();
  initApiConnectionUi();
  initTaskStatusUi();

  const savedModel = normalizeModelName(
    localStorage.getItem("xuai-model") || DEFAULT_IMAGE_MODEL
  );

  setModel(savedModel);
  syncImageModeUi();
  renderHistory();
  decorateToolIcons();
  syncToolHeader("image");

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

  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      switchTool(item.dataset.tool || "image");
    });
  });

  modeInputs.forEach((input) => {
    input.addEventListener("change", syncImageModeUi);
  });

  if (apiKey) {
    apiKey.addEventListener("input", () => {
      syncSharedApiKeyInputs(apiKey.value);
    });

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

  if (modelSelect) {
    modelSelect.addEventListener("change", () => {
      const model = normalizeModelName(modelSelect.value);
      setModel(model);
    });
  }

  if (form) {
    form.addEventListener("submit", handleGenerate);
  }

  if (videoForm) {
    videoForm.addEventListener("submit", handleVideoGenerate);
  }

  if (transcriptionForm) {
    transcriptionForm.addEventListener("submit", handleTranscription);
  }

  if (ttsForm) {
    ttsForm.addEventListener("submit", handleTextToSpeech);
  }

  if (realtimeStartBtn) {
    realtimeStartBtn.addEventListener("click", startRealtimeVoice);
  }

  if (realtimeStopBtn) {
    realtimeStopBtn.addEventListener("click", stopRealtimeVoice);
  }

  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", clearHistory);
  }

  historyFilters?.querySelectorAll("[data-history-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      historyFilter = button.dataset.historyFilter || "all";
      renderHistory();
    });
  });

  historyList?.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-history-delete]");
    if (deleteButton) {
      deleteHistoryEntry(deleteButton.dataset.historyDelete);
      return;
    }

    const reloadButton = event.target.closest("[data-history-reload]");
    if (reloadButton) {
      reloadHistoryEntry(reloadButton.dataset.historyReload);
    }
  });

  window.addEventListener("beforeunload", handleBeforeUnload);
}

function switchTool(tool) {
  const currentPanel = toolPanels.find((panel) => !panel.hidden);
  const nextPanel = toolPanels.find((panel) => panel.dataset.toolPanel === tool);
  const toolChanged = activeTool !== tool;
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  if (!toolChanged) {
    if (tool === "history") {
      renderHistory();
    }
    return;
  }

  clearToolSwitchTimers();

  navItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.tool === tool);
  });

  toolPanels.forEach((panel) => {
    panel.classList.remove("is-entering", "is-leaving");
  });

  if (reduceMotion || !currentPanel || !nextPanel) {
    toolPanels.forEach((panel) => {
      panel.hidden = panel.dataset.toolPanel !== tool;
    });

    activeTool = tool;
    syncToolHeader(tool);

    if (tool === "history") {
      renderHistory();
    }
    return;
  }

  currentPanel.classList.add("is-leaving");

  if (hero) {
    hero.classList.remove("is-entering", "is-leaving");
    void hero.offsetWidth;
    hero.classList.add("is-leaving");
  }

  toolSwitchTimers.push(
    window.setTimeout(() => {
      currentPanel.hidden = true;
      currentPanel.classList.remove("is-leaving");

      nextPanel.hidden = false;
      nextPanel.classList.remove("is-leaving");
      void nextPanel.offsetWidth;
      nextPanel.classList.add("is-entering");

      activeTool = tool;
      syncToolHeader(tool);

      if (hero) {
        hero.classList.remove("is-leaving");
        void hero.offsetWidth;
        hero.classList.add("is-entering");
      }

      if (tool === "history") {
        renderHistory();
      }
    }, TOOL_SWITCH_OUT_MS)
  );

  toolSwitchTimers.push(
    window.setTimeout(() => {
      nextPanel.classList.remove("is-entering");
      hero?.classList.remove("is-entering", "is-leaving");
    }, TOOL_SWITCH_OUT_MS + TOOL_SWITCH_IN_MS)
  );
}

function clearToolSwitchTimers() {
  toolSwitchTimers.forEach((timer) => window.clearTimeout(timer));
  toolSwitchTimers = [];
}

function decorateToolIcons() {
  navItems.forEach((item) => {
    const tool = item.dataset.tool;
    const meta = TOOL_META[tool];
    if (!meta || item.querySelector(".nav-icon")) return;

    item.innerHTML = `<span class="nav-icon" aria-hidden="true">${meta.icon}</span><span>${meta.title}</span>`;
  });
}

function syncToolHeader(tool) {
  const meta = TOOL_META[tool] || {
    title: "XuAI API Studio",
    desc: "",
    icon: "",
  };

  if (heroTitleText) {
    heroTitleText.textContent = meta.title;
  } else if (heroTitle) {
    heroTitle.textContent = meta.title;
  }

  if (heroIcon) {
    heroIcon.innerHTML = meta.icon;
  }

  if (heroDesc) {
    heroDesc.textContent = meta.desc;
  }

  if (heroActions) {
    heroActions.hidden = tool !== "history";
  }
}

function getCurrentImageMode() {
  if (!IMAGE_EDIT_ENABLED) return "generate";

  return document.querySelector('input[name="mode"]:checked')?.value || "generate";
}

function syncImageModeUi() {
  const isEdit = getCurrentImageMode() === "edit";

  if (!IMAGE_EDIT_ENABLED) {
    const generateInput = document.querySelector('input[name="mode"][value="generate"]');
    const editInput = document.querySelector('input[name="mode"][value="edit"]');
    if (generateInput) generateInput.checked = true;
    if (editInput) editInput.disabled = true;
  }

  if (imageEditFields) {
    imageEditFields.hidden = !isEdit;
  }

  if (generateBtn) {
    generateBtn.textContent = isEdit ? "编辑图片" : "生成图片";
  }

  if (modelPickerLabel) {
    modelPickerLabel.textContent = isEdit ? "编辑模型" : "生成模型";
  }

  if (promptInput) {
    promptInput.placeholder = isEdit
      ? "描述你想如何修改上传的图片"
      : "例如：一只戴着宇航头盔的橘猫，坐在未来城市屋顶，电影感灯光，超清细节";
  }
}

function initSharedApiKeyInputs() {
  const forms = [
    { form: videoForm, tool: "video" },
    { form: transcriptionForm, tool: "transcription" },
    { form: $("#realtimeForm"), tool: "realtime" },
    { form: ttsForm, tool: "tts" },
  ].filter((item) => item.form);

  forms.forEach(({ form: targetForm, tool }) => {
    if (targetForm.querySelector("[data-shared-api-key]")) return;

    const row = document.createElement("div");
    row.className = "field-row api-key-row tool-api-key-row form-row-horizontal";
    row.innerHTML = `
      <label>API Key</label>
      <div class="key-wrap">
        <input type="password" autocomplete="off" placeholder="填入个人APIKey" data-shared-api-key />
        <button type="button" data-shared-api-key-toggle>显示</button>
        <button type="button" data-refresh-tool-models="${tool}">刷新模型</button>
      </div>
    `;

    targetForm.insertBefore(row, targetForm.firstElementChild);
  });

  toolApiKeyInputs = $$("[data-shared-api-key]");
  toolModelRefreshBtns = $$("[data-refresh-tool-models]");

  toolApiKeyInputs.forEach((input) => {
    input.value = apiKey?.value || "";
    input.addEventListener("input", () => {
      if (apiKey) {
        apiKey.value = input.value;
      }

      syncSharedApiKeyInputs(input.value, input);
    });
  });

  $$("[data-shared-api-key-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = button
        .closest(".tool-api-key-row")
        ?.querySelector("[data-shared-api-key]");
      if (!input) return;

      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      button.textContent = isPassword ? "隐藏" : "显示";
    });
  });

  toolModelRefreshBtns.forEach((button) => {
    button.addEventListener("click", () => {
      refreshToolModels(button.dataset.refreshToolModels);
    });
  });

  bindToolModelCards();
}

function syncSharedApiKeyInputs(value, sourceInput = null) {
  toolApiKeyInputs.forEach((input) => {
    if (input !== sourceInput) {
      input.value = value;
    }
  });
}

function getApiKeyValue() {
  return apiKey?.value.trim() || toolApiKeyInputs.find((input) => input.value.trim())?.value.trim() || "";
}

function normalizeToolModelCards() {
  ["video", "transcription", "realtime", "tts"].forEach((tool) => {
    const config = getToolModelConfig(tool);
    if (!config?.cards) return;

    config.cards.querySelectorAll(".tool-model-card").forEach((card) => {
      if (isToolModelHidden(tool, card.dataset.toolModel)) {
        card.remove();
      }
    });

    bindToolModelCards(config.cards);
    setToolModel(tool, findFirstToolModel(tool) || config.defaultModel);
  });
}

function getToolModelConfig(tool) {
  const configs = {
    video: {
      label: "视频",
      defaultModel: "",
      tag: "Video API",
      input: videoModelInput,
      cards: videoModelCards,
      syncText: videoModelSyncText,
      statusText: videoStatusText,
    },
    transcription: {
      label: "转写",
      defaultModel: "whisper-1",
      tag: "Transcriptions API",
      input: transcriptionModelInput,
      cards: transcriptionModelCards,
      syncText: transcriptionModelSyncText,
      statusText: transcriptionStatusText,
    },
    realtime: {
      label: "实时语音",
      defaultModel: "gpt-realtime",
      tag: "Realtime API",
      input: realtimeModelInput,
      cards: realtimeModelCards,
      syncText: realtimeModelSyncText,
      statusText: realtimeStatusText,
    },
    tts: {
      label: "文字转语音",
      defaultModel: "tts-1",
      tag: "Speech API",
      input: ttsModelInput,
      cards: ttsModelCards,
      syncText: ttsModelSyncText,
      statusText: ttsStatusText,
    },
  };

  return configs[tool] || null;
}

function bindToolModelCards(root = document) {
  root.querySelectorAll?.(".tool-model-card").forEach((card) => {
    syncToolModelCloseButton(card);

    if (card.dataset.toolModelBound === "true") return;

    card.dataset.toolModelBound = "true";
    card.addEventListener("click", (event) => {
      if (event?.target?.closest(".tool-model-card__close")) return;
      const tool = card.closest("[data-tool-model-picker]")?.dataset.toolModelPicker;
      const model = normalizeModelName(card.dataset.toolModel);
      setToolModel(tool, model);
    });
  });
}

function setToolModel(tool, model) {
  const config = getToolModelConfig(tool);
  model = normalizeModelName(model);

  if (!config) return;

  if (!model) {
    if (config.input) {
      config.input.value = "";
    }

    config.cards?.querySelectorAll(".tool-model-card").forEach((card) => {
      card.classList.remove("active");
    });
    return;
  }

  if (isToolModelHidden(tool, model)) {
    model = findFirstToolModel(tool) || config.defaultModel;
  }

  if (config.input) {
    config.input.value = model;
  }

  config.cards?.querySelectorAll(".tool-model-card").forEach((card) => {
    card.classList.toggle(
      "active",
      normalizeModelName(card.dataset.toolModel) === model
    );
  });
}

function syncToolModelCloseButton(card) {
  if (card.querySelector(".tool-model-card__close")) return;

  const button = document.createElement("span");
  button.role = "button";
  button.tabIndex = 0;
  button.className = "tool-model-card__close";
  button.title = "隐藏这个模型";
  button.setAttribute("aria-label", "隐藏这个模型");
  button.textContent = "×";

  const hide = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const tool = card.closest("[data-tool-model-picker]")?.dataset.toolModelPicker;
    hideToolModel(tool, normalizeModelName(card.dataset.toolModel));
  };

  button.addEventListener("click", hide);
  button.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    hide(event);
  });

  card.appendChild(button);
}

function hideToolModel(tool, model) {
  const config = getToolModelConfig(tool);
  model = normalizeModelName(model);

  if (!config || !model) return;

  if (!HIDDEN_TOOL_MODELS[tool]) {
    HIDDEN_TOOL_MODELS[tool] = [];
  }

  if (!HIDDEN_TOOL_MODELS[tool].includes(model)) {
    HIDDEN_TOOL_MODELS[tool].push(model);
    saveHiddenToolModels();
  }

  config.cards
    ?.querySelectorAll(".tool-model-card")
    .forEach((card) => {
      if (normalizeModelName(card.dataset.toolModel) === model) {
        card.remove();
      }
    });

  if (normalizeModelName(config.input?.value || "") === model) {
    setToolModel(tool, findFirstToolModel(tool) || config.defaultModel);
  }

  setToolModelSyncStatus(tool, `已隐藏模型 ${model}，刷新时不会再显示。`, "success");
}

function findFirstToolModel(tool) {
  const config = getToolModelConfig(tool);
  const card = Array.from(config?.cards?.querySelectorAll(".tool-model-card") || [])
    .find((item) => !isToolModelHidden(tool, item.dataset.toolModel));
  return normalizeModelName(card?.dataset.toolModel || "");
}

function isToolModelHidden(tool, model) {
  return (HIDDEN_TOOL_MODELS[tool] || []).includes(normalizeModelName(model));
}

async function refreshToolModels(tool) {
  const config = getToolModelConfig(tool);
  const key = getApiKeyValue();

  if (!config) return;

  if (!key) {
    config.statusText && setToolStatus(config.statusText, "请先填入个人 API Key。", "warning");
    apiKey?.focus();
    return;
  }

  const button = toolModelRefreshBtns.find(
    (item) => item.dataset.refreshToolModels === tool
  );
  const baseURL = normalizeBaseUrl(FIXED_API_BASE);
  const url = `${baseURL}/v1/models`;

  if (button) {
    button.disabled = true;
    button.textContent = "刷新中";
  }

  startToolTaskIndicator(
    tool,
    `正在刷新可用${config.label}模型...`,
    "正在读取当前 API Key 的模型列表，刷新结果会自动更新到左侧模型区。"
  );

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
    const detectedModels = uniqueArray(
      modelNames.filter(
        (model) => inferToolModelType(model) === tool && !isToolModelHidden(tool, model)
      )
    );

    pruneToolModelCards(tool, detectedModels);
    registerToolModels(tool, detectedModels);

    if (!detectedModels.length) {
      setToolModelSyncTextHidden(tool, false);
      finishToolTaskIndicator(
        tool,
        "warning",
        `没有从当前 API Key 的模型列表中识别到${config.label}模型。`,
        "未识别到可用模型。"
      );
      return;
    }

    setToolModelSyncTextHidden(tool, true);
    finishToolTaskIndicator(
      tool,
      "success",
      `已刷新 ${detectedModels.length} 个可用${config.label}模型。`,
      "模型刷新完成。"
    );
  } catch (error) {
    console.error(error);
    finishToolTaskIndicator(
      tool,
      "error",
      error.message || "刷新模型失败。",
      "模型刷新失败。"
    );
    showToolDebug(getToolDebugBox(tool), error.raw || { error: error.message });
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "刷新模型";
    }
  }
}

function registerToolModels(tool, models) {
  const config = getToolModelConfig(tool);
  if (!config?.cards) return;

  models.forEach((model) => ensureToolModelCard(tool, model));

  const currentModel = normalizeModelName(config.input?.value || "");
  if (currentModel) {
    setToolModel(tool, currentModel);
  } else if (models[0]) {
    setToolModel(tool, models[0]);
  }
}

function pruneToolModelCards(tool, detectedModels) {
  const config = getToolModelConfig(tool);
  const detectedSet = new Set(detectedModels.map((model) => normalizeModelName(model)));

  if (!config?.cards) return;

  config.cards.querySelectorAll(".tool-model-card").forEach((card) => {
    const model = normalizeModelName(card.dataset.toolModel);

    if (!detectedSet.has(model) || inferToolModelType(model) !== tool) {
      card.remove();
    }
  });

  const currentModel = normalizeModelName(config.input?.value || "");
  if (currentModel && (!detectedSet.has(currentModel) || inferToolModelType(currentModel) !== tool)) {
    setToolModel(tool, findFirstToolModel(tool) || config.defaultModel);
  }
}

function ensureToolModelCard(tool, model) {
  const config = getToolModelConfig(tool);
  model = normalizeModelName(model);

  if (!config?.cards || !model) return;

  const existingCard = Array.from(
    config.cards.querySelectorAll(".tool-model-card")
  ).find((card) => normalizeModelName(card.dataset.toolModel) === model);

  if (isToolModelHidden(tool, model)) return;

  if (existingCard) {
    bindToolModelCards(config.cards);
    return;
  }

  const card = document.createElement("button");
  card.type = "button";
  card.className = "tool-model-card";
  card.dataset.toolModel = model;

  const title = document.createElement("strong");
  title.textContent = model;

  const tag = document.createElement("span");
  tag.textContent = config.tag;

  card.append(title, tag);
  config.cards.appendChild(card);
  bindToolModelCards(config.cards);
}

function setToolModelSyncTextHidden(tool, hidden) {
  const config = getToolModelConfig(tool);
  if (!config?.syncText) return;

  config.syncText.hidden = Boolean(hidden);
}

function setToolModelSyncStatus(tool, message, type = "info") {
  const config = getToolModelConfig(tool);
  if (!config?.syncText) return;

  config.syncText.textContent = message;
  const colorMap = {
    info: "",
    loading: "var(--primary)",
    success: "var(--success)",
    warning: "var(--warning)",
    error: "var(--danger)",
  };
  config.syncText.style.color = colorMap[type] || "";
}

function getToolDebugBox(tool) {
  if (tool === "video") return videoDebugBox;
  if (tool === "transcription") return transcriptionDebugBox;
  if (tool === "realtime") return realtimeDebugBox;
  if (tool === "tts") return ttsDebugBox;
  return null;
}

function inferToolModelType(model) {
  const value = normalizeModelName(model).toLowerCase();

  if (!value) return "";

  if (isLikelyVideoModelName(value)) return "video";
  if (isLikelyTranscriptionModelName(value)) return "transcription";
  if (isLikelyRealtimeModelName(value)) return "realtime";
  if (isLikelyTtsModelName(value)) return "tts";

  return "";
}

function isLikelyVideoModelName(value) {
  const name = String(value || "").toLowerCase();

  if (
    name.includes("t2i") ||
    name.includes("text-to-image") ||
    name.includes("image-generation") ||
    name.includes("image_generation")
  ) {
    return false;
  }

  const hasVideoMarker =
    name.includes("t2v") ||
    name.includes("i2v") ||
    name.includes("text-to-video") ||
    name.includes("image-to-video") ||
    name.includes("video");

  return (
    hasVideoMarker ||
    name.includes("sora") ||
    name.includes("veo") ||
    name.includes("kling") ||
    name.includes("hailuo") ||
    name.includes("seedance") ||
    name.includes("runway") ||
    name.includes("luma") ||
    name.includes("pika") ||
    /^wan(?:x)?[-_.]?\d.*(?:t2v|i2v)/.test(name) ||
    /(?:^|[-_.])minimax[-_.]?.*(?:video|t2v|i2v|hailuo)/.test(name)
  );
}

function isLikelyTranscriptionModelName(value) {
  return (
    value.includes("whisper") ||
    value.includes("transcrib") ||
    value.includes("transcript") ||
    value.includes("speech-to-text") ||
    value.includes("stt") ||
    value.includes("asr")
  );
}

function isLikelyRealtimeModelName(value) {
  return value.includes("realtime") || value.includes("real-time");
}

function isLikelyTtsModelName(value) {
  if (isLikelyTranscriptionModelName(value) || isLikelyRealtimeModelName(value)) {
    return false;
  }

  return (
    value.includes("tts") ||
    value.includes("text-to-speech") ||
    value.includes("speech") ||
    value.includes("voice")
  );
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

      if (HIDDEN_IMAGE_MODELS.has(model) || isImageEditOnlyModel(model)) {
        option.remove();
        return;
      }

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

    if (HIDDEN_IMAGE_MODELS.has(model) || isImageEditOnlyModel(model)) {
      card.remove();
      return;
    }

    const meta = getModelMeta(model);

    if (!card.dataset.family) {
      card.dataset.family = meta.family || "gpt";
    }

    syncModelCloseButton(card);
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

  const nextModel = findFirstModelInFamily(family) || MODEL_FAMILY_DEFAULTS[family];

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

}

function ensureModelOption(model) {
  if (!modelSelect || !model) return;

  if (HIDDEN_IMAGE_MODELS.has(normalizeModelName(model))) return;

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

async function refreshAvailableImageModels() {
  const key = getApiKeyValue();

  if (!key) {
    setStatus("请先填入个人 API Key。", "warning");
    apiKey?.focus();
    return;
  }

  const baseURL = normalizeBaseUrl(FIXED_API_BASE);
  const url = `${baseURL}/v1/models`;

  startModelRefreshIndicator();

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
      finishModelRefreshIndicator("warning", message, "未识别到可用模型。");
      return;
    }

    const activeFamily = getModelFamily(modelSelect?.value || DEFAULT_IMAGE_MODEL);
    applyModelFamilyUi(activeFamily, modelSelect?.value || DEFAULT_IMAGE_MODEL);

    const message = `已刷新 ${registered.total} 个可用绘图模型。`;
    finishModelRefreshIndicator("success", message, "模型刷新完成。");
  } catch (error) {
    console.error(error);

    const message = error.message || "刷新可用模型失败。";
    finishModelRefreshIndicator("error", message, "模型刷新失败。");

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
    model = normalizeModelName(model);

    if (HIDDEN_IMAGE_MODELS.has(model) || isImageEditOnlyModel(model)) return;

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

  if (isUnsupportedImageModelName(value)) return "";
  if (isImageEditOnlyModel(value)) return "";
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

  if (
    value.includes("qwen-image") ||
    value.includes("qianwen") ||
    value.includes("wanx") ||
    /^wan(?:x)?[-_.]?\d.*t2i/.test(value)
  ) {
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

  if (value.includes("t2i") || value.includes("text-to-image")) {
    return "gpt";
  }

  return "";
}

function isLikelyImageModelName(model) {
  const value = String(model || "").toLowerCase();

  if (isUnsupportedImageModelName(value)) return false;

  if (
    value.includes("t2v") ||
    value.includes("i2v") ||
    value.includes("text-to-video") ||
    value.includes("image-to-video")
  ) {
    return false;
  }

  return (
    isGpt5ImageCandidate(value) ||
    value.includes("image") ||
    value.includes("imagine") ||
    value.includes("dall-e") ||
    value.includes("dalle") ||
    value.includes("seedream") ||
    value.includes("seededit") ||
    value.includes("t2i") ||
    value.includes("text-to-image") ||
    /^wan(?:x)?[-_.]?\d.*t2i/.test(value)
  );
}

function isUnsupportedImageModelName(model) {
  const value = String(model || "").toLowerCase();

  return /^imagen(?:[-_.]|\d)/.test(value);
}

function isImageEditOnlyModel(model) {
  const value = normalizeModelName(model).toLowerCase();

  if (!value || IMAGE_EDIT_ENABLED) return false;

  return (
    value.includes("seededit") ||
    value.includes("-edit") ||
    value.includes("image-edit") ||
    value.includes("images-edit") ||
    value.includes("edit-plus")
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
  if (HIDDEN_IMAGE_MODELS.has(model) || isImageEditOnlyModel(model)) return;

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

    syncModelCloseButton(existingCard);
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
  syncModelCloseButton(card);
  cards.appendChild(card);
  bindModelCard(card);
}

function syncModelCloseButton(card) {
  const existingButton = card.querySelector(".model-card__close");

  if (existingButton) return;

  const button = document.createElement("span");
  button.role = "button";
  button.tabIndex = 0;
  button.className = "model-card__close";
  button.setAttribute("aria-label", "隐藏这个模型");
  button.title = "隐藏这个模型";
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

  if (!model) return;

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

  if (meta?.custom || meta?.discovered) {
    delete MODEL_META[model];
  }

  if (CUSTOM_IMAGE_MODEL_RECORDS.delete(model)) {
    saveCustomImageModels();
  }

  RESPONSES_IMAGE_MODELS.delete(model);
  CHAT_COMPLETIONS_IMAGE_MODELS.delete(model);
  GEMINI_IMAGE_MODELS.delete(model);

  const family = meta?.family || "gpt";
  const activeModel = normalizeModelName(modelSelect?.value || DEFAULT_IMAGE_MODEL);

  if (wasActive) {
    setModel(findFirstModelInFamily(family) || findFirstVisibleModel() || DEFAULT_IMAGE_MODEL);
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

function findFirstVisibleModel() {
  const card = $$(".model-card").find((item) => {
    const model = normalizeModelName(item.dataset.model);
    return model && !HIDDEN_IMAGE_MODELS.has(model);
  });

  if (card) return normalizeModelName(card.dataset.model);

  const option = Array.from(modelSelect?.options || []).find((item) => {
    const model = normalizeModelName(item.value);
    return model && !HIDDEN_IMAGE_MODELS.has(model);
  });

  return normalizeModelName(option?.value || "");
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
    const preferredGptImageRank = ["gpt-image-2-flatfee", "gpt-image-2"].indexOf(model);
    if (preferredGptImageRank >= 0) return preferredGptImageRank;

    const gpt5Rank = GPT5_IMAGE_MODEL_ORDER.indexOf(model);
    if (gpt5Rank >= 0) return 100 + gpt5Rank;

    const gptImageRank = ["gpt-image-1", "dall-e-3"].indexOf(model);
    if (gptImageRank >= 0) return 200 + gptImageRank;
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

function canUseImageEditApi(model) {
  return getApiTypeForModel(model) === "images";
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

  if (!model || HIDDEN_IMAGE_MODELS.has(model) || isImageEditOnlyModel(model) || !MODEL_META[model]) {
    const family = model ? getModelFamily(model) : "gpt";
    model = findFirstModelInFamily(family) || findFirstVisibleModel() || DEFAULT_IMAGE_MODEL;
  }

  ensureModelOption(model);

  const meta = getModelMeta(model);
  const family = meta.family || "gpt";

  applyModelFamilyUi(family, model);

  if (modelSelect) {
    modelSelect.value = model;
  }

  updateEmptyPreviewState(model);
  applyModelUiRestrictions(model);

  localStorage.setItem("xuai-model", model);

  updateApiInfo();
}

function updateEmptyPreviewState(model) {
  if (!gallery?.classList.contains("empty")) return;

  if (emptyStateBadge) {
    emptyStateBadge.textContent = "待输入";
  }

  if (emptyStateTitle) {
    emptyStateTitle.textContent = "图片结果会显示在这里";
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

  console.log("点击了图片任务按钮");

  lockProviderSettings();

  const prompt = promptInput?.value.trim() || "";
  const model = normalizeModelName(modelSelect?.value || DEFAULT_IMAGE_MODEL);
  const imageMode = getCurrentImageMode();
  const isEditMode = imageMode === "edit";

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
  const key = getApiKeyValue();

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

  if (isEditMode && !editImageInput?.files?.length) {
    setStatus("编辑模式请先上传需要编辑的图片。", "warning");
    editImageInput?.focus();
    return;
  }

  if (isEditMode && !canUseImageEditApi(model)) {
    setStatus("编辑模式请选择 Images API 类型的绘图或编辑模型。", "warning");
    return;
  }

  if (generateBtn) {
    generateBtn.disabled = true;
    generateBtn.textContent = isEditMode ? "编辑中..." : "生成中...";
  }

  if (debugBox) {
    debugBox.classList.remove("show");
    debugBox.textContent = "";
  }

  startGenerationIndicator(model);

  console.log("准备发送的生成参数：", {
    mode: imageMode,
    model,
    size,
    quality,
    background,
    format,
    count,
  });

  try {
    setStatus("正在调用 XuAI API 中转站...", "loading");

    const result = isEditMode
      ? await callImageEditApi({
          baseURL,
          key,
          model,
          prompt,
          imageFiles: Array.from(editImageInput.files || []),
          maskFile: editMaskInput?.files?.[0] || null,
          size,
          format,
          count,
        })
      : await callImageGenerationApi({
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
      mode: imageMode,
      isDemo: false,
    });

    showDebug(result.raw);
    addHistoryEntry({
      type: isEditMode ? "图片编辑" : "图片生成",
      model,
      mode: isEditMode ? "编辑" : "生成",
      size,
      prompt,
      resultCount: result.images.length,
      preview: result.images[0],
    });

    finishGenerationIndicator(
      "success",
      `${isEditMode ? "图片编辑" : "图片生成"}已完成，结果已显示在下方。`
    );

    setStatus(isEditMode ? "图片编辑完成。" : "图片生成完成。", "success");
  } catch (error) {
    console.error(error);

    finishGenerationIndicator(
      "error",
      error.message || "生成失败，请查看控制台或下方调试信息。"
    );

    setStatus(isEditMode ? "图片编辑失败，请查看下方提示和调试信息。" : "图片生成失败，请查看下方提示和调试信息。", "error");

    showDebug(
      error.raw || {
        error: error.message,
        model,
        request_url: isEditMode ? `${baseURL}/v1/images/edits` : getEndpointForModel(model),
        tip: "如果是 504 Gateway Timeout，通常表示中转站请求上游模型超时；如果是 CORS，则需要在中转站配置跨域。",
      }
    );
  } finally {
    if (generateBtn) {
      generateBtn.disabled = false;
      generateBtn.textContent = isEditMode ? "编辑图片" : "生成图片";
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

async function callImageEditApi({
  baseURL,
  key,
  model,
  prompt,
  imageFiles,
  maskFile,
  size,
  format,
  count,
}) {
  const url = `${baseURL}/v1/images/edits`;
  const formData = new FormData();

  formData.append("model", model);
  formData.append("prompt", prompt);
  formData.append("n", String(count || 1));

  if (size && size !== "auto") formData.append("size", size);
  if (format && format !== "png") formData.append("output_format", format);

  imageFiles.forEach((file) => {
    formData.append("image", file, file.name);
  });

  if (maskFile) {
    formData.append("mask", maskFile, maskFile.name);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
    },
    body: formData,
  });

  const raw = await safeJson(response);

  if (!response.ok) {
    const error = new Error(buildApiErrorMessage(raw, response, "Images Edit API"));
    error.raw = {
      request_url: url,
      request_payload: {
        model,
        prompt,
        n: count || 1,
        size,
        output_format: format,
        image_files: imageFiles.map((file) => ({
          name: file.name,
          type: file.type,
          size: file.size,
        })),
        mask_file: maskFile
          ? {
              name: maskFile.name,
              type: maskFile.type,
              size: maskFile.size,
            }
          : null,
      },
      response: raw,
    };
    throw error;
  }

  const images = extractImagesFromAnyResponse(raw);

  if (!images.length) {
    const error = new Error("图片编辑接口返回成功，但没有找到可显示的图片数据。");
    error.raw = {
      request_url: url,
      response: raw,
      tip: "请检查返回结构里是否包含 url、b64_json、image_base64 或 base64 字段。",
    };
    throw error;
  }

  return {
    images,
    raw: {
      request_url: url,
      request_payload: {
        model,
        prompt,
        n: count || 1,
        image_files: imageFiles.map((file) => file.name),
        mask_file: maskFile?.name || null,
      },
      response: raw,
      extracted_images_count: images.length,
    },
  };
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
        pushBase64Image(value.b64_json, localContext.output_format, true);
      }

      if (value.image_base64) {
        pushBase64Image(value.image_base64, localContext.output_format, true);
      }

      if (value.base64) {
        pushBase64Image(value.base64, localContext.output_format, true);
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
  setTaskStatusBadge("image", type);

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

async function handleVideoGenerate(event) {
  event.preventDefault();
  lockProviderSettings();

  const key = getApiKeyValue();
  const baseURL = normalizeBaseUrl(FIXED_API_BASE);
  const model = videoModelInput?.value.trim() || "";
  const prompt = videoPromptInput?.value.trim() || "";
  const size = videoSizeSelect?.value || "1280x720";
  const seconds = Number(videoSecondsInput?.value || 5);

  if (!key) {
    setToolStatus(videoStatusText, "请先填入个人 API Key。", "warning");
    apiKey?.focus();
    return;
  }

  if (!prompt) {
    setToolStatus(videoStatusText, "请先输入视频 Prompt。", "warning");
    videoPromptInput?.focus();
    return;
  }

  if (!model) {
    setToolStatus(videoStatusText, "请先刷新并选择可用视频模型。", "warning");
    videoModelSyncText?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  if (videoGenerateBtn) {
    videoGenerateBtn.disabled = true;
    videoGenerateBtn.textContent = "生成中...";
  }

  try {
    setToolStatus(videoStatusText, "正在提交视频生成任务...", "loading");
    startToolTaskIndicator(
      "video",
      "正在生成视频，请不要刷新页面或关闭当前标签页。",
      "视频任务已经提交，正在等待接口返回结果。"
    );
    const result = await callVideoGenerationApi({
      baseURL,
      key,
      model,
      prompt,
      size,
      seconds,
    });

    renderVideos(result.videos, { model, prompt });
    showToolDebug(videoDebugBox, result.raw);
    addHistoryEntry({
      type: "视频生成",
      model,
      size,
      mode: `${seconds} 秒`,
      prompt,
      resultCount: result.videos.length,
      preview: result.videos[0],
    });
    setToolStatus(videoStatusText, "视频生成完成。", "success");
    finishToolTaskIndicator("video", "success", "视频生成完成，结果已显示在下方。");
  } catch (error) {
    console.error(error);
    setToolStatus(videoStatusText, error.message || "视频生成失败。", "error");
    finishToolTaskIndicator("video", "error", error.message || "视频生成失败，请查看调试信息。");
    showToolDebug(videoDebugBox, error.raw || { error: error.message });
  } finally {
    if (videoGenerateBtn) {
      videoGenerateBtn.disabled = false;
      videoGenerateBtn.textContent = "生成视频";
    }
  }
}

async function callVideoGenerationApi({ baseURL, key, model, prompt, size, seconds }) {
  const url = `${baseURL}/v1/videos/generations`;
  const payload = {
    model,
    prompt,
    size,
    seconds,
  };

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
    const error = new Error(buildApiErrorMessage(raw, response, "Video API"));
    error.raw = {
      request_url: url,
      request_payload: payload,
      response: raw,
    };
    throw error;
  }

  const waitResult = await waitForVideoResult({
    baseURL,
    key,
    initialRaw: raw,
    requestPayload: payload,
  });

  raw = waitResult.raw;
  const videos = extractVideosFromAnyResponse(raw);

  if (!videos.length) {
    const error = new Error("视频接口返回成功，但没有找到可播放的视频 URL 或 base64 数据。");
    error.raw = {
      request_url: url,
      request_payload: payload,
      response: raw,
      poll_attempts: waitResult.pollAttempts,
    };
    throw error;
  }

  return {
    videos,
    raw: {
      request_url: url,
      request_payload: payload,
      response: raw,
      poll_attempts: waitResult.pollAttempts,
      extracted_videos_count: videos.length,
    },
  };
}

async function waitForVideoResult({ baseURL, key, initialRaw, requestPayload }) {
  let raw = initialRaw;
  let pollAttempts = 0;

  for (let attempt = 0; attempt <= RESPONSES_MAX_POLL_ATTEMPTS; attempt++) {
    if (extractVideosFromAnyResponse(raw).length || !isPendingTask(raw)) {
      return { raw, pollAttempts };
    }

    const taskId = raw?.id || raw?.task_id || raw?.video_id;
    if (!taskId || attempt === RESPONSES_MAX_POLL_ATTEMPTS) {
      return { raw, pollAttempts };
    }

    pollAttempts += 1;
    setToolStatus(
      videoStatusText,
      `视频仍在生成，正在轮询结果 ${pollAttempts}/${RESPONSES_MAX_POLL_ATTEMPTS}...`,
      "loading"
    );

    await delay(RESPONSES_POLL_INTERVAL_MS);

    const retrieveUrl = `${baseURL}/v1/videos/${encodeURIComponent(taskId)}`;
    const response = await fetch(retrieveUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
      },
    });
    const nextRaw = await safeJson(response);

    if (!response.ok) {
      const error = new Error(buildApiErrorMessage(nextRaw, response, "Video API 轮询"));
      error.raw = {
        request_url: `${baseURL}/v1/videos/generations`,
        request_payload: requestPayload,
        retrieve_url: retrieveUrl,
        initial_response: initialRaw,
        retrieve_response: nextRaw,
      };
      throw error;
    }

    raw = nextRaw;
  }

  return { raw, pollAttempts };
}

async function handleTranscription(event) {
  event.preventDefault();
  lockProviderSettings();

  const key = getApiKeyValue();
  const baseURL = normalizeBaseUrl(FIXED_API_BASE);
  const model = transcriptionModelInput?.value.trim() || "whisper-1";
  const file = audioFileInput?.files?.[0] || null;
  const prompt = transcriptionPromptInput?.value.trim() || "";

  if (!key) {
    setToolStatus(transcriptionStatusText, "请先填入个人 API Key。", "warning");
    apiKey?.focus();
    return;
  }

  if (!file) {
    setToolStatus(transcriptionStatusText, "请先上传音频或视频文件。", "warning");
    audioFileInput?.focus();
    return;
  }

  if (transcriptionBtn) {
    transcriptionBtn.disabled = true;
    transcriptionBtn.textContent = "转写中...";
  }

  try {
    setToolStatus(transcriptionStatusText, "正在上传并转写音频...", "loading");
    startToolTaskIndicator(
      "transcription",
      "正在转写音频，请不要刷新页面或关闭当前标签页。",
      "音频文件正在上传并交给模型转写，较长文件可能需要更多时间。"
    );
    const result = await callTranscriptionApi({
      baseURL,
      key,
      model,
      file,
      prompt,
    });

    renderTextResult(transcriptionResult, result.text || "接口没有返回文本。");
    showToolDebug(transcriptionDebugBox, result.raw);
    addHistoryEntry({
      type: "音频转文字",
      model,
      prompt: file.name,
      text: result.text,
    });
    setToolStatus(transcriptionStatusText, "音频转写完成。", "success");
    finishToolTaskIndicator("transcription", "success", "音频转写完成，文本已显示在下方。");
  } catch (error) {
    console.error(error);
    setToolStatus(transcriptionStatusText, error.message || "音频转写失败。", "error");
    finishToolTaskIndicator("transcription", "error", error.message || "音频转写失败，请查看调试信息。");
    showToolDebug(transcriptionDebugBox, error.raw || { error: error.message });
  } finally {
    if (transcriptionBtn) {
      transcriptionBtn.disabled = false;
      transcriptionBtn.textContent = "开始转写";
    }
  }
}

async function callTranscriptionApi({ baseURL, key, model, file, prompt }) {
  const url = `${baseURL}/v1/audio/transcriptions`;
  const formData = new FormData();

  formData.append("model", model);
  formData.append("file", file, file.name);
  formData.append("response_format", "json");
  if (prompt) formData.append("prompt", prompt);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
    },
    body: formData,
  });

  const raw = await safeJson(response);

  if (!response.ok) {
    const error = new Error(buildApiErrorMessage(raw, response, "Audio Transcription API"));
    error.raw = {
      request_url: url,
      request_payload: {
        model,
        file: {
          name: file.name,
          type: file.type,
          size: file.size,
        },
        prompt,
      },
      response: raw,
    };
    throw error;
  }

  return {
    text: extractTextFromAnyResponse(raw) || raw?.text || raw?.raw || "",
    raw: {
      request_url: url,
      request_payload: {
        model,
        file: file.name,
        prompt,
      },
      response: raw,
    },
  };
}

async function handleTextToSpeech(event) {
  event.preventDefault();
  lockProviderSettings();

  const key = getApiKeyValue();
  const baseURL = normalizeBaseUrl(FIXED_API_BASE);
  const model = ttsModelInput?.value.trim() || "tts-1";
  const voice = ttsVoiceInput?.value.trim() || "alloy";
  const input = ttsTextInput?.value.trim() || "";

  if (!key) {
    setToolStatus(ttsStatusText, "请先填入个人 API Key。", "warning");
    apiKey?.focus();
    return;
  }

  if (!input) {
    setToolStatus(ttsStatusText, "请先输入需要合成的文本。", "warning");
    ttsTextInput?.focus();
    return;
  }

  if (ttsBtn) {
    ttsBtn.disabled = true;
    ttsBtn.textContent = "生成中...";
  }

  try {
    setToolStatus(ttsStatusText, "正在生成语音...", "loading");
    startToolTaskIndicator(
      "tts",
      "正在生成语音，请不要刷新页面或关闭当前标签页。",
      "文本已经提交，正在等待语音合成结果。"
    );
    const result = await callTextToSpeechApi({
      baseURL,
      key,
      model,
      voice,
      input,
    });

    renderAudioResult(ttsResult, result.audioUrl, result.filename);
    showToolDebug(ttsDebugBox, result.raw);
    addHistoryEntry({
      type: "文字转语音",
      model,
      mode: voice,
      prompt: input,
      preview: result.audioUrl,
    });
    setToolStatus(ttsStatusText, "语音生成完成。", "success");
    finishToolTaskIndicator("tts", "success", "语音生成完成，播放器已显示在下方。");
  } catch (error) {
    console.error(error);
    setToolStatus(ttsStatusText, error.message || "语音生成失败。", "error");
    finishToolTaskIndicator("tts", "error", error.message || "语音生成失败，请查看调试信息。");
    showToolDebug(ttsDebugBox, error.raw || { error: error.message });
  } finally {
    if (ttsBtn) {
      ttsBtn.disabled = false;
      ttsBtn.textContent = "生成语音";
    }
  }
}

async function callTextToSpeechApi({ baseURL, key, model, voice, input }) {
  const url = `${baseURL}/v1/audio/speech`;
  const payload = {
    model,
    voice,
    input,
    response_format: "mp3",
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(payload),
  });

  const contentType = response.headers.get("content-type") || "";

  if (!response.ok) {
    const raw = contentType.includes("application/json")
      ? await safeJson(response)
      : { raw: await response.text() };
    const error = new Error(buildApiErrorMessage(raw, response, "Audio Speech API"));
    error.raw = {
      request_url: url,
      request_payload: payload,
      response: raw,
    };
    throw error;
  }

  const blob = await response.blob();
  const audioUrl = URL.createObjectURL(blob);

  return {
    audioUrl,
    filename: `xuai-tts-${Date.now()}.mp3`,
    raw: {
      request_url: url,
      request_payload: payload,
      response: {
        content_type: contentType,
        size: blob.size,
      },
    },
  };
}

async function startRealtimeVoice() {
  lockProviderSettings();

  const key = getApiKeyValue();
  const baseURL = normalizeBaseUrl(FIXED_API_BASE);
  const model = realtimeModelInput?.value.trim() || "gpt-realtime";
  const instructions = realtimeInstructionsInput?.value.trim() || "";

  if (!key) {
    setToolStatus(realtimeStatusText, "请先填入个人 API Key。", "warning");
    apiKey?.focus();
    return;
  }

  stopRealtimeVoice();

  try {
    setToolStatus(realtimeStatusText, "正在请求麦克风权限...", "loading");
    startToolTaskIndicator(
      "realtime",
      "正在连接实时语音，请不要刷新页面或关闭当前标签页。",
      "浏览器正在请求麦克风权限并建立实时语音连接。"
    );
    realtimeLocalStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    realtimePeerConnection = new RTCPeerConnection();

    realtimePeerConnection.ontrack = (event) => {
      if (realtimeAudio) {
        realtimeAudio.srcObject = event.streams[0];
      }
    };

    realtimeLocalStream.getTracks().forEach((track) => {
      realtimePeerConnection.addTrack(track, realtimeLocalStream);
    });

    realtimeDataChannel = realtimePeerConnection.createDataChannel("oai-events");
    realtimeDataChannel.onmessage = (event) => appendRealtimeLog(event.data);
    realtimeDataChannel.onopen = () => {
      appendRealtimeLog("数据通道已连接。");
      if (instructions) {
        realtimeDataChannel.send(
          JSON.stringify({
            type: "session.update",
            session: {
              instructions,
            },
          })
        );
      }
    };

    const offer = await realtimePeerConnection.createOffer();
    await realtimePeerConnection.setLocalDescription(offer);

    setToolStatus(realtimeStatusText, "正在连接实时语音模型...", "loading");
    const url = `${baseURL}/v1/realtime?model=${encodeURIComponent(model)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/sdp",
        "OpenAI-Beta": "realtime=v1",
      },
      body: offer.sdp,
    });

    const answerSdp = await response.text();

    if (!response.ok) {
      const raw = parseMaybeJson(answerSdp);
      const error = new Error(
        buildApiErrorMessage(raw, response, "Realtime API")
      );
      error.raw = {
        request_url: url,
        response: raw,
      };
      throw error;
    }

    await realtimePeerConnection.setRemoteDescription({
      type: "answer",
      sdp: answerSdp,
    });

    if (realtimeStartBtn) realtimeStartBtn.disabled = true;
    if (realtimeStopBtn) realtimeStopBtn.disabled = false;

    setToolStatus(realtimeStatusText, "实时语音已连接。", "success");
    finishToolTaskIndicator("realtime", "success", "实时语音已连接，可以开始对话。");
    showToolDebug(realtimeDebugBox, {
      request_url: url,
      model,
      instructions,
      note: "浏览器通过 WebRTC 连接实时语音模型。",
    });
  } catch (error) {
    console.error(error);
    stopRealtimeVoice();
    setToolStatus(realtimeStatusText, error.message || "实时语音连接失败。", "error");
    finishToolTaskIndicator("realtime", "error", error.message || "实时语音连接失败，请查看调试信息。");
    showToolDebug(realtimeDebugBox, error.raw || { error: error.message });
  }
}

function stopRealtimeVoice() {
  if (realtimeDataChannel) {
    realtimeDataChannel.close();
    realtimeDataChannel = null;
  }

  if (realtimePeerConnection) {
    realtimePeerConnection.close();
    realtimePeerConnection = null;
  }

  if (realtimeLocalStream) {
    realtimeLocalStream.getTracks().forEach((track) => track.stop());
    realtimeLocalStream = null;
  }

  if (realtimeAudio) {
    realtimeAudio.srcObject = null;
  }

  if (realtimeStartBtn) realtimeStartBtn.disabled = false;
  if (realtimeStopBtn) realtimeStopBtn.disabled = true;

  if (realtimeStatusText) {
    setToolStatus(realtimeStatusText, "实时语音已停止。", "info");
  }
}

function renderVideos(videos, meta) {
  if (!videoGallery) return;

  videoGallery.classList.remove("empty");
  videoGallery.innerHTML = `
    <div class="result-grid">
      ${videos
        .map((src, index) => {
          const filename = `xuai-${meta.model}-${index + 1}.mp4`;
          return `
            <article class="result-card result-card--video">
              <video src="${src}" controls playsinline></video>
              <footer>
                <small>Video #${index + 1}</small>
                <a href="${src}" download="${filename}" target="_blank" rel="noreferrer">下载</a>
              </footer>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderTextResult(container, text) {
  if (!container) return;
  container.classList.remove("empty-text");
  container.textContent = text;
}

function renderAudioResult(container, audioUrl, filename) {
  if (!container) return;
  container.classList.remove("empty-text");
  container.innerHTML = `
    <audio controls src="${audioUrl}"></audio>
    <a class="download-link" href="${audioUrl}" download="${filename}">下载音频</a>
  `;
}

function appendRealtimeLog(message) {
  if (!realtimeLog) return;

  realtimeLog.classList.remove("empty-text");
  const text =
    typeof message === "string" ? message : JSON.stringify(message, null, 2);
  realtimeLog.textContent = `${realtimeLog.textContent || ""}\n${text}`.trim();
}

function extractVideosFromAnyResponse(raw) {
  const videos = [];
  const visited = new WeakSet();

  const pushVideo = (value, mimeType = "video/mp4") => {
    if (!value) return;
    const text = String(value).trim();

    if (text.startsWith("http://") || text.startsWith("https://")) {
      if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(text) || text.includes("video")) {
        videos.push(text);
      }
      return;
    }

    if (text.startsWith("data:video/")) {
      videos.push(text);
      return;
    }

    if (text.length > 100 && /^[A-Za-z0-9+/=_-]+$/.test(text)) {
      videos.push(`data:${mimeType};base64,${text}`);
    }
  };

  const walk = (value) => {
    if (!value) return;

    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }

    if (typeof value === "string") {
      pushVideo(value);
      return;
    }

    if (typeof value === "object") {
      if (visited.has(value)) return;
      visited.add(value);

      const mimeType = value.mime_type || value.mimeType || "video/mp4";

      if (value.url) pushVideo(value.url, mimeType);
      if (value.video_url) pushVideo(value.video_url, mimeType);
      if (value.output_url) pushVideo(value.output_url, mimeType);
      if (value.b64_json) pushVideo(value.b64_json, mimeType);
      if (value.video_base64) pushVideo(value.video_base64, mimeType);
      if (value.base64 && String(mimeType).startsWith("video/")) {
        pushVideo(value.base64, mimeType);
      }

      Object.values(value).forEach(walk);
    }
  };

  walk(raw);
  return uniqueArray(videos);
}

function isPendingTask(raw) {
  const status = String(raw?.status || raw?.state || "").toLowerCase();
  return ["queued", "pending", "in_progress", "processing", "generating"].includes(
    status
  );
}

function setToolStatus(element, message, type = "info") {
  if (!element) return;

  element.textContent = message;
  setTaskStatusBadge(getToolByStatusElement(element), type);
  const colorMap = {
    info: "",
    loading: "var(--primary)",
    success: "var(--success)",
    warning: "var(--warning)",
    error: "var(--danger)",
  };
  element.style.color = colorMap[type] || "";
}

function initTaskStatusUi() {
  taskStatusBadges.image = modelBadge;
  taskStatusBadges.video = videoModelBadge;
  taskStatusBadges.transcription = transcriptionStatusBadge;
  taskStatusBadges.realtime = realtimeStatusBadge;
  taskStatusBadges.tts = ttsStatusBadge;

  Object.keys(taskStatusBadges).forEach((tool) => {
    setTaskStatusBadge(tool, "info");
  });

  ["video", "transcription", "realtime", "tts"].forEach(ensureToolTaskIndicator);
}

function getToolByStatusElement(element) {
  if (element === videoStatusText) return "video";
  if (element === transcriptionStatusText) return "transcription";
  if (element === realtimeStatusText) return "realtime";
  if (element === ttsStatusText) return "tts";
  return "";
}

function setTaskStatusBadge(tool, type = "info") {
  const badge = taskStatusBadges[tool];
  if (!badge) return;

  const labelMap = {
    info: "待配置",
    loading: "处理中",
    success: "完成",
    warning: "待配置",
    error: "失败",
  };

  badge.textContent = labelMap[type] || "空闲";
  badge.dataset.status = type;
}

function ensureToolTaskIndicator(tool) {
  if (taskIndicators[tool]) return taskIndicators[tool];

  const statusElement = getToolModelConfig(tool)?.statusText;
  const previewPanel = statusElement?.closest(".preview-panel");
  const previewHead = previewPanel?.querySelector(".preview-head");
  if (!previewPanel || !previewHead) return null;

  const notice = document.createElement("div");
  notice.className = "generation-notice task-notice";
  notice.hidden = true;
  notice.setAttribute("aria-live", "polite");
  notice.innerHTML = `
    <div class="generation-notice__icon-wrap">
      <span class="generation-notice__icon" data-task-notice-icon>!</span>
    </div>
    <div class="generation-notice__content">
      <div class="generation-notice__top">
        <strong data-task-notice-title>任务处理中</strong>
      </div>
      <p data-task-notice-desc>任务已经提交，正在等待结果。</p>
      <div class="generation-notice__meta">
        <span data-task-notice-status>当前状态：处理中</span>
        <span data-task-notice-timer>已用时 00:00</span>
      </div>
      <div class="generation-notice__progress">
        <i></i>
      </div>
    </div>
  `;

  previewHead.insertAdjacentElement("afterend", notice);

  taskIndicators[tool] = {
    notice,
    icon: notice.querySelector("[data-task-notice-icon]"),
    title: notice.querySelector("[data-task-notice-title]"),
    desc: notice.querySelector("[data-task-notice-desc]"),
    status: notice.querySelector("[data-task-notice-status]"),
    timer: notice.querySelector("[data-task-notice-timer]"),
    startedAt: 0,
    timerId: null,
  };

  return taskIndicators[tool];
}

function startToolTaskIndicator(tool, title, desc) {
  const indicator = ensureToolTaskIndicator(tool);
  if (!indicator) return;

  if (indicator.timerId) {
    clearInterval(indicator.timerId);
    indicator.timerId = null;
  }

  indicator.startedAt = Date.now();
  indicator.notice.hidden = false;
  indicator.notice.classList.remove(
    "success",
    "warning",
    "error",
    "is-success",
    "is-warning",
    "is-error"
  );
  indicator.notice.classList.add("loading", "is-loading");
  indicator.icon.textContent = "!";
  indicator.title.textContent = title;
  indicator.desc.textContent = desc;
  indicator.status.textContent = "当前状态：处理中";
  setTaskStatusBadge(tool, "loading");
  updateToolTaskTimer(tool);
  indicator.timerId = setInterval(() => updateToolTaskTimer(tool), 50);
}

function finishToolTaskIndicator(tool, type = "success", message = "", title = "") {
  const indicator = ensureToolTaskIndicator(tool);
  if (!indicator) return;

  if (indicator.timerId) {
    clearInterval(indicator.timerId);
    indicator.timerId = null;
  }

  const isError = type === "error";
  const isWarning = type === "warning";
  const elapsed = indicator.startedAt ? Date.now() - indicator.startedAt : 0;

  indicator.notice.hidden = false;
  indicator.notice.classList.remove(
    "loading",
    "success",
    "warning",
    "error",
    "is-loading",
    "is-success",
    "is-warning",
    "is-error"
  );
  indicator.notice.classList.add(isError ? "error" : isWarning ? "warning" : "success");
  indicator.notice.classList.add(isError ? "is-error" : isWarning ? "is-warning" : "is-success");
  indicator.icon.textContent = isError || isWarning ? "!" : "✓";
  indicator.title.textContent = title || (isError ? "任务处理失败。" : "任务处理完成。");
  indicator.desc.textContent = message || (isError ? "处理过程中发生错误，请查看调试信息。" : "结果已经显示在下方。");
  indicator.status.textContent = `当前状态：${isError ? "失败" : isWarning ? "待配置" : "完成"}`;
  indicator.timer.textContent = `总用时 ${formatElapsedTime(elapsed)}`;
  setTaskStatusBadge(tool, isError ? "error" : isWarning ? "warning" : "success");
}

function updateToolTaskTimer(tool) {
  const indicator = taskIndicators[tool];
  if (!indicator?.timer || !indicator.startedAt) return;

  const elapsed = Date.now() - indicator.startedAt;
  indicator.timer.textContent = `已用时 ${formatElapsedTime(elapsed)}`;
}

function showToolDebug(element, data) {
  if (!element) return;

  const redacted = redactLargeImageData(data);
  element.textContent =
    typeof redacted === "string" ? redacted : JSON.stringify(redacted, null, 2);
  element.classList.add("show");
}

function parseMaybeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function getHistoryEntries() {
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function loadHiddenToolModels() {
  try {
    const value = JSON.parse(
      localStorage.getItem(HIDDEN_TOOL_MODEL_STORAGE_KEY) || "{}"
    );
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function saveHiddenToolModels() {
  localStorage.setItem(
    HIDDEN_TOOL_MODEL_STORAGE_KEY,
    JSON.stringify(HIDDEN_TOOL_MODELS)
  );
}

function saveHistoryEntries(entries) {
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries.slice(0, 80)));
}

function addHistoryEntry(entry) {
  const entries = getHistoryEntries();
  const safePreview =
    typeof entry.preview === "string" && /^https?:\/\//.test(entry.preview)
      ? entry.preview
      : "";
  const category = getHistoryCategory(entry);

  entries.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    status: "已完成",
    category,
    ...entry,
    preview: safePreview,
  });
  saveHistoryEntries(entries);
  renderHistory();
}

function renderHistory() {
  if (!historyList) return;

  const entries = getHistoryEntries();
  const counts = getHistoryCounts(entries);
  const filteredEntries =
    historyFilter === "all"
      ? entries
      : entries.filter((item) => getHistoryCategory(item) === historyFilter);

  updateHistoryFilters(counts);

  if (historyStatusText) {
    historyStatusText.textContent = entries.length
      ? `查看和管理生成历史`
      : "暂无历史记录。";
  }

  if (!filteredEntries.length) {
    historyList.innerHTML = `<div class="empty-text">暂无历史记录。</div>`;
    return;
  }

  historyList.innerHTML = filteredEntries
    .map((item) => {
      const time = new Date(item.createdAt).toLocaleString();
      const category = getHistoryCategory(item);
      const categoryLabel = getHistoryCategoryLabel(category);
      const preview = item.preview
        ? `<a href="${item.preview}" target="_blank" rel="noreferrer">打开结果</a>`
        : "";
      const text = item.text ? `<p>${escapeHtml(item.text).slice(0, 500)}</p>` : "";
      const details = [
        item.model || "",
        item.mode || "",
        item.size || "",
        item.resultCount ? `${item.resultCount} 个结果` : "",
      ]
        .filter(Boolean)
        .join(" ｜ ");

      return `
        <article class="history-item">
          <div class="history-item__main">
            <div class="history-item__meta">
              <span class="history-chip">${categoryLabel}</span>
              <span class="history-chip history-chip--success">${escapeHtml(item.status || "已完成")}</span>
              <span class="history-chip history-chip--model">${escapeHtml(item.model || "-")}</span>
              <time>${time}</time>
            </div>
            <strong>${escapeHtml(item.prompt || item.type || "任务")}</strong>
            <p>${escapeHtml(details)}</p>
            ${text}
            ${preview}
          </div>
          <div class="history-item__actions">
            <button type="button" class="secondary-btn" data-history-reload="${item.id}">重新加载参数</button>
            <button type="button" class="history-danger-btn" data-history-delete="${item.id}">删除</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function getHistoryCategory(entry) {
  const type = String(entry?.type || "").toLowerCase();

  if (type.includes("视频")) return "video";
  if (type.includes("音频") || type.includes("语音") || type.includes("转写")) return "audio";
  if (type.includes("图片") || type.includes("图")) return "image";

  return entry?.category || "image";
}

function getHistoryCategoryLabel(category) {
  if (category === "video") return "视频";
  if (category === "audio") return "音频";
  if (category === "image") return "图片";
  return "任务";
}

function getHistoryCounts(entries) {
  return entries.reduce(
    (counts, item) => {
      const category = getHistoryCategory(item);
      counts.all += 1;
      counts[category] = (counts[category] || 0) + 1;
      return counts;
    },
    { all: 0, video: 0, image: 0, audio: 0 }
  );
}

function updateHistoryFilters(counts) {
  historyFilters?.querySelectorAll("[data-history-filter]").forEach((button) => {
    const filter = button.dataset.historyFilter || "all";
    const labelMap = {
      all: "全部",
      video: "视频",
      image: "图片",
      audio: "音频",
    };

    button.classList.toggle("active", filter === historyFilter);
    button.textContent = `${labelMap[filter] || filter} (${counts[filter] || 0})`;
  });
}

function deleteHistoryEntry(id) {
  saveHistoryEntries(getHistoryEntries().filter((item) => item.id !== id));
  renderHistory();
}

function reloadHistoryEntry(id) {
  const item = getHistoryEntries().find((entry) => entry.id === id);
  if (!item) return;

  const category = getHistoryCategory(item);

  if (category === "image") {
    switchTool("image");
    setModel(item.model || DEFAULT_IMAGE_MODEL);
    if (promptInput) promptInput.value = item.prompt || "";
    return;
  }

  if (category === "video") {
    switchTool("video");
    if (item.model) {
      ensureToolModelCard("video", item.model);
      setToolModel("video", item.model);
    }
    if (videoPromptInput) videoPromptInput.value = item.prompt || "";
    return;
  }

  if (category === "audio") {
    if (String(item.type || "").includes("转写")) {
      switchTool("transcription");
      ensureToolModelCard("transcription", item.model || "whisper-1");
      setToolModel("transcription", item.model || "whisper-1");
    } else {
      switchTool("tts");
      ensureToolModelCard("tts", item.model || "tts-1");
      setToolModel("tts", item.model || "tts-1");
      if (ttsTextInput) ttsTextInput.value = item.prompt || "";
    }
  }
}

function clearHistory() {
  localStorage.removeItem(HISTORY_STORAGE_KEY);
  renderHistory();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function handleBeforeUnload(event) {
  if (!isGeneratingImage && !realtimePeerConnection) return;

  event.preventDefault();
  event.returnValue = "";
}

function startModelRefreshIndicator() {
  generationStartTime = Date.now();
  setTaskStatusBadge("image", "loading");

  if (generationTimerId) {
    clearInterval(generationTimerId);
    generationTimerId = null;
  }

  if (generationNotice) {
    generationNotice.hidden = false;
    generationNotice.classList.remove(
      "success",
      "warning",
      "error",
      "is-success",
      "is-warning",
      "is-error"
    );
    generationNotice.classList.add("loading", "is-loading");
  }

  if (generationNoticeIcon) {
    generationNoticeIcon.textContent = "!";
  }

  if (generationNoticeTitle) {
    generationNoticeTitle.textContent = "正在刷新可用绘图模型...";
  }

  if (generationNoticeDesc) {
    generationNoticeDesc.textContent =
      "正在读取当前 API Key 的模型列表，刷新结果会自动更新到左侧模型区。";
  }

  if (generationModelName) {
    generationModelName.textContent = "当前状态：刷新中";
  }

  updateGenerationTimer();
  generationTimerId = setInterval(updateGenerationTimer, 50);
}

function finishModelRefreshIndicator(type = "success", message = "", title = "") {
  const elapsed = generationStartTime ? Date.now() - generationStartTime : 0;

  if (generationTimerId) {
    clearInterval(generationTimerId);
    generationTimerId = null;
  }

  if (!generationNotice) return;

  generationNotice.hidden = false;
  generationNotice.classList.remove(
    "loading",
    "success",
    "warning",
    "error",
    "is-loading",
    "is-success",
    "is-warning",
    "is-error"
  );

  const isError = type === "error";
  const isWarning = type === "warning";

  generationNotice.classList.add(isError ? "error" : isWarning ? "warning" : "success");
  generationNotice.classList.add(isError ? "is-error" : isWarning ? "is-warning" : "is-success");
  setTaskStatusBadge("image", isError ? "error" : isWarning ? "warning" : "success");

  if (generationNoticeIcon) {
    generationNoticeIcon.textContent = isError || isWarning ? "!" : "✓";
  }

  if (generationNoticeTitle) {
    generationNoticeTitle.textContent =
      title || (isError ? "模型刷新失败。" : isWarning ? "未识别到可用模型。" : "模型刷新完成。");
  }

  if (generationNoticeDesc) {
    generationNoticeDesc.textContent =
      message || (isError ? "刷新过程中发生错误，请查看调试信息。" : "模型列表已经更新。");
  }

  if (generationModelName) {
    generationModelName.textContent = `当前状态：${isError ? "失败" : isWarning ? "待配置" : "完成"}`;
  }

  if (generationTimer) {
    generationTimer.textContent = `总用时 ${formatElapsedTime(elapsed)}`;
  }
}

function startGenerationIndicator(model) {
  isGeneratingImage = true;
  generationStartTime = Date.now();
  setTaskStatusBadge("image", "loading");

  if (generationTimerId) {
    clearInterval(generationTimerId);
    generationTimerId = null;
  }

  if (generationNotice) {
    generationNotice.hidden = false;
    generationNotice.classList.remove(
      "success",
      "warning",
      "error",
      "is-success",
      "is-warning",
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
    generationModelName.textContent = "当前状态：处理中";
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
    "warning",
    "error",
    "is-loading",
    "is-success",
    "is-warning",
    "is-error"
  );

  const isError = type === "error";
  setTaskStatusBadge("image", isError ? "error" : "success");

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

  if (generationModelName) {
    generationModelName.textContent = `当前状态：${isError ? "失败" : "完成"}`;
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
