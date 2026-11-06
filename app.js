(function () {
  "use strict";

  const { CONTAINERS, planLoad, planLoadSequence } = window.ContainerPacking;
  const STORAGE_KEY = "container-loader-state-v2";
  const COLORS = [
    "#0b766e",
    "#2762b8",
    "#b6531e",
    "#9b3030",
    "#6f4ca8",
    "#147d9c",
    "#5d741f",
    "#a06a13",
  ];

  const DEFAULT_ROW = {
    sku: "SKU-001",
    name: "纸箱货",
    packageType: "carton",
    length: 600,
    width: 400,
    height: 400,
    diameter: 400,
    cylinderLength: 600,
    cylinderAxis: "length",
    clearance: 0,
    baseHeight: 0,
    dimensionsIncludeBase: true,
    weight: 12,
    topLoadKg: 0,
    stackable: true,
    supportRequired: 1,
    onlyBottom: false,
    onlyTop: false,
    quantity: 1000,
    rotation: "all",
  };

  const DEFAULT_SMALL_CONTAINER = {
    id: "small",
    name: "小柜",
    description: "混柜方案中的小柜",
    width: 2300,
    length: 5850,
    height: 2200,
    payload: 28200,
    longCargoAllowed: false,
    longCargoWidthColumns: 0,
    longCargoLengthPositions: 0,
    longCargoMaxLayers: 0,
    allowStacking: true,
    defaultTopLoadKg: 3000,
  };

  const AI_STORAGE_KEY = "container-loader-ai-v1";
  const AI_DEFAULTS = {
    endpoint: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    model: "glm-4-flash",
    key: "",
  };

  const elements = {
    planMode: document.querySelector("#planMode"),
    mixFields: document.querySelector("#mixFields"),
    mixBigCount: document.querySelector("#mixBigCount"),
    smallWidth: document.querySelector("#smallWidth"),
    smallLength: document.querySelector("#smallLength"),
    smallHeight: document.querySelector("#smallHeight"),
    smallPayload: document.querySelector("#smallPayload"),
    autoGroupInput: document.querySelector("#autoGroupInput"),
    containerSelect: document.querySelector("#containerSelect"),
    containerWidth: document.querySelector("#containerWidth"),
    containerLength: document.querySelector("#containerLength"),
    containerHeight: document.querySelector("#containerHeight"),
    containerPayload: document.querySelector("#containerPayload"),
    longCargoWidthColumns: document.querySelector(
      "#longCargoWidthColumns"
    ),
    longCargoLengthPositions: document.querySelector(
      "#longCargoLengthPositions"
    ),
    longCargoMaxLayers: document.querySelector(
      "#longCargoMaxLayers"
    ),
    longCargoAllowed: document.querySelector("#longCargoAllowed"),
    allowStacking: document.querySelector("#allowStacking"),
    defaultTopLoadKg: document.querySelector("#defaultTopLoadKg"),
    containerState: document.querySelector("#containerState"),
    cargoRows: document.querySelector("#cargoRows"),
    cargoCount: document.querySelector("#cargoCount"),
    cargoEstimate: document.querySelector("#cargoEstimate"),
    importListButton: document.querySelector("#importListButton"),
    exportListButton: document.querySelector("#exportListButton"),
    downloadTemplateButton: document.querySelector("#downloadTemplateButton"),
    importModal: document.querySelector("#importModal"),
    importCloseButton: document.querySelector("#importCloseButton"),
    importCancelButton: document.querySelector("#importCancelButton"),
    importTabs: document.querySelector("#importTabs"),
    importPanes: document.querySelectorAll(".import-pane"),
    importFileInput: document.querySelector("#importFileInput"),
    dropZone: document.querySelector("#dropZone"),
    pasteArea: document.querySelector("#pasteArea"),
    parsePasteButton: document.querySelector("#parsePasteButton"),
    aiTextArea: document.querySelector("#aiTextArea"),
    aiEndpoint: document.querySelector("#aiEndpoint"),
    aiModel: document.querySelector("#aiModel"),
    aiKey: document.querySelector("#aiKey"),
    aiParseButton: document.querySelector("#aiParseButton"),
    clipboardButton: document.querySelector("#clipboardButton"),
    importUnit: document.querySelector("#importUnit"),
    importMode: document.querySelector("#importMode"),
    importQtyMeaning: document.querySelector("#importQtyMeaning"),
    importTotal: document.querySelector("#importTotal"),
    importPreview: document.querySelector("#importPreview"),
    importPreviewBody: document.querySelector("#importPreviewBody"),
    importError: document.querySelector("#importError"),
    importApplyButton: document.querySelector("#importApplyButton"),    addCargoButton: document.querySelector("#addCargoButton"),
    calculateButton: document.querySelector("#calculateButton"),
    installButton: document.querySelector("#installButton"),
    shareButton: document.querySelector("#shareButton"),
    resetButton: document.querySelector("#resetButton"),
    exportButton: document.querySelector("#exportButton"),
    printButton: document.querySelector("#printButton"),
    emptyState: document.querySelector("#emptyState"),
    resultContent: document.querySelector("#resultContent"),
    resultError: document.querySelector("#resultError"),
    resultTitle: document.querySelector("#resultTitle"),
    resultBadge: document.querySelector("#resultBadge"),
    metricContainers: document.querySelector("#metricContainers"),
    metricContainersHint: document.querySelector("#metricContainersHint"),
    metricUnits: document.querySelector("#metricUnits"),
    metricUnitsHint: document.querySelector("#metricUnitsHint"),
    metricVolume: document.querySelector("#metricVolume"),
    metricVolumeHint: document.querySelector("#metricVolumeHint"),
    volumeProgress: document.querySelector("#volumeProgress"),
    metricWeight: document.querySelector("#metricWeight"),
    metricWeightHint: document.querySelector("#metricWeightHint"),
    weightProgress: document.querySelector("#weightProgress"),
    containerTabs: document.querySelector("#containerTabs"),
    visualTitle: document.querySelector("#visualTitle"),
    summaryTitle: document.querySelector("#summaryTitle"),
    containerUnits: document.querySelector("#containerUnits"),
    containerVolumeRate: document.querySelector("#containerVolumeRate"),
    containerWeightRate: document.querySelector("#containerWeightRate"),
    containerLoadList: document.querySelector("#containerLoadList"),
    detailScope: document.querySelector("#detailScope"),
    loadTableBody: document.querySelector("#loadTableBody"),
    canvas: document.querySelector("#loadingCanvas"),
    canvasWrap: document.querySelector("#canvasWrap"),
    viewAngle: document.querySelector("#viewAngle"),
    viewResetButton: document.querySelector("#viewResetButton"),
    fullscreenButton: document.querySelector("#fullscreenButton"),
    viewSwitch: document.querySelector("#viewSwitch"),
    toast: document.querySelector("#toast"),
  };

  let openedSharedPlan = false;
  const state = loadState();
  let toastTimer = null;
  let renderer = null;
  let deferredInstallPrompt = null;

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `cargo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function getDefaultState() {
    const container = { ...CONTAINERS["40HQ"] };
    return {
      rows: [{ id: createId(), ...DEFAULT_ROW }],
      container,
      smallContainer: { ...DEFAULT_SMALL_CONTAINER },
      planMode: "single",
      mixBigCount: 2,
      autoGroup: true,
      result: null,
      activeTab: 0,
      viewMode: "iso",
    };
  }

  function encodeBase64Url(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary)
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replaceAll("=", "");
  }

  function decodeBase64Url(value) {
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "="
    );
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0)
    );
    return new TextDecoder().decode(bytes);
  }

  function readSharedPlan() {
    const match = window.location.hash.match(/(?:^#|&)plan=([^&]+)/);
    if (!match) {
      return null;
    }
    try {
      const parsed = JSON.parse(decodeBase64Url(match[1]));
      if (!Array.isArray(parsed.rows) || !parsed.rows.length || !parsed.container) {
        return null;
      }
      openedSharedPlan = true;
      return {
        rows: parsed.rows,
        container: parsed.container,
        activeTab: 0,
        viewMode: "iso",
      };
    } catch {
      return null;
    }
  }

  function loadState() {
    const fallback = getDefaultState();
    const shared = readSharedPlan();
    if (shared) {
      return {
        ...fallback,
        ...shared,
        result: null,
      };
    }
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || !Array.isArray(saved.rows) || !saved.rows.length) {
        return fallback;
      }
      const savedContainer = {
        ...fallback.container,
        ...saved.container,
      };
      if (CONTAINERS[savedContainer.id]) {
        Object.assign(savedContainer, CONTAINERS[savedContainer.id]);
      }
      return {
        ...fallback,
        ...saved,
        container: savedContainer,
        smallContainer: {
          ...DEFAULT_SMALL_CONTAINER,
          ...saved.smallContainer,
        },
        planMode: saved.planMode === "mix" ? "mix" : "single",
        mixBigCount: Math.max(1, Number(saved.mixBigCount) || 2),
        autoGroup: saved.autoGroup !== false,
        result: null,
      };
    } catch {
      return fallback;
    }
  }

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          rows: state.rows,
          container: state.container,
          smallContainer: state.smallContainer,
          planMode: state.planMode,
          mixBigCount: state.mixBigCount,
          autoGroup: state.autoGroup,
          activeTab: state.activeTab,
          viewMode: state.viewMode,
        })
      );
    } catch {
      // Local storage can be unavailable in strict file:// contexts.
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function numberValue(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function formatInteger(value) {
    return new Intl.NumberFormat("zh-CN", {
      maximumFractionDigits: 0,
    }).format(value || 0);
  }

  function formatNumber(value, digits) {
    return new Intl.NumberFormat("zh-CN", {
      minimumFractionDigits: digits || 0,
      maximumFractionDigits: digits || 0,
    }).format(value || 0);
  }

  function percent(value) {
    return `${Math.round((value || 0) * 100)}%`;
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      elements.toast.classList.remove("visible");
    }, 2400);
  }

  function setContainerInputs() {
    elements.containerSelect.value = CONTAINERS[state.container.id]
      ? state.container.id
      : "custom";
    elements.containerWidth.value = state.container.width;
    elements.containerLength.value = state.container.length;
    elements.containerHeight.value = state.container.height;
    elements.containerPayload.value = state.container.payload;
    elements.longCargoWidthColumns.value =
      state.container.longCargoWidthColumns ?? 0;
    elements.longCargoLengthPositions.value =
      state.container.longCargoLengthPositions ?? 0;
    elements.longCargoMaxLayers.value =
      state.container.longCargoMaxLayers ?? 0;
    elements.longCargoAllowed.checked =
      state.container.longCargoAllowed !== false;
    elements.allowStacking.checked =
      state.container.allowStacking !== false;
    elements.defaultTopLoadKg.value = numberValue(
      state.container.defaultTopLoadKg,
      100
    );
    elements.planMode.value = state.planMode === "mix" ? "mix" : "single";
    elements.mixFields.hidden = state.planMode !== "mix";
    elements.mixBigCount.value = state.mixBigCount;
    elements.smallWidth.value = state.smallContainer.width;
    elements.smallLength.value = state.smallContainer.length;
    elements.smallHeight.value = state.smallContainer.height;
    elements.smallPayload.value = state.smallContainer.payload;
    elements.autoGroupInput.checked = state.autoGroup !== false;
    elements.containerState.textContent = state.planMode === "mix"
      ? "大柜 + 小柜"
      : state.container.id === "custom"
        ? "自定义"
        : state.container.name;
  }

  function renderCargoRows() {
    elements.cargoRows.innerHTML = state.rows
      .map((row, index) => {
        const color = COLORS[index % COLORS.length];
        const isCylinder = row.packageType === "cylinder";
        const hasWoodenBase = ["wooden", "pallet"].includes(
          row.packageType
        );
        const dimensions = isCylinder
          ? `
              <div class="dimension-input">
                <input type="number" min="1" step="0.1" value="${numberValue(row.diameter, "")}" data-field="diameter" aria-label="圆柱直径" />
                <span>直径</span>
              </div>
              <div class="dimension-input">
                <input type="number" min="1" step="1" value="${numberValue(row.cylinderLength, "")}" data-field="cylinderLength" aria-label="圆柱长度" />
                <span>长度</span>
              </div>
              <div class="dimension-input">
                <input type="number" min="0" step="0.01" value="${numberValue(row.weight, "")}" data-field="weight" aria-label="单件重量" />
                <span>kg</span>
              </div>
              <div class="dimension-input dimension-select">
                <select data-field="cylinderAxis" aria-label="圆柱轴向">
                  <option value="length" ${row.cylinderAxis === "length" ? "selected" : ""}>沿柜长</option>
                  <option value="width" ${row.cylinderAxis === "width" ? "selected" : ""}>沿柜宽</option>
                  <option value="height" ${row.cylinderAxis === "height" ? "selected" : ""}>竖放</option>
                </select>
              </div>
            `
          : `
              <div class="dimension-input">
                <input type="number" min="1" step="1" value="${numberValue(row.length, "")}" data-field="length" aria-label="包装长" />
                <span>长</span>
              </div>
              <div class="dimension-input">
                <input type="number" min="1" step="1" value="${numberValue(row.width, "")}" data-field="width" aria-label="包装宽" />
                <span>宽</span>
              </div>
              <div class="dimension-input">
                <input type="number" min="1" step="1" value="${numberValue(row.height, "")}" data-field="height" aria-label="包装高" />
                <span>高</span>
              </div>
              <div class="dimension-input">
                <input type="number" min="0" step="0.01" value="${numberValue(row.weight, "")}" data-field="weight" aria-label="单件重量" />
                <span>kg</span>
              </div>
            `;
        return `
          <article class="cargo-row" data-index="${index}" style="--row-color:${color}">
            <div class="cargo-row-head">
              <div class="cargo-index">
                <i class="color-dot" style="background:${color}"></i>
                <strong>${escapeHtml(row.name || `货物 ${index + 1}`)}</strong>
              </div>
              <button class="remove-row" type="button" data-action="remove" title="删除该项" aria-label="删除第 ${index + 1} 项货物">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
                </svg>
              </button>
            </div>
            <div class="cargo-grid">
              <div class="cargo-name-grid">
                <label class="field field-name">
                  <span>货号 / 名称</span>
                  <input type="text" value="${escapeHtml(row.name)}" data-field="name" aria-label="货号或名称" />
                </label>
                <label class="field field-package-type">
                  <span>包装类型</span>
                  <select data-field="packageType" aria-label="包装类型">
                    <option value="carton" ${row.packageType === "carton" ? "selected" : ""}>纸箱</option>
                    <option value="wooden" ${row.packageType === "wooden" ? "selected" : ""}>木箱</option>
                    <option value="bundle" ${row.packageType === "bundle" ? "selected" : ""}>捆包</option>
                    <option value="pallet" ${row.packageType === "pallet" ? "selected" : ""}>托盘</option>
                    <option value="cylinder" ${row.packageType === "cylinder" ? "selected" : ""}>圆柱 / 圆管</option>
                    <option value="irregular" ${row.packageType === "irregular" ? "selected" : ""}>异形 / 其他</option>
                  </select>
                </label>
              </div>
              <label class="field field-dimensions">
                <span>${isCylinder ? "圆柱直径 / 长度" : "包装外尺寸"} <em>mm</em></span>
                <div class="dimension-inputs">
                  ${dimensions}
                </div>
              </label>
              <div class="field field-flags">
                <label class="mini-field">
                  <span>数量 / 件</span>
                  <input class="mini-input" type="number" min="1" step="1" value="${numberValue(row.quantity, "")}" data-field="quantity" aria-label="包装数量" />
                </label>
                <label class="mini-field">
                  <span>安全余量 / 边</span>
                  <input class="mini-input" type="number" min="0" step="1" value="${numberValue(row.clearance, 0)}" data-field="clearance" aria-label="单边安全余量" />
                </label>
                ${
                  isCylinder
                    ? ""
                    : `
                      <label class="mini-field">
                        <span>旋转规则</span>
                        <select data-field="rotation" aria-label="旋转规则">
                          <option value="all" ${row.rotation === "all" ? "selected" : ""}>可全向翻转</option>
                          <option value="upright" ${row.rotation === "upright" ? "selected" : ""}>只可水平旋转</option>
                          <option value="fixed" ${row.rotation === "fixed" ? "selected" : ""}>不可旋转</option>
                        </select>
                      </label>
                    `
                }
                <label class="stack-toggle mini-field">
                  <input type="checkbox" data-field="stackable" ${row.stackable !== false ? "checked" : ""} />
                  <span>允许上方叠放货物</span>
                </label>
                <label class="mini-field">
                  <span>顶部可承重 kg</span>
                  <input class="mini-input" type="number" min="0" step="1" value="${numberValue(row.topLoadKg, 0)}" data-field="topLoadKg" aria-label="顶部最大承重" />
                </label>
                ${
                  hasWoodenBase
                    ? `
                      <label class="mini-field">
                        <span>底座高度 mm</span>
                        <input class="mini-input" type="number" min="0" step="1" value="${numberValue(row.baseHeight, 100)}" data-field="baseHeight" aria-label="木箱底座高度" />
                      </label>
                      <label class="stack-toggle mini-field">
                        <input type="checkbox" data-field="dimensionsIncludeBase" ${row.dimensionsIncludeBase !== false ? "checked" : ""} />
                        <span>录入总高已含底座</span>
                      </label>
                    `
                    : ""
                }
                <label class="mini-field">
                  <span>底部支撑要求</span>
                  <select data-field="supportRequired" aria-label="底部支撑要求">
                    <option value="1" ${numberValue(row.supportRequired, 1) === 1 ? "selected" : ""}>必须完全支撑</option>
                    <option value="0.9" ${numberValue(row.supportRequired, 1) === 0.9 ? "selected" : ""}>至少 90%</option>
                    <option value="0.8" ${numberValue(row.supportRequired, 1) === 0.8 ? "selected" : ""}>至少 80%</option>
                  </select>
                </label>
                <label class="stack-toggle mini-field" style="grid-column:1 / -1">
                  <input type="checkbox" data-field="onlyBottom" ${row.onlyBottom ? "checked" : ""} />
                  <span>此包装只允许放在柜底</span>
                </label>
                <label class="stack-toggle mini-field" style="grid-column:1 / -1">
                  <input type="checkbox" data-field="onlyTop" ${row.onlyTop ? "checked" : ""} />
                  <span>此包装必须放在其他包装上方</span>
                </label>
              </div>
            </div>
          </article>
        `;
      })
      .join("");

    elements.cargoCount.textContent = `${state.rows.length} 项`;
    updateEstimate();
  }

  function updateEstimate() {
    const quantity = state.rows.reduce(
      (sum, row) => sum + Math.max(0, numberValue(row.quantity, 0)),
      0
    );
    const cbm = state.rows.reduce((sum, row) => {
      const cartonCbm =
        row.packageType === "cylinder"
          ? (Math.PI *
              (numberValue(row.diameter, 0) / 2) ** 2 *
              numberValue(row.cylinderLength, 0)) /
            1000000000
          : (numberValue(row.length, 0) *
              numberValue(row.width, 0) *
              (numberValue(row.height, 0) +
                (row.dimensionsIncludeBase === false
                  ? numberValue(row.baseHeight, 0)
                  : 0))) /
            1000000000;
      return sum + cartonCbm * Math.max(0, numberValue(row.quantity, 0));
    }, 0);
    elements.cargoEstimate.textContent = `${formatInteger(quantity)} 件 / ${formatNumber(
      cbm,
      3
    )} CBM`;
  }

  function handleCargoInput(event) {
    const input = event.target.closest("[data-field]");
    const rowElement = event.target.closest(".cargo-row");
    if (!input || !rowElement) {
      return;
    }

    const index = Number(rowElement.dataset.index);
    const field = input.dataset.field;
    const row = state.rows[index];
    if (!row) {
      return;
    }

    if (["onlyBottom", "onlyTop", "dimensionsIncludeBase", "stackable"].includes(field)) {
      row[field] = input.checked;
      if (input.checked && ["onlyBottom", "onlyTop"].includes(field)) {
        const opposite = field === "onlyTop" ? "onlyBottom" : "onlyTop";
        row[opposite] = false;
        rowElement.querySelector(`[data-field="${opposite}"]`).checked = false;
      }
      if (field === "stackable") {
        saveState();
        return;
      }
    } else if (
      [
        "length",
        "width",
        "height",
        "diameter",
        "cylinderLength",
        "clearance",
        "baseHeight",
        "weight",
        "topLoadKg",
        "quantity",
        "supportRequired",
      ].includes(field)
    ) {
      row[field] = input.value;
    } else {
      row[field] = input.value;
    }

    if (field === "name") {
      const heading = rowElement.querySelector(".cargo-index strong");
      if (heading) {
        heading.textContent = row.name || `货物 ${index + 1}`;
      }
    }

    if (field === "packageType") {
      if (row.packageType === "cylinder") {
        row.diameter =
          numberValue(row.diameter, 0) ||
          Math.max(numberValue(row.width, 0), numberValue(row.height, 0));
        row.cylinderLength =
          numberValue(row.cylinderLength, 0) || numberValue(row.length, 0);
      } else {
        row.length = numberValue(row.length, 0) || row.cylinderLength;
        row.width = numberValue(row.width, 0) || row.diameter;
        row.height = numberValue(row.height, 0) || row.diameter;
      }
      if (["wooden", "pallet"].includes(row.packageType)) {
        row.baseHeight = numberValue(row.baseHeight, 0) || 100;
        row.dimensionsIncludeBase =
          row.dimensionsIncludeBase !== false;
      } else {
        row.baseHeight = 0;
      }
      renderCargoRows();
      saveState();
      return;
    }

    updateEstimate();
    saveState();
  }

  function handleCargoClick(event) {
    const button = event.target.closest("[data-action='remove']");
    if (!button) {
      return;
    }
    const rowElement = event.target.closest(".cargo-row");
    const index = Number(rowElement.dataset.index);

    if (state.rows.length === 1) {
      showToast("至少保留一项货物；可直接修改现有数据。");
      return;
    }

    state.rows.splice(index, 1);
    renderCargoRows();
    saveState();
  }

  function addCargoRow() {
    const nextNumber = state.rows.length + 1;
    state.rows.push({
      id: createId(),
      ...DEFAULT_ROW,
      sku: `SKU-${String(nextNumber).padStart(3, "0")}`,
      name: `货物 ${nextNumber}`,
      quantity: 100,
    });
    renderCargoRows();
    saveState();
    const lastRow = elements.cargoRows.lastElementChild;
    if (lastRow) {
      lastRow.scrollIntoView({ behavior: "smooth", block: "nearest" });
      const input = lastRow.querySelector("input[data-field='name']");
      if (input) {
        input.focus();
        input.select();
      }
    }
  }

  function handleContainerSelect() {
    if (elements.containerSelect.value !== "custom") {
      state.container = { ...CONTAINERS[elements.containerSelect.value] };
      setContainerInputs();
      saveState();
    }
  }

  function matchContainerPreset(width, length, height, payload) {
    return Object.values(CONTAINERS).find(
      (preset) =>
        preset.width === width &&
        preset.length === length &&
        preset.height === height &&
        preset.payload === payload
    );
  }

  function handleContainerInput(event) {
    const width = numberValue(elements.containerWidth.value, 0);
    const length = numberValue(elements.containerLength.value, 0);
    const height = numberValue(elements.containerHeight.value, 0);
    const payload = numberValue(elements.containerPayload.value, 0);
    const preset = matchContainerPreset(width, length, height, payload);
    state.container = {
      ...state.container,
      id: preset ? preset.id : "custom",
      name: preset ? preset.name : "自定义",
      description: preset ? preset.description : "自定义柜型",
      width,
      length,
      height,
      payload,
      longCargoWidthColumns: numberValue(
        elements.longCargoWidthColumns.value,
        0
      ),
      longCargoLengthPositions: numberValue(
        elements.longCargoLengthPositions.value,
        0
      ),
      longCargoMaxLayers: numberValue(
        elements.longCargoMaxLayers.value,
        0
      ),
      longCargoAllowed: elements.longCargoAllowed.checked,
      allowStacking: elements.allowStacking.checked,
      defaultTopLoadKg: numberValue(elements.defaultTopLoadKg.value, 0),
    };
    elements.containerSelect.value = preset ? preset.id : "custom";
    elements.containerState.textContent =
      state.planMode === "mix"
        ? "大柜 + 小柜"
        : preset
          ? preset.name
          : "自定义";
    saveState();
  }

  function handlePlanModeChange() {
    state.planMode = elements.planMode.value === "mix" ? "mix" : "single";
    elements.mixFields.hidden = state.planMode !== "mix";
    elements.containerState.textContent =
      state.planMode === "mix"
        ? "大柜 + 小柜"
        : state.container.id === "custom"
          ? "自定义"
          : state.container.name;
    saveState();
  }

  function handleMixInput() {
    state.mixBigCount = Math.max(
      1,
      Math.min(6, Math.floor(numberValue(elements.mixBigCount.value, 2)))
    );
    state.autoGroup = elements.autoGroupInput.checked;
    state.smallContainer = {
      ...state.smallContainer,
      width: Math.max(1, numberValue(elements.smallWidth.value, 0)),
      length: Math.max(1, numberValue(elements.smallLength.value, 0)),
      height: Math.max(1, numberValue(elements.smallHeight.value, 0)),
      payload: Math.max(0, numberValue(elements.smallPayload.value, 0)),
    };
    saveState();
  }

  function sequenceContainers() {
    const bigCount = Math.max(
      1,
      Math.min(6, Math.floor(numberValue(state.mixBigCount, 2)))
    );
    return [
      ...Array.from({ length: bigCount }, (_, index) => ({
        ...state.container,
        label: `大柜${index + 1}`,
      })),
      {
        ...state.smallContainer,
        label: "小柜1",
        defaultTopLoadKg:
          state.smallContainer.defaultTopLoadKg ??
          state.container.defaultTopLoadKg,
      },
    ];
  }

  function collectRows() {
    return state.rows.map((row, index) => ({
      id: row.id || `row-${index + 1}`,
      sku: row.sku || "",
      name: row.name || `货物 ${index + 1}`,
      packageType: row.packageType || "carton",
      shape: row.packageType === "cylinder" ? "cylinder" : "box",
      length: numberValue(row.length, 0),
      width: numberValue(row.width, 0),
      height: numberValue(row.height, 0),
      diameter: numberValue(row.diameter, 0),
      cylinderLength: numberValue(row.cylinderLength, 0),
      cylinderAxis: row.cylinderAxis || "length",
      clearance: numberValue(row.clearance, 0),
      baseHeight: numberValue(row.baseHeight, 0),
      dimensionsIncludeBase: row.dimensionsIncludeBase !== false,
      weight: numberValue(row.weight, 0),
      topLoadKg: numberValue(row.topLoadKg, 0),
      stackable: row.stackable !== false,
      supportRequired: numberValue(row.supportRequired, 1),
      onlyBottom: Boolean(row.onlyBottom),
      onlyTop: Boolean(row.onlyTop),
      quantity: numberValue(row.quantity, 0),
      rotation: row.rotation || "all",
      colorIndex: index % COLORS.length,
    }));
  }

  function calculate() {
    const rows = collectRows();
    const result =
      state.planMode === "mix"
        ? planLoadSequence(rows, sequenceContainers(), {
            autoGroup: state.autoGroup !== false,
            laneClearance: 100,
          })
        : planLoad(rows, state.container);
    state.result = result;
    state.activeTab = 0;
    saveState();

    if (!result.ok) {
      renderError(result);
      return;
    }

    renderResult(result);
    showToast(
      result.sequence
        ? `${result.totals.containers} 个柜混装完成，全部货物已分配。`
        : `${result.totals.containers} 个${result.container.name}可装载全部货物。`
    );
  }

  function showEmpty() {
    elements.emptyState.hidden = false;
    elements.resultContent.hidden = true;
    elements.resultError.hidden = true;
  }

  function renderError(result) {
    elements.emptyState.hidden = true;
    elements.resultContent.hidden = true;
    elements.resultError.hidden = false;
    elements.resultError.innerHTML = `
      <strong>当前数据无法完成装载</strong>
      <ul>${result.errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul>
    `;
  }

  function renderResult(result) {
    const totals = result.totals;
    elements.emptyState.hidden = true;
    elements.resultError.hidden = true;
    elements.resultContent.hidden = false;
    elements.resultTitle.textContent = result.sequence
      ? `${result.totals.containers} 个柜混装结果`
      : `${result.container.name} 装柜结果`;
    elements.resultBadge.textContent = `平均容积率 ${percent(
      totals.volumeUtilization
    )}`;
    elements.metricContainers.textContent = formatInteger(totals.containers);
    elements.metricContainersHint.textContent = "全部货物已分配";
    elements.metricUnits.textContent = formatInteger(totals.units);
    elements.metricUnitsHint.textContent = `${result.items.length} 项货物`;
    elements.metricVolume.innerHTML = `${formatNumber(
      totals.cbm,
      3
    )} <em>CBM</em>`;
    elements.metricVolumeHint.textContent = `平均容积率 ${percent(
      totals.volumeUtilization
    )}`;
    elements.volumeProgress.style.width = `${Math.min(
      100,
      totals.volumeUtilization * 100
    )}%`;
    elements.metricWeight.innerHTML = `${formatInteger(
      totals.weight
    )} <em>kg</em>`;
    elements.metricWeightHint.textContent = `平均载重率 ${percent(
      totals.weightUtilization
    )}`;
    elements.weightProgress.style.width = `${Math.min(
      100,
      totals.weightUtilization * 100
    )}%`;

    elements.containerTabs.innerHTML = result.containers
      .map(
        (container, index) => `
          <button class="result-tab ${
            index === state.activeTab ? "active" : ""
          }" type="button" data-tab="${index}" role="tab" aria-selected="${
            index === state.activeTab
          }">${escapeHtml(container.label || `第 ${container.index} 柜`)}</button>
        `
      )
      .join("");

    renderActiveContainer();
  }

  function itemById(itemId) {
    return state.result.items.find((item) => item.id === itemId);
  }

  function renderActiveContainer() {
    const result = state.result;
    if (!result || !result.ok || !result.containers.length) {
      return;
    }
    state.activeTab = Math.max(
      0,
      Math.min(result.containers.length - 1, state.activeTab)
    );
    const container = result.containers[state.activeTab];
    const label = container.label || `第 ${container.index} 柜`;
    elements.visualTitle.textContent = label;
    elements.summaryTitle.textContent = `${label}明细`;
    elements.containerUnits.textContent = formatInteger(
      container.placements.length
    );
    elements.containerVolumeRate.textContent = percent(
      container.volumeUtilization
    );
    elements.containerWeightRate.textContent = percent(
      container.weightUtilization
    );
    elements.detailScope.textContent = `${label} / 共 ${result.containers.length} 柜`;

    elements.containerTabs
      .querySelectorAll("[data-tab]")
      .forEach((button) => {
        const active = Number(button.dataset.tab) === state.activeTab;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", String(active));
      });

    elements.containerLoadList.innerHTML = container.summary
      .map((entry) => {
        const item = itemById(entry.itemId);
        const color = COLORS[item ? item.colorIndex : 0];
        return `
          <div class="load-list-item">
            <i class="color-dot" style="background:${color}"></i>
            <div class="load-list-copy">
              <strong>${escapeHtml(entry.name)}</strong>
              <span>${escapeHtml(entry.orientation)} · ${escapeHtml(entry.supportDescription)}</span>
            </div>
            <div class="load-list-count">
              <strong>${formatInteger(entry.count)} 件</strong>
              <span>${formatNumber(entry.cbm, 3)} CBM</span>
            </div>
          </div>
        `;
      })
      .join("");

    elements.loadTableBody.innerHTML = container.summary
      .map((entry) => {
        const item = itemById(entry.itemId);
        const color = COLORS[item ? item.colorIndex : 0];
        return `
          <tr>
            <td>${escapeHtml(label)}</td>
            <td>
              <div class="table-name">
                <i class="color-dot" style="background:${color}"></i>
                <div>
                  <strong>${escapeHtml(entry.name)}</strong>
                  <span>${escapeHtml(item && item.sku ? item.sku : "未填写货号")}</span>
                </div>
              </div>
            </td>
            <td>${formatInteger(entry.count)}</td>
            <td>${escapeHtml(entry.orientation)}</td>
            <td>${escapeHtml(entry.supportDescription)}</td>
            <td>${formatNumber(entry.cbm, 3)} CBM</td>
            <td>${formatNumber(entry.weight, 1)} kg</td>
          </tr>
        `;
      })
      .join("");

    if (renderer) {
      renderer.setContainer(container, container.container || result.container);
    }
    saveState();
  }

  function handleTabClick(event) {
    const button = event.target.closest("[data-tab]");
    if (!button) {
      return;
    }
    state.activeTab = Number(button.dataset.tab);
    renderActiveContainer();
  }

  function exportCsv() {
    if (!state.result || !state.result.ok) {
      showToast("请先完成一次装柜计算。");
      return;
    }

    const rows = [
      ["柜号", "货号", "名称", "件数", "摆法", "体积(CBM)", "重量(kg)"],
    ];
    state.result.containers.forEach((container) => {
      container.summary.forEach((entry) => {
        const item = itemById(entry.itemId);
        rows.push([
          container.label || `第 ${container.index} 柜`,
          item ? item.sku : "",
          entry.name,
          entry.count,
          entry.orientation,
          entry.cbm.toFixed(3),
          entry.weight.toFixed(1),
        ]);
      });
    });
    rows.push([]);
    rows.push([
      "总计",
      "",
      "",
      state.result.totals.units,
      "",
      state.result.totals.cbm.toFixed(3),
      state.result.totals.weight.toFixed(1),
    ]);

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${state.result.sequence ? "混柜方案" : state.result.container.name}-装柜方案.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }

  async function sharePlan() {
    const payload = {
      version: 1,
      container: state.container,
      rows: state.rows,
    };
    const url = new URL(window.location.href);
    url.hash = `plan=${encodeBase64Url(JSON.stringify(payload))}`;
    try {
      const copied = await copyText(url.href);
      if (copied) {
        showToast("分享链接已复制，打开后会恢复当前柜型和货物数据。");
      } else {
        window.prompt("请复制分享链接", url.href);
      }
    } catch {
      window.prompt("请复制分享链接", url.href);
    }
  }

  async function installApp() {
    if (!deferredInstallPrompt) {
      return;
    }
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    elements.installButton.hidden = true;
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || window.location.protocol === "file:") {
      return;
    }
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // The app still runs normally when service worker registration is blocked.
    });
  }

  function resetApp() {
    state.rows = [{ id: createId(), ...DEFAULT_ROW }];
    state.container = { ...CONTAINERS["40HQ"] };
    state.result = null;
    state.activeTab = 0;
    state.viewMode = "iso";
    setContainerInputs();
    renderCargoRows();
    showEmpty();
    saveState();
    if (renderer) {
      renderer.setView("iso");
    }
    showToast("已恢复初始数据。");
  }

  class ContainerRenderer {
    constructor(canvas, wrap, angleLabel) {
      this.canvas = canvas;
      this.wrap = wrap;
      this.angleLabel = angleLabel;
      this.ctx = canvas.getContext("2d");
      this.container = null;
      this.template = null;
      this.yaw = -0.72;
      this.pitch = 0.42;
      this.zoom = 1;
      this.viewMode = "iso";
      this.dragging = false;
      this.pointerId = null;
      this.lastPointer = { x: 0, y: 0 };
      this.frame = 0;
      this.width = 0;
      this.height = 0;
      this.maxVisible = 1800;
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(wrap);
      this.bindEvents();
      this.setView("iso");
      this.resize();
    }

    bindEvents() {
      this.canvas.addEventListener("pointerdown", (event) => {
        if (!this.container) {
          return;
        }
        this.dragging = true;
        this.pointerId = event.pointerId;
        this.lastPointer = { x: event.clientX, y: event.clientY };
        this.canvas.setPointerCapture(event.pointerId);
      });

      this.canvas.addEventListener("pointermove", (event) => {
        if (!this.dragging || event.pointerId !== this.pointerId) {
          return;
        }
        const deltaX = event.clientX - this.lastPointer.x;
        const deltaY = event.clientY - this.lastPointer.y;
        this.lastPointer = { x: event.clientX, y: event.clientY };
        this.yaw += deltaX * 0.008;
        this.pitch = Math.max(
          -1.25,
          Math.min(1.25, this.pitch + deltaY * 0.006)
        );
        this.requestDraw();
      });

      const finishDrag = (event) => {
        if (event.pointerId !== this.pointerId) {
          return;
        }
        this.dragging = false;
        this.pointerId = null;
        if (this.canvas.hasPointerCapture(event.pointerId)) {
          this.canvas.releasePointerCapture(event.pointerId);
        }
      };
      this.canvas.addEventListener("pointerup", finishDrag);
      this.canvas.addEventListener("pointercancel", finishDrag);
      this.canvas.addEventListener(
        "wheel",
        (event) => {
          if (!this.container) {
            return;
          }
          event.preventDefault();
          this.zoom = Math.max(
            0.45,
            Math.min(2.6, this.zoom * (event.deltaY > 0 ? 0.92 : 1.08))
          );
          this.requestDraw();
        },
        { passive: false }
      );
      this.canvas.addEventListener("dblclick", () => this.setView("iso"));
    }

    resize() {
      const rect = this.wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.width = Math.max(1, rect.width);
      this.height = Math.max(1, rect.height);
      this.canvas.width = Math.round(this.width * dpr);
      this.canvas.height = Math.round(this.height * dpr);
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.requestDraw();
    }

    setContainer(container, template) {
      this.container = container;
      this.template = template;
      this.requestDraw();
    }

    setView(mode) {
      this.viewMode = mode;
      if (mode === "front") {
        this.yaw = 0;
        this.pitch = 0;
        this.zoom = 1;
      } else if (mode === "top") {
        this.yaw = 0;
        this.pitch = -1.5;
        this.zoom = 1;
      } else {
        this.yaw = -0.72;
        this.pitch = 0.42;
        this.zoom = 1;
      }
      elements.viewSwitch.querySelectorAll("button").forEach((button) => {
        button.classList.toggle("active", button.dataset.view === mode);
      });
      this.requestDraw();
    }

    requestDraw() {
      if (this.frame) {
        return;
      }
      this.frame = window.requestAnimationFrame(() => {
        this.frame = 0;
        this.draw();
      });
    }

    projectPoint(point, template, fitScale) {
      const maxDimension = Math.max(
        template.width,
        template.length,
        template.height
      );
      const x = (point.x - template.width / 2) / maxDimension;
      const y = (point.y - template.length / 2) / maxDimension;
      const z = (point.z - template.height / 2) / maxDimension;
      const cosYaw = Math.cos(this.yaw);
      const sinYaw = Math.sin(this.yaw);
      const cosPitch = Math.cos(this.pitch);
      const sinPitch = Math.sin(this.pitch);
      const x1 = x * cosYaw - y * sinYaw;
      const y1 = x * sinYaw + y * cosYaw;
      const depth = y1 * cosPitch - z * sinPitch;
      const y2 = y1 * sinPitch + z * cosPitch;
      return {
        x: this.width / 2 + x1 * fitScale,
        y: this.height * 0.56 - y2 * fitScale,
        depth,
      };
    }

    getFitScale(template) {
      const base = Math.min(this.width / 1.72, this.height / 1.32);
      return base * this.zoom;
    }

    draw() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.width, this.height);
      if (!this.container || !this.template) {
        return;
      }

      const template = this.template;
      const fitScale = this.getFitScale(template);
      const visiblePlacements = this.container.placements.slice(
        0,
        this.maxVisible
      );
      const faces = [];

      visiblePlacements.forEach((placement, index) => {
        const color =
          COLORS[placement.colorIndex % COLORS.length] || COLORS[index % COLORS.length];
        if (placement.shape === "cylinder") {
          this.createCylinderFaces(
            placement,
            color,
            template,
            fitScale,
            faces
          );
        } else if (
          Number(placement.baseHeight) > 0 &&
          placement.baseHeight < placement.dz
        ) {
          const baseHeight = Math.max(0, Number(placement.baseHeight));
          const mainHeight = placement.dz - baseHeight;
          if (baseHeight > 0.01) {
            this.createBoxFaces(
              {
                ...placement,
                z: placement.z,
                dz: baseHeight,
              },
              "#6f5439",
              template,
              fitScale,
              faces
            );
          }
          if (mainHeight > 0.01) {
            this.createBoxFaces(
              {
                ...placement,
                z: placement.z + baseHeight,
                dz: mainHeight,
              },
              color,
              template,
              fitScale,
              faces
            );
          }
        } else {
          this.createBoxFaces(placement, color, template, fitScale, faces);
        }
      });

      faces.sort((a, b) => b.depth - a.depth);
      ctx.save();
      faces.forEach((face) => {
        ctx.beginPath();
        ctx.moveTo(face.points[0].x, face.points[0].y);
        for (let index = 1; index < face.points.length; index += 1) {
          ctx.lineTo(face.points[index].x, face.points[index].y);
        }
        ctx.closePath();
        ctx.fillStyle = face.color;
        ctx.fill();
        if (visiblePlacements.length <= 900) {
          ctx.strokeStyle = "rgba(19,31,43,0.34)";
          ctx.lineWidth = 0.65;
          ctx.stroke();
        }
      });
      ctx.restore();

      this.drawContainerFrame(template, fitScale);
      const degreesYaw = Math.round((this.yaw * 180) / Math.PI);
      const degreesPitch = Math.round((this.pitch * 180) / Math.PI);
      const hiddenCount = this.container.placements.length - visiblePlacements.length;
      elements.viewAngle.textContent =
        hiddenCount > 0
          ? `示意 ${visiblePlacements.length} / ${this.container.placements.length} 件`
          : `视角 ${degreesYaw}° / ${degreesPitch}°`;
    }

    createBoxFaces(box, color, template, fitScale, output) {
      const p = (x, y, z) =>
        this.projectPoint({ x, y, z }, template, fitScale);
      const x0 = box.x;
      const x1 = box.x + box.dx;
      const y0 = box.y;
      const y1 = box.y + box.dy;
      const z0 = box.z;
      const z1 = box.z + box.dz;
      const points = [
        p(x0, y0, z0),
        p(x1, y0, z0),
        p(x1, y1, z0),
        p(x0, y1, z0),
        p(x0, y0, z1),
        p(x1, y0, z1),
        p(x1, y1, z1),
        p(x0, y1, z1),
      ];
      const faceDefinitions = [
        { indices: [0, 1, 2, 3], shade: 0.72 },
        { indices: [4, 7, 6, 5], shade: 1.13 },
        { indices: [3, 2, 6, 7], shade: 0.84 },
        { indices: [0, 4, 5, 1], shade: 0.92 },
        { indices: [1, 5, 6, 2], shade: 1.02 },
        { indices: [0, 3, 7, 4], shade: 0.78 },
      ];

      faceDefinitions.forEach((definition) => {
        const projected = definition.indices.map((index) => points[index]);
        output.push({
          points: projected,
          color: shadeColor(color, definition.shade),
          depth:
            projected.reduce((sum, point) => sum + point.depth, 0) /
            projected.length,
        });
      });
    }

    createCylinderFaces(cylinder, color, template, fitScale, output) {
      const axis = cylinder.cylinderAxis || "length";
      const diameter = Math.max(
        1,
        Number(cylinder.diameter) ||
          Math.min(cylinder.dx, cylinder.dy, cylinder.dz)
      );
      const radius = diameter / 2;
      const length = Math.max(
        1,
        Number(cylinder.cylinderLength) ||
          (axis === "width"
            ? cylinder.dx
            : axis === "height"
              ? cylinder.dz
              : cylinder.dy)
      );
      const centerX = cylinder.x + cylinder.dx / 2;
      const centerY = cylinder.y + cylinder.dy / 2;
      const centerZ = cylinder.z + cylinder.dz / 2;
      const segments = 16;
      const ringA = [];
      const ringB = [];
      const p = (x, y, z) =>
        this.projectPoint({ x, y, z }, template, fitScale);

      for (let index = 0; index < segments; index += 1) {
        const angle = (Math.PI * 2 * index) / segments;
        const cosine = Math.cos(angle);
        const sine = Math.sin(angle);

        if (axis === "width") {
          ringA.push(
            p(
              cylinder.x + (cylinder.dx - length) / 2,
              centerY + radius * cosine,
              centerZ + radius * sine
            )
          );
          ringB.push(
            p(
              cylinder.x + (cylinder.dx + length) / 2,
              centerY + radius * cosine,
              centerZ + radius * sine
            )
          );
        } else if (axis === "height") {
          ringA.push(
            p(
              centerX + radius * cosine,
              centerY + radius * sine,
              cylinder.z + (cylinder.dz - length) / 2
            )
          );
          ringB.push(
            p(
              centerX + radius * cosine,
              centerY + radius * sine,
              cylinder.z + (cylinder.dz + length) / 2
            )
          );
        } else {
          ringA.push(
            p(
              centerX + radius * cosine,
              cylinder.y + (cylinder.dy - length) / 2,
              centerZ + radius * sine
            )
          );
          ringB.push(
            p(
              centerX + radius * cosine,
              cylinder.y + (cylinder.dy + length) / 2,
              centerZ + radius * sine
            )
          );
        }
      }

      for (let index = 0; index < segments; index += 1) {
        const nextIndex = (index + 1) % segments;
        const side = [
          ringA[index],
          ringA[nextIndex],
          ringB[nextIndex],
          ringB[index],
        ];
        const shade =
          0.78 +
          0.22 *
            Math.max(
              0,
              Math.cos((Math.PI * 2 * (index + 0.5)) / segments - 0.7)
            );
        output.push({
          points: side,
          color: shadeColor(color, shade),
          depth:
            side.reduce((sum, point) => sum + point.depth, 0) / side.length,
        });
      }

      [
        { points: [...ringA].reverse(), shade: 0.9 },
        { points: ringB, shade: 1.12 },
      ].forEach((cap) => {
        output.push({
          points: cap.points,
          color: shadeColor(color, cap.shade),
          depth:
            cap.points.reduce((sum, point) => sum + point.depth, 0) /
            cap.points.length,
        });
      });
    }

    drawContainerFrame(template, fitScale) {
      const ctx = this.ctx;
      const p = (x, y, z) =>
        this.projectPoint({ x, y, z }, template, fitScale);
      const w = template.width;
      const l = template.length;
      const h = template.height;

      ctx.save();
      ctx.strokeStyle = "rgba(81,102,124,0.22)";
      ctx.lineWidth = 0.85;
      for (let y = 0; y <= l; y += 1000) {
        const start = p(0, y, 0);
        const end = p(w, y, 0);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      }
      for (let x = 0; x <= w; x += 1000) {
        const start = p(x, 0, 0);
        const end = p(x, l, 0);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      }

      const corners = [
        p(0, 0, 0),
        p(w, 0, 0),
        p(w, l, 0),
        p(0, l, 0),
        p(0, 0, h),
        p(w, 0, h),
        p(w, l, h),
        p(0, l, h),
      ];
      const edges = [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 0],
        [4, 5],
        [5, 6],
        [6, 7],
        [7, 4],
        [0, 4],
        [1, 5],
        [2, 6],
        [3, 7],
      ];
      ctx.strokeStyle = "rgba(52,71,92,0.72)";
      ctx.lineWidth = 1.25;
      edges.forEach(([startIndex, endIndex]) => {
        const start = corners[startIndex];
        const end = corners[endIndex];
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      });
      ctx.restore();
    }
  }

  function shadeColor(hex, factor) {
    const normalized = hex.replace("#", "");
    const value =
      normalized.length === 3
        ? normalized
            .split("")
            .map((character) => character + character)
            .join("")
        : normalized;
    const red = Number.parseInt(value.slice(0, 2), 16);
    const green = Number.parseInt(value.slice(2, 4), 16);
    const blue = Number.parseInt(value.slice(4, 6), 16);
    const convert = (channel) =>
      Math.max(0, Math.min(255, Math.round(channel * factor)));
    return `rgb(${convert(red)}, ${convert(green)}, ${convert(blue)})`;
  }

  let importDraft = null;

  const IMPORT_FIELD_ALIASES = {
    sku: ["货号", "型号", "编号", "编码", "箱号", "sku", "skucode", "code", "artno", "itemno", "partno", "ctnno", "cartonno"],
    name: ["名称", "货名", "品名", "货物名称", "品名规格", "货描", "货物描述", "name", "item", "itemname", "description", "desc", "product"],
    packageType: ["包装类型", "包装", "包装方式", "类型", "packagetype", "package", "packing"],
    cylinderLength: ["圆柱长度", "管长", "管子长度", "筒长", "cylinderlength", "pipelength", "pipelong"],
    length: ["长", "长度", "长mm", "length", "long", "len", "l"],
    width: ["宽", "宽度", "宽mm", "width", "w", "breadth"],
    height: ["高", "高度", "高mm", "height", "h", "tall"],
    diameter: ["直径", "外径", "直径mm", "diameter", "dia"],
    quantity: ["数量", "件数", "箱数", "托数", "qty", "quantity", "count", "pcs", "pieces", "num", "ctns"],
    weight: ["重量", "单件重量", "单重", "毛重", "净重", "总重", "总毛重", "weight", "grossweight", "netweight", "gw", "g.w", "gwkg"],
    cbm: ["cbm", "体积", "材积", "volume", "meas", "measurement"],
    topLoadKg: ["顶部承重", "顶部可承重", "顶部最大承重", "承重", "可承重", "topload", "toploadkg", "maxload"],
    stackable: ["允许叠放", "可叠放", "能否叠放", "是否可叠放", "叠放", "stackable", "canstack"],
    rotation: ["旋转", "旋转规则", "旋转方式", "翻转", "rotation", "rotate"],
    clearance: ["余量", "安全余量", "间隙", "边距", "clearance", "margin"],
    supportRequired: ["支撑要求", "底部支撑", "支撑比例", "supportrequired", "support"],
    onlyBottom: ["只放柜底", "只能放底层", "仅放底层", "onlybottom", "bottomonly"],
    onlyTop: ["只放上层", "必须上层", "仅放上层", "onlytop", "toponly"],
  };

  const PACKAGE_TYPE_LABELS = {
    carton: "纸箱",
    wooden: "木箱",
    bundle: "捆包",
    pallet: "托盘",
    cylinder: "圆柱/圆管",
    irregular: "异形/其他",
  };

  const ROTATION_LABELS = {
    all: "可全向翻转",
    upright: "只可水平旋转",
    fixed: "不可旋转",
  };

  const TEMPLATE_HEAD = [
    "货号", "名称", "包装类型", "长(mm)", "宽(mm)", "高(mm)",
    "数量(件)", "单件重量(kg)", "允许叠放", "顶部可承重(kg)", "旋转规则", "只放柜底", "必须上层",
  ];

  const PACKAGE_TYPE_MATCHES = [
    ["纸箱", "carton"], ["carton", "carton"],
    ["木箱", "wooden"], ["木架", "wooden"], ["wooden", "wooden"], ["木", "wooden"],
    ["捆包", "bundle"], ["bundle", "bundle"], ["捆", "bundle"],
    ["托盘", "pallet"], ["pallet", "pallet"], ["托", "pallet"],
    ["圆柱", "cylinder"], ["圆管", "cylinder"], ["cylinder", "cylinder"], ["管", "cylinder"],
    ["异形", "irregular"], ["irregular", "irregular"], ["其他", "irregular"], ["other", "irregular"],
    ["箱", "carton"], ["box", "carton"],
  ];

  const AI_SYSTEM_PROMPT = [
    "你是外贸装柜计算助手，负责把用户提供的货物描述整理成 JSON 数据。",
    "只输出一个 JSON 数组，不要输出任何解释文字或 Markdown 代码块标记。",
    "数组中每个对象代表一种包装，可用字段：",
    "- name: 货物名称或描述（字符串，尽量保留用户原词）",
    '- packageType: 包装类型，只能是 "carton"(纸箱)、"wooden"(木箱)、"bundle"(捆包)、"pallet"(托盘)、"cylinder"(圆柱/圆管)、"irregular"(异形) 之一',
    "- length: 长，毫米数字；width: 宽，毫米数字；height: 高，毫米数字（含底座/托盘总高）",
    "- diameter: 圆柱直径，毫米数字，仅圆柱包装需要；cylinderLength: 圆柱长度，毫米数字，仅圆柱包装需要",
    "- quantity: 数量（件数，整数）",
    "- weight: 单件重量，kg 数字",
    "- stackable: 是否允许被叠放（布尔值；用户说不能叠放/不可叠时为 false，没说就省略）",
    "- topLoadKg: 该包装顶部最多能承受的重量 kg，不确定就省略",
    "- onlyBottom: 必须放柜底；onlyTop: 必须放其他包装上方。均为布尔值，不可同时为 true，不确定就省略",
    '- rotation: 旋转规则，"all"可全向翻转 / "upright"只可水平旋转 / "fixed"不可旋转，不确定就省略',
    "注意：单位统一换算成毫米和 kg（厘米×10，米×1000，吨×1000）。数量缺失时按 1 估算。",
    "长宽高按用户描述顺序合理判断，拿不准时按长≥宽≥高的常见纸箱习惯排。",
    "只输出 JSON 数组。",
  ].join("\n");

  function normalizeHeaderText(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[（(][^）)]*[)）]/g, "")
      .replace(/[\s\u3000]/g, "")
      .replace(/[-_.\/]*(mm|cms|cm|kgs|kg|毫米|厘米|千克|公斤|件|箱|个|pcs|ea)+$/g, "")
      .replace(/[-_.\/]+$/g, "");
  }

  function matchImportField(header) {
    const normalized = normalizeHeaderText(header);
    if (!normalized) {
      return null;
    }
    const table = Object.entries(IMPORT_FIELD_ALIASES);
    for (const [field, aliases] of table) {
      if (
        aliases.some(
          (alias) => normalizeHeaderText(alias) === normalized
        )
      ) {
        return field;
      }
    }
    for (const [field, aliases] of table) {
      if (
        aliases.some((alias) => {
          const normalizedAlias = normalizeHeaderText(alias);
          if (normalizedAlias.length >= 2 && normalized.includes(normalizedAlias)) {
            return true;
          }
          return (
            normalized.length >= 2 &&
            normalizedAlias.includes(normalized)
          );
        })
      ) {
        return field;
      }
    }
    return null;
  }

  function coerceNumber(value) {
    if (value === null || value === undefined || value === "") {
      return NaN;
    }
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : NaN;
    }
    const match = String(value)
      .replace(/[，\s]/g, "")
      .match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : NaN;
  }

  function coerceBool(value) {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "number") {
      return value !== 0;
    }
    const text = String(value).trim().toLowerCase();
    if (!text) {
      return undefined;
    }
    if (/(不|勿|禁|no|false|×|✗|^0$)/.test(text)) {
      return false;
    }
    if (/(可|允|是|能|yes|true|√|✓|^1$|y$)/.test(text)) {
      return true;
    }
    return undefined;
  }

  function matchPackageType(value) {
    const text = String(value ?? "").trim().toLowerCase();
    if (!text) {
      return null;
    }
    for (const [needle, type] of PACKAGE_TYPE_MATCHES) {
      if (text.includes(needle)) {
        return type;
      }
    }
    return null;
  }

  function matchRotation(value) {
    const text = String(value ?? "").trim().toLowerCase();
    if (!text) {
      return "all";
    }
    if (/不可旋转|不可翻转|不旋转|不翻转|固定|fixed/.test(text)) {
      return "fixed";
    }
    if (/水平|直立|upright|不可翻|侧放/.test(text)) {
      return "upright";
    }
    return "all";
  }

  function parseSupportRequired(value) {
    const raw = coerceNumber(value);
    if (!Number.isFinite(raw)) {
      return 1;
    }
    const ratio = raw > 1 ? raw / 100 : raw;
    return Math.min(1, Math.max(0, ratio));
  }

  function normalizeRecordKeys(entry) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return {};
    }
    const record = {};
    for (const [key, value] of Object.entries(entry)) {
      const field = matchImportField(key);
      if (field && record[field] === undefined) {
        record[field] = value;
      }
    }
    return record;
  }

  function parseSupportValue(value) {
    return parseSupportRequired(value);
  }

  function detectDelimiter(text) {
    const line = text.split(/\r?\n/).find((part) => part.trim()) || "";
    const counts = { ",": 0, ";": 0, "\t": 0 };
    let inQuotes = false;
    for (const character of line) {
      if (character === '"') {
        inQuotes = !inQuotes;
      } else if (!inQuotes && character in counts) {
        counts[character] += 1;
      }
    }
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return best && best[1] > 0 ? best[0] : ",";
  }

  function parseCsvText(text) {
    const clean = String(text || "").replace(/^\uFEFF/, "");
    const delimiter = detectDelimiter(clean);
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;

    for (let index = 0; index < clean.length; index += 1) {
      const character = clean[index];
      if (inQuotes) {
        if (character === '"') {
          if (clean[index + 1] === '"') {
            cell += '"';
            index += 1;
          } else {
            inQuotes = false;
          }
        } else {
          cell += character;
        }
      } else if (character === '"') {
        inQuotes = true;
      } else if (character === delimiter) {
        row.push(cell);
        cell = "";
      } else if (character === "\n") {
        row.push(cell);
        cell = "";
        rows.push(row);
        row = [];
      } else if (character !== "\r") {
        cell += character;
      }
    }
    if (cell !== "" || row.length) {
      row.push(cell);
      rows.push(row);
    }
    return rows.filter((entry) =>
      entry.some((value) => String(value ?? "").trim() !== "")
    );
  }

  function decodeTableText(buffer) {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      try {
        return new TextDecoder("gbk").decode(buffer);
      } catch {
        return new TextDecoder("utf-8").decode(buffer);
      }
    }
  }

  async function readFileRows(file) {
    const lower = (file.name || "").toLowerCase();
    if (
      lower.endsWith(".csv") ||
      lower.endsWith(".txt") ||
      file.type === "text/csv"
    ) {
      return parseCsvText(decodeTableText(await file.arrayBuffer()));
    }
    if (typeof window.XLSX === "undefined") {
      throw new Error("表格解析组件未加载，请改用 CSV 文件或「粘贴表格」。");
    }
    const buffer = await file.arrayBuffer();
    const workbook = window.XLSX.read(buffer, { type: "array" });
    let bestSheet = null;
    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      if (!sheet) {
        continue;
      }
      const rows = window.XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: true,
        defval: "",
      });
      const scan = scanTableForHeader(rows);
      if (!scan) {
        continue;
      }
      // 优先选“数据行大多自带尺寸”的表（汇总表），再比表头命中数
      let dimRows = 0;
      for (let index = scan.headerIndex + 1; index < rows.length; index += 1) {
        const rowArray = rows[index] || [];
        const values = {};
        rowArray.forEach((cell, cellIndex) => {
          const field = scan.mapping[cellIndex];
          if (field && values[field] === undefined) {
            values[field] = cell;
          }
        });
        const hasDims = [
          "length",
          "width",
          "height",
          "diameter",
          "cylinderLength",
        ].some((field) => {
          const value = coerceNumber(values[field]);
          return Number.isFinite(value) && value > 0;
        });
        if (hasDims) {
          dimRows += 1;
        }
      }
      const dataRowCount = Math.max(1, rows.length - scan.headerIndex - 1);
      const score = (dimRows / dataRowCount) * 100 + scan.hits.size;
      if (!bestSheet || score > bestSheet.score) {
        bestSheet = { rows, score };
      }
    }
    if (!bestSheet) {
      const fallbackName = workbook.SheetNames[0];
      const fallbackRows = fallbackName
        ? window.XLSX.utils.sheet_to_json(workbook.Sheets[fallbackName], {
            header: 1,
            raw: true,
            defval: "",
          })
        : [];
      bestSheet = {
        rows: fallbackRows.map((row) =>
          (Array.isArray(row) ? row : []).map((cell) =>
            cell === null || cell === undefined ? "" : cell
          )
        ),
        score: 0,
      };
    }
    return bestSheet.rows.map((row) =>
      (Array.isArray(row) ? row : []).map((cell) =>
        cell === null || cell === undefined ? "" : cell
      )
    );
  }

  function buildRowFromRecord(record, index, unitFactor, meaning) {
    const dim = (field) => {
      const value = coerceNumber(record[field]);
      return Number.isFinite(value) ? Math.max(0, value * unitFactor) : 0;
    };
    const plain = (field) => {
      const value = coerceNumber(record[field]);
      return Number.isFinite(value) ? Math.max(0, value) : 0;
    };
    const rawPackageType = String(record.packageType ?? "").trim();
    const matchedType = matchPackageType(rawPackageType);
    let name = String(record.name ?? "").trim();
    const row = {
      id: createId(),
      sku: String(record.sku ?? "").trim(),
      name,
      packageType: matchedType || "carton",
      length: dim("length"),
      width: dim("width"),
      height: dim("height"),
      diameter: dim("diameter"),
      cylinderLength: dim("cylinderLength"),
      cylinderAxis: "length",
      clearance: dim("clearance"),
      baseHeight: 0,
      dimensionsIncludeBase: true,
      weight: plain("weight"),
      topLoadKg: plain("topLoadKg"),
      stackable: coerceBool(record.stackable) !== false,
      supportRequired: parseSupportValue(record.supportRequired),
      onlyBottom: coerceBool(record.onlyBottom) === true,
      onlyTop: coerceBool(record.onlyTop) === true,
      quantity:
        meaning === "perRow"
          ? 1
          : Math.max(1, Math.round(plain("quantity")) || 1),
      rotation: matchRotation(record.rotation),
    };

    // 装箱单里 Item 列常是纯序号：优先用第二名称列（TYPE / 描述），再用类型描述
    if ((!name || /^\d+(\.\d+)?$/.test(name)) && record.__nameAlt) {
      name = String(record.__nameAlt);
      row.name = name;
    }
    if (/^\d+(\.\d+)?$/.test(name) && rawPackageType && !matchedType) {
      name = rawPackageType;
      row.name = name;
    }
    if (!row.name) {
      row.name = row.sku || `货物 ${index + 1}`;
    }
    if (!row.sku) {
      row.sku = `SKU-${String(index + 1).padStart(3, "0")}`;
    }

    if (row.packageType === "cylinder") {
      if (!row.diameter) {
        row.diameter = Math.max(row.width, row.height);
      }
      if (!row.cylinderLength) {
        row.cylinderLength = row.length;
      }
      if (!row.diameter || !row.cylinderLength) {
        row.packageType = "carton";
        row.diameter = 0;
        row.cylinderLength = 0;
      }
    } else {
      row.diameter = 0;
      row.cylinderLength = 0;
      if (["wooden", "pallet"].includes(row.packageType)) {
        row.baseHeight = 100;
      }
    }

    return row;
  }

  function buildImportDraft(records, unitFactor, meaning) {
    let rows = [];
    const skipped = [];
    records.forEach((record) => {
      const row = buildRowFromRecord(record, rows.length, unitFactor, meaning);
      const hasDims = [
        row.length,
        row.width,
        row.height,
        row.diameter,
        row.cylinderLength,
      ].some((value) => value > 0);
      if (hasDims) {
        rows.push(row);
      } else {
        skipped.push(row.name);
      }
    });

    // 每行=1箱时，同名称同尺寸同重量的行合并为一项，箱数累加
    if (meaning === "perRow") {
      const merged = new Map();
      for (const row of rows) {
        const key = [
          row.name,
          row.packageType,
          row.length,
          row.width,
          row.height,
          row.diameter,
          row.cylinderLength,
          row.weight,
        ].join("|");
        if (merged.has(key)) {
          merged.get(key).quantity += 1;
        } else {
          merged.set(key, row);
        }
      }
      rows = [...merged.values()];
    }

    if (!rows.length) {
      throw new Error("没有识别到任何包含尺寸的货物数据。");
    }
    importDraft = rows;
    renderImportPreview(skipped, meaning);
  }

  function detectHeaderUnit(headerRow) {
    const text = (headerRow || [])
      .map((cell) => String(cell ?? "").toLowerCase())
      .join(" ");
    if (/mm|毫米/.test(text)) {
      return 1;
    }
    if (/cm|厘米/.test(text)) {
      return 10;
    }
    if (/(^|[^a-z])m([^a-z]|$)|米/.test(text)) {
      return 1000;
    }
    return null;
  }

  function scanTableForHeader(rows) {
    for (let index = 0; index < Math.min(rows.length, 12); index += 1) {
      const candidate = (rows[index] || []).map(matchImportField);
      const hits = new Set(candidate.filter(Boolean));
      const hasBox =
        hits.has("length") && hits.has("width") && hits.has("height");
      const hasPipe = hits.has("diameter") && hits.has("cylinderLength");
      if (hasBox || hasPipe) {
        return { headerIndex: index, mapping: candidate, hits };
      }
    }
    return null;
  }

  function resolveQuantityMeaning(hits) {
    const setting = elements.importQtyMeaning.value;
    if (setting === "cartons" || setting === "perRow") {
      return setting;
    }
    // 装箱单通常带 CBM/体积列且毛重为整箱重量：每行就是一箱
    return hits.has("cbm") ? "perRow" : "cartons";
  }

  function applyParsedTable(rows) {
    const scan = scanTableForHeader(rows);
    if (!scan) {
      throw new Error(
        "未找到表头行：表格需包含「长、宽、高」列（圆柱类可用「直径、圆柱长度」），建议同时提供「数量」和「单件重量」。"
      );
    }
    const { headerIndex, mapping, hits } = scan;

    const records = [];
    for (let index = headerIndex + 1; index < rows.length; index += 1) {
      const rowArray = rows[index] || [];
      if (
        !rowArray.some((cell) => String(cell ?? "").trim() !== "")
      ) {
        continue;
      }
      const record = {};
      let nameAlt = null;
      rowArray.forEach((cell, cellIndex) => {
        const field = mapping[cellIndex];
        const text = String(cell ?? "").trim();
        if (!field || text === "") {
          return;
        }
        if (record[field] === undefined) {
          record[field] = cell;
        } else if (
          (field === "name" || field === "packageType") &&
          nameAlt === null &&
          !matchPackageType(text)
        ) {
          // 同名字段的第二列（如 TYPE / Item Description）：留作名称备选
          nameAlt = text;
        }
      });
      if (nameAlt !== null) {
        record.__nameAlt = nameAlt;
      }
      records.push(record);
    }
    if (!records.length) {
      throw new Error("表头下没有数据行。");
    }
    const detected = detectHeaderUnit(rows[headerIndex]);
    const factor = detected || Number(elements.importUnit.value) || 1;
    if (detected) {
      elements.importUnit.value = String(detected);
    }
    buildImportDraft(records, factor, resolveQuantityMeaning(hits));
  }

  function renderImportPreview(skippedNames, meaning) {
    const rows = importDraft || [];
    const totalQuantity = rows.reduce(
      (sum, row) => sum + (row.quantity || 0),
      0
    );
    const totalCbm = rows.reduce((sum, row) => {
      const unitCbm =
        row.packageType === "cylinder"
          ? (Math.PI * (row.diameter / 2) ** 2 * row.cylinderLength) /
            1000000000
          : (row.length * row.width * row.height) / 1000000000;
      return sum + unitCbm * (row.quantity || 0);
    }, 0);

    elements.importTotal.hidden = false;
    elements.importTotal.textContent = `识别 ${rows.length} 项 / ${formatInteger(
      totalQuantity
    )} ${meaning === "perRow" ? "箱" : "件"} / ${formatNumber(
      totalCbm,
      3
    )} CBM${meaning === "perRow" ? "（每行按 1 箱计）" : ""}`;

    const shown = rows.slice(0, 10);
    elements.importPreviewBody.innerHTML =
      shown
        .map((row) => {
          const ok =
            row.packageType === "cylinder"
              ? row.diameter > 0 && row.cylinderLength > 0
              : row.length > 0 && row.width > 0 && row.height > 0;
          const dims =
            row.packageType === "cylinder"
              ? `⌀${Math.round(row.diameter)} × ${Math.round(
                  row.cylinderLength
                )}`
              : `${Math.round(row.length)} × ${Math.round(
                  row.width
                )} × ${Math.round(row.height)}`;
          return `
            <tr>
              <td>${ok ? "✓" : "⚠ 尺寸不全"}</td>
              <td>${escapeHtml(row.name)}</td>
              <td>${dims}</td>
              <td>${formatInteger(row.quantity)}</td>
              <td>${formatNumber(row.weight, 1)}</td>
              <td>${escapeHtml(
                PACKAGE_TYPE_LABELS[row.packageType] || "纸箱"
              )} · ${row.stackable ? "可叠" : "禁叠"}</td>
            </tr>
          `;
        })
        .join("") +
      (rows.length > shown.length
        ? `<tr><td colspan="6">… 其余 ${rows.length - shown.length} 项</td></tr>`
        : "");

    elements.importPreview.hidden = false;
    elements.importApplyButton.disabled = false;
    clearImportError();
    if (skippedNames && skippedNames.length) {
      showImportError(
        `已跳过 ${skippedNames.length} 项没有尺寸的数据：${skippedNames
          .slice(0, 3)
          .join("、")}`
      );
    }
  }

  function showImportError(message) {
    elements.importError.textContent = message;
    elements.importError.hidden = false;
  }

  function clearImportError() {
    elements.importError.hidden = true;
    elements.importError.textContent = "";
  }

  function handleImportTabClick(event) {
    const button = event.target.closest("[data-itab]");
    if (!button) {
      return;
    }
    elements.importTabs
      .querySelectorAll("[data-itab]")
      .forEach((tab) => tab.classList.toggle("active", tab === button));
    elements.importPanes.forEach((pane) => {
      pane.hidden = pane.dataset.pane !== button.dataset.itab;
    });
  }

  function openImportModal() {
    clearImportError();
    importDraft = null;
    elements.importUnit.value = "1";
    elements.importQtyMeaning.value = "auto";
    elements.importPreview.hidden = true;
    elements.importTotal.hidden = true;
    elements.importApplyButton.disabled = true;
    const config = loadAiConfig();
    if (!elements.aiEndpoint.value) {
      elements.aiEndpoint.value = config.endpoint;
    }
    if (!elements.aiModel.value) {
      elements.aiModel.value = config.model;
    }
    if (!elements.aiKey.value && config.key) {
      elements.aiKey.value = config.key;
    }
    elements.importModal.hidden = false;
  }

  function closeImportModal() {
    elements.importModal.hidden = true;
  }

  async function handleImportFile(event) {
    event.preventDefault();
    const files =
      (event.dataTransfer && event.dataTransfer.files) ||
      (event.target && event.target.files);
    const file = files && files[0];
    if (!file) {
      return;
    }
    clearImportError();
    try {
      const rows = await readFileRows(file);
      applyParsedTable(rows);
    } catch (error) {
      showImportError(error.message || "文件解析失败。");
    } finally {
      elements.importFileInput.value = "";
    }
  }

  function handlePasteParse() {
    clearImportError();
    const text = elements.pasteArea.value.trim();
    if (!text) {
      showImportError("请先粘贴表格文本。");
      return;
    }
    try {
      applyParsedTable(parseCsvText(text));
    } catch (error) {
      showImportError(error.message || "文本解析失败。");
    }
  }

  async function handleClipboardParse() {
    clearImportError();
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        throw new Error("unsupported");
      }
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        showImportError("剪贴板是空的。请先在 Excel 里选中表头和数据，按 Ctrl+C 复制。");
        return;
      }
      elements.pasteArea.value = text.trim();
      handlePasteParse();
    } catch {
      showImportError(
        "无法读取剪贴板（浏览器未授权或不支持）。请在文本框里按 Ctrl+V 粘贴后点「解析文本」。"
      );
    }
  }

  function loadAiConfig() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(AI_STORAGE_KEY) || "null"
      );
      return { ...AI_DEFAULTS, ...(saved || {}) };
    } catch {
      return { ...AI_DEFAULTS };
    }
  }

  function saveAiConfig(config) {
    try {
      localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(config));
    } catch {
      // Local storage can be unavailable in strict file:// contexts.
    }
  }

  function extractJsonArray(text) {
    const raw = String(text || "").trim();
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const body = fenced ? fenced[1] : raw;
    const start = body.indexOf("[");
    const end = body.lastIndexOf("]");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("大模型没有返回有效的 JSON 数据。");
    }
    const parsed = JSON.parse(body.slice(start, end + 1));
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (parsed && typeof parsed === "object") {
      for (const key of ["items", "data", "list", "rows", "goods", "cargo"]) {
        if (Array.isArray(parsed[key])) {
          return parsed[key];
        }
      }
    }
    throw new Error("大模型返回的内容不是货物数组。");
  }

  async function runAiImport() {
    const text = elements.aiTextArea.value.trim();
    if (!text) {
      showImportError("请先粘贴需要整理的货物描述或表格文本。");
      return;
    }
    const config = {
      endpoint: elements.aiEndpoint.value.trim() || AI_DEFAULTS.endpoint,
      model: elements.aiModel.value.trim() || AI_DEFAULTS.model,
      key: elements.aiKey.value.trim(),
    };
    saveAiConfig(config);
    if (!config.key) {
      showImportError(
        "请先填写 API Key（智谱开放平台、DeepSeek 等平台可免费申请）。"
      );
      return;
    }
    if (!/^https?:\/\//i.test(config.endpoint)) {
      showImportError("接口地址需以 http(s):// 开头。");
      return;
    }

    clearImportError();
    elements.aiParseButton.disabled = true;
    const originalLabel = elements.aiParseButton.textContent;
    elements.aiParseButton.textContent = "大模型解析中…";

    try {
      const response = await fetch(config.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.key}`,
        },
        body: JSON.stringify({
          model: config.model,
          temperature: 0.1,
          messages: [
            { role: "system", content: AI_SYSTEM_PROMPT },
            { role: "user", content: text },
          ],
        }),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(
          `接口返回 ${response.status}${detail ? "：" + detail.slice(0, 260) : ""}`
        );
      }
      const data = await response.json();
      const content =
        (data.choices &&
          data.choices[0] &&
          data.choices[0].message &&
          data.choices[0].message.content) ||
        (data.choices && data.choices[0] && data.choices[0].text) ||
        (data.output && data.output.text);
      if (!content) {
        throw new Error("接口响应中没有对话内容。");
      }
      const records = extractJsonArray(content).map(normalizeRecordKeys);
      buildImportDraft(records, Number(elements.importUnit.value) || 1);
    } catch (error) {
      showImportError(
        `AI 解析失败：${
          error && error.message ? error.message : "网络或接口错误"
        }。若为浏览器跨域(CORS)限制，请更换支持跨域的接口地址，或改用「粘贴表格」导入。`
      );
    } finally {
      elements.aiParseButton.disabled = false;
      elements.aiParseButton.textContent = originalLabel;
    }
  }

  function applyImport() {
    if (!importDraft || !importDraft.length) {
      return;
    }
    const incoming = importDraft.map((row) => ({ ...row }));
    state.rows =
      elements.importMode.value === "append"
        ? [...state.rows, ...incoming]
        : incoming;
    importDraft = null;
    renderCargoRows();
    saveState();
    closeImportModal();
    showToast(`已导入 ${incoming.length} 项货物，开始计算装柜方案。`);
    calculate();
  }

  function buildListAoa() {
    const aoa = [TEMPLATE_HEAD];
    collectRows().forEach((row) => {
      aoa.push([
        row.sku,
        row.name,
        PACKAGE_TYPE_LABELS[row.packageType] || "纸箱",
        row.length,
        row.width,
        row.height,
        row.quantity,
        row.weight,
        row.stackable ? "是" : "否",
        row.topLoadKg || "",
        ROTATION_LABELS[row.rotation] || "可全向翻转",
        row.onlyBottom ? "是" : "否",
        row.onlyTop ? "是" : "否",
      ]);
    });
    return aoa;
  }

  function downloadAoa(aoa, filename) {
    if (typeof window.XLSX !== "undefined" && window.XLSX.writeFile) {
      const sheet = window.XLSX.utils.aoa_to_sheet(aoa);
      sheet["!cols"] = aoa[0].map(() => ({ wch: 14 }));
      const book = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(book, sheet, "装柜清单");
      window.XLSX.writeFile(book, filename);
      return;
    }
    const csv = aoa
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = filename.replace(/\.xlsx$/, ".csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function downloadTemplate() {
    downloadAoa(
      [
        TEMPLATE_HEAD,
        ["A001", "纸箱A", "纸箱", 600, 400, 400, 300, 12, "是", 50, "可全向翻转"],
        ["A002", "纸箱B", "纸箱", 800, 600, 500, 120, 25, "是", "", "只可水平旋转"],
        ["B001", "配件木箱", "木箱", 1200, 1000, 900, 40, 180, "否", "", "不可旋转"],
      ],
      "装柜清单模板.xlsx"
    );
  }

  function exportCargoList() {
    downloadAoa(buildListAoa(), "装柜货物清单.xlsx");
    showToast("清单已导出，编辑后可通过「导入清单」重新导入。");
  }

  function bindEvents() {
    elements.containerSelect.addEventListener("change", handleContainerSelect);
    elements.planMode.addEventListener("change", handlePlanModeChange);
    [
      elements.mixBigCount,
      elements.smallWidth,
      elements.smallLength,
      elements.smallHeight,
      elements.smallPayload,
      elements.autoGroupInput,
    ].forEach((input) => input.addEventListener("input", handleMixInput));
    elements.autoGroupInput.addEventListener("change", handleMixInput);
    [
      elements.containerWidth,
      elements.containerLength,
      elements.containerHeight,
      elements.containerPayload,
      elements.longCargoWidthColumns,
      elements.longCargoLengthPositions,
      elements.longCargoMaxLayers,
      elements.longCargoAllowed,
      elements.allowStacking,
      elements.defaultTopLoadKg,
    ].forEach((input) => input.addEventListener("input", handleContainerInput));
    elements.longCargoAllowed.addEventListener(
      "change",
      handleContainerInput
    );
    elements.allowStacking.addEventListener(
      "change",
      handleContainerInput
    );
    elements.cargoRows.addEventListener("input", handleCargoInput);
    elements.cargoRows.addEventListener("change", handleCargoInput);
    elements.cargoRows.addEventListener("click", handleCargoClick);
    elements.addCargoButton.addEventListener("click", addCargoRow);
    elements.importListButton.addEventListener("click", openImportModal);
    elements.exportListButton.addEventListener("click", exportCargoList);
    elements.downloadTemplateButton.addEventListener("click", downloadTemplate);
    elements.importCloseButton.addEventListener("click", closeImportModal);
    elements.importCancelButton.addEventListener("click", closeImportModal);
    elements.importApplyButton.addEventListener("click", applyImport);
    elements.importTabs.addEventListener("click", handleImportTabClick);
    elements.importFileInput.addEventListener("change", handleImportFile);
    elements.dropZone.addEventListener("click", () =>
      elements.importFileInput.click()
    );
    elements.dropZone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        elements.importFileInput.click();
      }
    });
    ["dragenter", "dragover"].forEach((type) =>
      elements.dropZone.addEventListener(type, (event) => {
        event.preventDefault();
        elements.dropZone.classList.add("dragover");
      })
    );
    elements.dropZone.addEventListener("dragleave", () => {
      elements.dropZone.classList.remove("dragover");
    });
    // 全页拖入：文件落到页面任何位置都能导入，也避免浏览器直接打开文件
    ["dragover", "drop"].forEach((type) =>
      document.addEventListener(type, (event) => {
        event.preventDefault();
        if (type === "drop") {
          elements.dropZone.classList.remove("dragover");
          if (elements.importModal.hidden) {
            openImportModal();
          }
          handleImportFile(event);
        }
      })
    );
    elements.parsePasteButton.addEventListener("click", handlePasteParse);
    elements.clipboardButton.addEventListener("click", handleClipboardParse);
    elements.aiParseButton.addEventListener("click", runAiImport);
    elements.importModal.addEventListener("click", (event) => {
      if (event.target === elements.importModal) {
        closeImportModal();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !elements.importModal.hidden) {
        closeImportModal();
      }
    });
    elements.calculateButton.addEventListener("click", calculate);
    elements.installButton.addEventListener("click", installApp);
    elements.shareButton.addEventListener("click", sharePlan);
    elements.resetButton.addEventListener("click", resetApp);
    elements.exportButton.addEventListener("click", exportCsv);
    elements.printButton.addEventListener("click", () => window.print());
    elements.containerTabs.addEventListener("click", handleTabClick);
    elements.viewResetButton.addEventListener("click", () =>
      renderer.setView(state.viewMode)
    );
    elements.fullscreenButton.addEventListener("click", () => {
      if (!document.fullscreenElement) {
        elements.canvasWrap.requestFullscreen().catch(() => {
          showToast("当前浏览器未允许全屏。");
        });
      } else {
        document.exitFullscreen();
      }
    });
    elements.viewSwitch.addEventListener("click", (event) => {
      const button = event.target.closest("[data-view]");
      if (!button) {
        return;
      }
      state.viewMode = button.dataset.view;
      renderer.setView(state.viewMode);
      saveState();
    });
    document.addEventListener("fullscreenchange", () => {
      window.setTimeout(() => renderer.resize(), 80);
    });
    window.addEventListener("resize", () => {
      renderer.resize();
    });
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      elements.installButton.hidden = false;
    });
    window.addEventListener("appinstalled", () => {
      deferredInstallPrompt = null;
      elements.installButton.hidden = true;
      showToast("柜满载已安装到当前设备。");
    });
  }

  function init() {
    setContainerInputs();
    renderCargoRows();
    bindEvents();
    renderer = new ContainerRenderer(
      elements.canvas,
      elements.canvasWrap,
      elements.viewAngle
    );
    renderer.setView(state.viewMode || "iso");
    showEmpty();

    // A first calculation makes the initial screen immediately useful.
    calculate();
    if (openedSharedPlan) {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`
      );
      saveState();
      showToast("已打开分享方案，可继续修改或重新计算。");
    }
    registerServiceWorker();
    window.setTimeout(() => renderer.resize(), 180);
  }

  init();
})();
