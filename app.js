(function () {
  "use strict";

  const { CONTAINERS, planLoad } = window.ContainerPacking;
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
    supportRequired: 1,
    onlyBottom: false,
    quantity: 1000,
    rotation: "all",
  };

  const elements = {
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
    containerState: document.querySelector("#containerState"),
    cargoRows: document.querySelector("#cargoRows"),
    cargoCount: document.querySelector("#cargoCount"),
    cargoEstimate: document.querySelector("#cargoEstimate"),
    addCargoButton: document.querySelector("#addCargoButton"),
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
    elements.containerState.textContent =
      state.container.id === "custom" ? "自定义" : state.container.name;
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

    if (["onlyBottom", "dimensionsIncludeBase"].includes(field)) {
      row[field] = input.checked;
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

  function handleContainerInput(event) {
    state.container = {
      ...state.container,
      id: "custom",
      name: "自定义",
      description: "自定义柜型",
      width: numberValue(elements.containerWidth.value, 0),
      length: numberValue(elements.containerLength.value, 0),
      height: numberValue(elements.containerHeight.value, 0),
      payload: numberValue(elements.containerPayload.value, 0),
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
    };
    elements.containerSelect.value = "custom";
    elements.containerState.textContent = "自定义";
    saveState();
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
      supportRequired: numberValue(row.supportRequired, 1),
      onlyBottom: Boolean(row.onlyBottom),
      quantity: numberValue(row.quantity, 0),
      rotation: row.rotation || "all",
      colorIndex: index % COLORS.length,
    }));
  }

  function calculate() {
    const rows = collectRows();
    const result = planLoad(rows, state.container);
    state.result = result;
    state.activeTab = 0;
    saveState();

    if (!result.ok) {
      renderError(result);
      return;
    }

    renderResult(result);
    showToast(
      `${result.totals.containers} 个${result.container.name}可装载全部货物。`
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
    elements.resultTitle.textContent = `${result.container.name} 装柜结果`;
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
          }">第 ${container.index} 柜</button>
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
    elements.visualTitle.textContent = `第 ${container.index} 柜`;
    elements.summaryTitle.textContent = `第 ${container.index} 柜明细`;
    elements.containerUnits.textContent = formatInteger(
      container.placements.length
    );
    elements.containerVolumeRate.textContent = percent(
      container.volumeUtilization
    );
    elements.containerWeightRate.textContent = percent(
      container.weightUtilization
    );
    elements.detailScope.textContent = `第 ${container.index} 柜 / 共 ${result.containers.length} 柜`;

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
            <td>第 ${container.index} 柜</td>
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
      renderer.setContainer(container, result.container);
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
          `第 ${container.index} 柜`,
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
    link.download = `${state.result.container.name}-装柜方案.csv`;
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

  function bindEvents() {
    elements.containerSelect.addEventListener("change", handleContainerSelect);
    [
      elements.containerWidth,
      elements.containerLength,
      elements.containerHeight,
      elements.containerPayload,
      elements.longCargoWidthColumns,
      elements.longCargoLengthPositions,
      elements.longCargoMaxLayers,
      elements.longCargoAllowed,
    ].forEach((input) => input.addEventListener("input", handleContainerInput));
    elements.longCargoAllowed.addEventListener(
      "change",
      handleContainerInput
    );
    elements.cargoRows.addEventListener("input", handleCargoInput);
    elements.cargoRows.addEventListener("change", handleCargoInput);
    elements.cargoRows.addEventListener("click", handleCargoClick);
    elements.addCargoButton.addEventListener("click", addCargoRow);
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
