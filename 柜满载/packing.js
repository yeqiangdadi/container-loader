(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.ContainerPacking = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CONTAINERS = {
    "20GP": {
      id: "20GP",
      name: "20GP",
      description: "20 英尺标准柜",
      width: 2352,
      length: 5898,
      height: 2393,
      payload: 28200,
    },
    "40GP": {
      id: "40GP",
      name: "40GP",
      description: "40 英尺标准柜",
      width: 2352,
      length: 12032,
      height: 2393,
      payload: 28800,
    },
    "40HQ": {
      id: "40HQ",
      name: "40HQ",
      description: "40 英尺高柜",
      width: 2352,
      length: 12032,
      height: 2698,
      payload: 28600,
    },
    "45HQ": {
      id: "45HQ",
      name: "45HQ",
      description: "45 英尺高柜",
      width: 2352,
      length: 13556,
      height: 2698,
      payload: 27600,
    },
  };

  const STRATEGIES = [
    { id: "best-fit", volumeWeight: 0.25, efficiencyWeight: 0.75 },
    { id: "volume-first", volumeWeight: 0.7, efficiencyWeight: 0.3 },
    { id: "efficiency-first", volumeWeight: 0.05, efficiencyWeight: 0.95 },
    { id: "height-first", volumeWeight: 0.45, efficiencyWeight: 0.55 },
  ];

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function round(value, digits) {
    const factor = 10 ** (digits || 0);
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }

  function uniqueOrientations(item) {
    const base = [item.length, item.width, item.height].map((value) =>
      Math.max(1, Number(value) || 1)
    );
    const mode = item.rotation || "all";
    const candidates =
      mode === "fixed"
        ? [[base[0], base[1], base[2]]]
        : mode === "upright"
          ? [
              [base[0], base[1], base[2]],
              [base[1], base[0], base[2]],
            ]
          : [
              [base[0], base[1], base[2]],
              [base[0], base[2], base[1]],
              [base[1], base[0], base[2]],
              [base[1], base[2], base[0]],
              [base[2], base[0], base[1]],
              [base[2], base[1], base[0]],
            ];

    const seen = new Set();
    return candidates.filter((orientation) => {
      const key = orientation.join("x");
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  function createSpace(x, y, z, dx, dy, dz) {
    return { x, y, z, dx, dy, dz };
  }

  function isSpaceValid(space, epsilon) {
    const tolerance = epsilon || 0.01;
    return (
      space.dx > tolerance &&
      space.dy > tolerance &&
      space.dz > tolerance
    );
  }

  function containsSpace(outer, inner, epsilon) {
    const tolerance = epsilon || 0.01;
    return (
      outer.x <= inner.x + tolerance &&
      outer.y <= inner.y + tolerance &&
      outer.z <= inner.z + tolerance &&
      outer.x + outer.dx >= inner.x + inner.dx - tolerance &&
      outer.y + outer.dy >= inner.y + inner.dy - tolerance &&
      outer.z + outer.dz >= inner.z + inner.dz - tolerance
    );
  }

  function dedupeAndPruneSpaces(spaces) {
    const valid = spaces.filter((space) => isSpaceValid(space));
    const unique = [];
    const seen = new Set();

    for (const space of valid) {
      const key = [space.x, space.y, space.z, space.dx, space.dy, space.dz]
        .map((value) => round(value, 3))
        .join("|");
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(space);
      }
    }

    return unique
      .filter(
        (space, index) =>
          !unique.some(
            (candidate, candidateIndex) =>
              candidateIndex !== index && containsSpace(candidate, space)
          )
      )
      .sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x);
  }

  function splitSpace(space, occupied) {
    const result = [];
    const rightWidth = space.dx - occupied.dx;
    const frontDepth = space.dy - occupied.dy;
    const topHeight = space.dz - occupied.dz;

    if (rightWidth > 0.01) {
      result.push(
        createSpace(
          space.x + occupied.dx,
          space.y,
          space.z,
          rightWidth,
          occupied.dy,
          occupied.dz
        )
      );
    }

    if (frontDepth > 0.01) {
      result.push(
        createSpace(
          space.x,
          space.y + occupied.dy,
          space.z,
          occupied.dx,
          frontDepth,
          occupied.dz
        )
      );
    }

    if (topHeight > 0.01) {
      result.push(
        createSpace(
          space.x,
          space.y,
          space.z + occupied.dz,
          space.dx,
          space.dy,
          topHeight
        )
      );
    }

    return result;
  }

  function countFits(space, orientation) {
    return {
      x: Math.floor((space.dx + 0.001) / orientation[0]),
      y: Math.floor((space.dy + 0.001) / orientation[1]),
      z: Math.floor((space.dz + 0.001) / orientation[2]),
    };
  }

  function calculateUsedExtent(capacity, count) {
    const perLayer = capacity.x * capacity.y;
    const fullLayers = Math.floor(count / perLayer);
    const remainder = count % perLayer;
    const usedZ = fullLayers + (remainder > 0 ? 1 : 0);
    const usedY =
      fullLayers > 0 ? capacity.y : Math.min(capacity.y, Math.ceil(remainder / capacity.x));
    const finalLine = remainder % capacity.x;
    const usedX =
      fullLayers > 0 || remainder >= capacity.x
        ? capacity.x
        : finalLine;
    return {
      x: Math.max(0, usedX),
      y: Math.max(0, usedY),
      z: Math.max(0, usedZ),
    };
  }

  function createGridPlacements(item, space, orientation, capacity, limit) {
    const capacityCount = capacity.x * capacity.y * capacity.z;
    const count = Math.min(capacityCount, Math.max(0, Number(limit) || 0));
    const [unitX, unitY, unitZ] = orientation;
    const placements = [];
    let usedX = 0;
    let usedY = 0;
    let usedZ = 0;
    let remaining = count;

    for (let z = 0; z < capacity.z && remaining > 0; z += 1) {
      for (let y = 0; y < capacity.y && remaining > 0; y += 1) {
        for (let x = 0; x < capacity.x && remaining > 0; x += 1) {
          placements.push({
            itemId: item.id,
            name: item.name,
            x: space.x + x * unitX,
            y: space.y + y * unitY,
            z: space.z + z * unitZ,
            dx: unitX,
            dy: unitY,
            dz: unitZ,
            weight: Number(item.weight) || 0,
            colorIndex: Number(item.colorIndex) || 0,
          });
          usedX = Math.max(usedX, (x + 1) * unitX);
          usedY = Math.max(usedY, (y + 1) * unitY);
          usedZ = Math.max(usedZ, (z + 1) * unitZ);
          remaining -= 1;
        }
      }
    }

    return {
      placements,
      occupied: createSpace(space.x, space.y, space.z, usedX, usedY, usedZ),
    };
  }

  function candidateForSpace(item, remainingCount, space, placedWeight, payload) {
    const unitVolume =
      item.length * item.width * item.height;
    const unitWeight = Math.max(0, Number(item.weight) || 0);
    let best = null;

    for (const orientation of uniqueOrientations(item)) {
      const capacity = countFits(space, orientation);
      let layers = capacity.z;

      if (!item.stackable) {
        if (space.z > 0.01) {
          continue;
        }
        layers = Math.min(layers, 1);
      }

      if (capacity.x < 1 || capacity.y < 1 || layers < 1) {
        continue;
      }

      const unitsPerLayer = capacity.x * capacity.y;
      if (unitWeight > 0) {
        const availableWeight = Math.max(0, payload - placedWeight);
        const weightLayers = Math.floor(
          (availableWeight + 0.0001) / (unitWeight * unitsPerLayer)
        );
        layers = Math.min(layers, weightLayers);
      }

      if (layers < 1) {
        continue;
      }

      const capacityCount = capacity.x * capacity.y * layers;
      const count = Math.min(capacityCount, remainingCount);
      if (count < 1) {
        continue;
      }

      const used = calculateUsedExtent(capacity, count);
      const occupied = createSpace(
        space.x,
        space.y,
        space.z,
        used.x * orientation[0],
        used.y * orientation[1],
        used.z * orientation[2]
      );

      const occupiedVolume = count * unitVolume;
      const boundingVolume =
        occupied.dx * occupied.dy * occupied.dz || occupiedVolume;
      const spaceVolume = space.dx * space.dy * space.dz;
      const gridEfficiency = occupiedVolume / spaceVolume;
      const itemEfficiency =
        boundingVolume > 0 ? occupiedVolume / boundingVolume : 0;
      const volumeScore = occupiedVolume / 1000000000;
      const efficiencyScore =
        gridEfficiency * 0.55 + itemEfficiency * 0.45;

      const candidate = {
        item,
        space,
        orientation,
        capacity,
        count,
        occupied,
        unitVolume,
        unitWeight,
        volumeScore,
        efficiencyScore,
        score:
          volumeScore * 0.7 +
          efficiencyScore * 0.3 -
          space.z / 1000000 -
          space.y / 100000000,
      };

      if (!best || candidate.score > best.score) {
        best = candidate;
      }
    }

    return best;
  }

  function chooseCandidate(candidates, strategy) {
    if (!candidates.length) {
      return null;
    }
    return candidates.reduce((best, candidate) => {
      const candidateScore =
        candidate.volumeScore * strategy.volumeWeight +
        candidate.efficiencyScore * strategy.efficiencyWeight -
        candidate.occupied.z / 1000000 -
        candidate.occupied.y / 100000000;
      const bestScore =
        best.volumeScore * strategy.volumeWeight +
        best.efficiencyScore * strategy.efficiencyWeight -
        best.occupied.z / 1000000 -
        best.occupied.y / 100000000;
      return candidateScore > bestScore ? candidate : best;
    });
  }

  function packContainerAttempt(remainingById, itemsById, container, strategy) {
    const spaces = [
      createSpace(0, 0, 0, container.width, container.length, container.height),
    ];
    const placements = [];
    let placedWeight = 0;

    while (spaces.length) {
      const candidates = [];

      for (const space of spaces) {
        for (const item of Object.values(itemsById)) {
          const remainingCount = remainingById[item.id] || 0;
          if (remainingCount < 1) {
            continue;
          }
          const candidate = candidateForSpace(
            item,
            remainingCount,
            space,
            placedWeight,
            container.payload
          );
          if (candidate) {
            candidates.push(candidate);
          }
        }
      }

      const selected = chooseCandidate(candidates, strategy);
      if (!selected) {
        break;
      }

      const generated = createGridPlacements(
        selected.item,
        selected.space,
        selected.orientation,
        selected.capacity,
        selected.count
      );

      placements.push(...generated.placements);
      placedWeight += generated.placements.reduce(
        (sum, placement) => sum + placement.weight,
        0
      );
      remainingById[selected.item.id] =
        (remainingById[selected.item.id] || 0) - generated.placements.length;

      const remainingSpaces = spaces.filter(
        (space) => space !== selected.space
      );
      if (selected.space) {
        remainingSpaces.push(...splitSpace(selected.space, generated.occupied));
      } else {
        const selectedIndex = spaces.indexOf(selected.space);
        if (selectedIndex >= 0) {
          remainingSpaces.splice(selectedIndex, 1);
          remainingSpaces.push(
            ...splitSpace(selected.space, generated.occupied)
          );
        }
      }
      spaces.length = 0;
      spaces.push(...dedupeAndPruneSpaces(remainingSpaces));
    }

    const volume = placements.reduce(
      (sum, placement) => sum + placement.dx * placement.dy * placement.dz,
      0
    );
    const containerVolume =
      container.width * container.length * container.height;

    return {
      strategy: strategy.id,
      placements,
      weight: placedWeight,
      volume,
      volumeUtilization: containerVolume ? volume / containerVolume : 0,
      weightUtilization: container.payload
        ? placedWeight / container.payload
        : 0,
    };
  }

  function compactRemaining(remainingById) {
    return Object.fromEntries(
      Object.entries(remainingById)
        .filter(([, value]) => value > 0)
        .map(([key, value]) => [key, value])
    );
  }

  function packOneContainer(remainingById, itemsById, container) {
    let best = null;

    for (const strategy of STRATEGIES) {
      const attemptRemaining = { ...remainingById };
      const attempt = packContainerAttempt(
        attemptRemaining,
        itemsById,
        container,
        strategy
      );

      if (!attempt.placements.length) {
        continue;
      }

      const attemptScore =
        attempt.volume * 0.8 +
        attempt.volumeUtilization *
          container.width *
          container.length *
          container.height *
          0.2;

      if (!best || attemptScore > best.score) {
        best = {
          ...attempt,
          score: attemptScore,
          remainingById: compactRemaining(attemptRemaining),
        };
      }
    }

    return best;
  }

  function summarizePlacements(placements, itemsById) {
    const byItem = {};
    for (const placement of placements) {
      if (!byItem[placement.itemId]) {
        byItem[placement.itemId] = {
          itemId: placement.itemId,
          name: placement.name,
          count: 0,
          volume: 0,
          weight: 0,
          orientations: new Set(),
        };
      }
      const entry = byItem[placement.itemId];
      entry.count += 1;
      entry.volume += placement.dx * placement.dy * placement.dz;
      entry.weight += placement.weight;
      entry.orientations.add(
        [placement.dx, placement.dy, placement.dz].join("x")
      );
    }

    return Object.values(byItem).map((entry) => {
      const orientations = Array.from(entry.orientations).map((value) =>
        value.split("x").map(Number)
      );
      const item = itemsById[entry.itemId];
      return {
        ...entry,
        orientations,
        orientation:
          orientations.length === 1
            ? `${orientations[0].join(" × ")} mm`
            : `${orientations.length} 种摆法`,
        cbm: entry.volume / 1000000000,
        sku: item ? item.sku : "",
      };
    });
  }

  function normalizeItems(items) {
    return items.map((item, index) => {
      const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0));
      return {
        id: String(item.id || `item-${index + 1}`),
        sku: String(item.sku || ""),
        name: String(item.name || `货物 ${index + 1}`),
        length: Math.max(1, Number(item.length) || 0),
        width: Math.max(1, Number(item.width) || 0),
        height: Math.max(1, Number(item.height) || 0),
        weight: Math.max(0, Number(item.weight) || 0),
        quantity,
        stackable: item.stackable !== false,
        rotation: item.rotation || "all",
        colorIndex: index % 8,
      };
    });
  }

  function validateInput(items, container) {
    const errors = [];
    if (!container || !container.width || !container.length || !container.height) {
      errors.push("请填写完整的柜内尺寸。");
    }
    if (!items.length) {
      errors.push("请至少添加一项货物。");
    }

    items.forEach((item, index) => {
      const label = item.name || `第 ${index + 1} 项货物`;
      if (!item.length || !item.width || !item.height) {
        errors.push(`${label} 的纸箱尺寸必须大于 0。`);
      }
      if (item.quantity < 1) {
        errors.push(`${label} 的数量必须大于 0。`);
      }
      const fitsAnyOrientation = uniqueOrientations(item).some(
        (orientation) =>
          orientation[0] <= container.width &&
          orientation[1] <= container.length &&
          orientation[2] <= container.height
      );
      if (!fitsAnyOrientation) {
        errors.push(`${label} 的尺寸可能无法放入当前柜型。`);
      }
    });

    return errors;
  }

  function planLoad(rawItems, rawContainer) {
    const items = normalizeItems(rawItems);
    const container = {
      ...rawContainer,
      width: Math.max(1, Number(rawContainer.width) || 0),
      length: Math.max(1, Number(rawContainer.length) || 0),
      height: Math.max(1, Number(rawContainer.height) || 0),
      payload: Math.max(0, Number(rawContainer.payload) || 0),
    };
    const errors = validateInput(items, container);

    if (errors.length) {
      return { ok: false, errors, containers: [], items };
    }

    const itemsById = Object.fromEntries(items.map((item) => [item.id, item]));
    let remainingById = Object.fromEntries(
      items.map((item) => [item.id, item.quantity])
    );
    const containers = [];
    const maxContainers = 100;
    let safety = 0;

    while (
      Object.values(remainingById).some((value) => value > 0) &&
      containers.length < maxContainers
    ) {
      safety += 1;
      if (safety > maxContainers + 2) {
        break;
      }

      const result = packOneContainer(
        remainingById,
        itemsById,
        container
      );
      if (!result || !result.placements.length) {
        break;
      }

      containers.push({
        index: containers.length + 1,
        placements: result.placements,
        summary: summarizePlacements(result.placements, itemsById),
        weight: result.weight,
        volume: result.volume,
        cbm: result.volume / 1000000000,
        volumeUtilization: result.volumeUtilization,
        weightUtilization: result.weightUtilization,
        strategy: result.strategy,
      });
      remainingById = result.remainingById;
    }

    const unloaded = items
      .map((item) => ({
        itemId: item.id,
        name: item.name,
        sku: item.sku,
        count: remainingById[item.id] || 0,
      }))
      .filter((item) => item.count > 0);

    if (!containers.length || unloaded.length) {
      const reasons = [];
      if (!containers.length) {
        reasons.push("当前条件下没有任何货物可以装入。");
      } else {
        reasons.push(
          `仍有 ${unloaded.reduce(
            (sum, item) => sum + item.count,
            0
          )} 件货物未能装载，请检查重量、旋转或叠放限制。`
        );
      }
      return {
        ok: false,
        errors: reasons,
        containers,
        items,
        unloaded,
      };
    }

    const totalUnits = containers.reduce(
      (sum, entry) => sum + entry.placements.length,
      0
    );
    const totalWeight = containers.reduce(
      (sum, entry) => sum + entry.weight,
      0
    );
    const totalVolume = containers.reduce(
      (sum, entry) => sum + entry.volume,
      0
    );
    const containerVolume =
      container.width * container.length * container.height;

    return {
      ok: true,
      errors: [],
      container,
      containers,
      items,
      unloaded: [],
      totals: {
        containers: containers.length,
        units: totalUnits,
        weight: totalWeight,
        volume: totalVolume,
        cbm: totalVolume / 1000000000,
        volumeUtilization:
          (totalVolume / (containerVolume * containers.length)) || 0,
        weightUtilization:
          totalWeight / (container.payload * containers.length) || 0,
      },
    };
  }

  return {
    CONTAINERS,
    normalizeItems,
    planLoad,
    uniqueOrientations,
  };
});
