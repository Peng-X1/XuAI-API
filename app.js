const FIXED_PROVIDER_ID = "xuai";
const FIXED_PROVIDER_NAME = "XuAI API 中转站";
const FIXED_API_BASE = "https://api.xuai.chat";

const DEFAULT_IMAGE_MODEL = "gpt-image-2";
const GPT54_MODEL = "gpt-5.4";

const RESPONSES_IMAGE_MODELS = new Set([GPT54_MODEL]);

// gpt-5.4 模型不显示/不允许这些尺寸。
// 用户之前说的 2024*2048，HTML 里实际是 2048x2048，这里按 2048x2048 处理。
const GPT54_DISABLED_SIZES = new Set([
  "1024x1024",
  "2048x2048",
  "2160x3840",
]);

// gpt-5.4 只允许 PNG。
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

// 生成中提示框相关 DOM。
// 如果 index.html 暂时没加这些节点，下面变量会是 null，不会报错，只是不显示提示框。
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
// 如果 index.html 中 option 写了 data-hide-for="gpt-5.4"，这里会读取。
// 即使 HTML 没写 data-hide-for，后面也会通过 GPT54_DISABLED_SIZES 做兜底。
const ORIGINAL_SIZE_OPTIONS = sizeSelect
  ? Array.from(sizeSelect.options).map((option) => ({
      value: option.value,
      text: option.textContent,
      disabled: option.disabled,
      hideFor: parseModelList(option.dataset.hideFor),
    }))
  : [];

// 缓存原始输出格式选项，用于模型切换时恢复。
// 如果 index.html 中 label.radio 写了 data-hide-for="gpt-5.4"，这里会读取。
// 即使 HTML 没写 data-hide-for，后面也会通过 GPT54_ALLOWED_FORMATS 做兜底。
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

  applyModelUiRestrictions(model);

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
  return normalizeModelName(model) === GPT54_MODEL;
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
  let size = sizeSelect?.value || "auto";

  const quality =
    document.querySelector('input[name="quality"]:checked')?.value || "auto";

  const background =
    document.querySelector('input[name="background"]:checked')?.value || "auto";

  let format =
    document.querySelector('input[name="format"]:checked')?.value || "png";

  const count = clamp(Number(countInput?.value || 1), 1, 4);
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

  console.log("页面读取到的质量 quality =", quality);

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

    setStatus(error.message || "生成失败，请查看控制台。", "error");

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
  // 如果你的中转站只接受 response_format，可以按实际情况改回 response_format。
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

  const pushBase64Image = (value, format = "png") => {
    if (!value) return;

    const cleaned = String(value).replace(/\s/g, "");

    if (!looksLikeBase64Image(cleaned)) return;

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
          context.output_format ||
          context.format ||
          "png",
      };

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

      if (value.b64_json) {
        pushBase64Image(value.b64_json, localContext.output_format);
      }

      if (value.image_base64) {
        pushBase64Image(value.image_base64, localContext.output_format);
      }

      if (value.base64) {
        pushBase64Image(value.base64, localContext.output_format);
      }

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
        lowerKey === "result"
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
    generationNotice.classList.remove("success", "error");
    generationNotice.classList.add("loading");
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
      "生成任务正在处理中，结果准备好后会显示在下方。";
  }

  if (generationModelName) {
    generationModelName.textContent = `生成模型：${model}`;
  }

  updateGenerationTimer();

  generationTimerId = setInterval(updateGenerationTimer, 1000);
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
  generationNotice.classList.remove("loading", "success", "error");
  generationNotice.classList.add(type === "error" ? "error" : "success");

  if (type === "error") {
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
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  if (hours > 0) {
    const hh = String(hours).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }

  return `${mm}:${ss}`;
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