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
      longCargoWidthColumns: 0,
      longCargoLengthPositions: 0,
      longCargoMaxLayers: 0,
    },
    "40GP": {
      id: "40GP",
      name: "40GP",
      description: "40 英尺标准柜",
      width: 2352,
      length: 12032,
      height: 2393,
      payload: 28800,
      longCargoWidthColumns: 1,
      longCargoLengthPositions: 1,
      longCargoMaxLayers: 3,
    },
    "40HQ": {
      id: "40HQ",
      name: "40HQ",
      description: "40 英尺高柜",
      width: 2352,
      length: 12032,
      height: 2698,
      payload: 28600,
      longCargoWidthColumns: 1,
      longCargoLengthPositions: 1,
      longCargoMaxLayers: 3,
    },
    "45HQ": {
      id: "45HQ",
      name: "45HQ",
      description: "45 英尺高柜",
      width: 2352,
      length: 13556,
      height: 2698,
      payload: 27600,
      longCargoWidthColumns: 1,
      longCargoLengthPositions: 1,
      longCargoMaxLayers: 3,
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
    const clearance = Math.max(0, Number(item.clearance) || 0);
    let dimensions;

    if (item.shape === "cylinder") {
      const diameter = Math.max(
        1,
        Number(item.diameter) || Number(item.width) || 1
      ) + clearance;
      const length = Math.max(
        1,
        Number(item.cylinderLength) ||
          Number(item.length) ||
          Number(item.height) ||
          1
      ) + clearance;
      if (item.cylinderAxis === "width") {
        dimensions = [length, diameter, diameter];
      } else if (item.cylinderAxis === "height") {
        dimensions = [diameter, diameter, length];
      } else {
        dimensions = [diameter, length, diameter];
      }
    } else {
      const baseExtraHeight =
        item.dimensionsIncludeBase === false
          ? Math.max(0, Number(item.baseHeight) || 0)
          : 0;
      dimensions = [
        Math.max(1, Number(item.length) || 1) + clearance,
        Math.max(1, Number(item.width) || 1) + clearance,
        Math.max(1, Number(item.height) || 1) +
          baseExtraHeight +
          clearance,
      ];
    }

    const base = dimensions;
    const mode = item.rotation || "all";
    const candidates =
      mode === "fixed"
        ? [[base[1], base[0], base[2]]]
        : mode === "upright"
          ? [
              [base[1], base[0], base[2]],
              [base[0], base[1], base[2]],
            ]
          : [
              [base[1], base[0], base[2]],
              [base[1], base[2], base[0]],
              [base[0], base[1], base[2]],
              [base[0], base[2], base[1]],
              [base[2], base[1], base[0]],
              [base[2], base[0], base[1]],
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

  function longCargoDimension(item) {
    return item.shape === "cylinder"
      ? Math.max(
          Number(item.cylinderLength) || 0,
          Number(item.length) || 0
        )
      : Math.max(
          Number(item.length) || 0,
          Number(item.width) || 0,
          Number(item.height) || 0
        );
  }

  function isLongCargo(item, container) {
    const threshold = Math.min(5500, container.length * 0.9);
    return longCargoDimension(item) >= threshold;
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
            placementId: `${item.id}-${space.x}-${space.y}-${space.z}-${placements.length}`,
            itemId: item.id,
            name: item.name,
            shape: item.shape,
            cylinderAxis: item.cylinderAxis,
            diameter: item.diameter,
            cylinderLength: item.cylinderLength,
            length: item.length,
            width: item.width,
            height: item.height,
            baseHeight:
              item.dimensionsIncludeBase === false
                ? Math.max(0, Number(item.baseHeight) || 0)
                : Math.max(
                    0,
                    Math.min(
                      Number(item.baseHeight) || 0,
                      Number(item.height) || 0
                    )
                  ),
            baseIncluded: item.dimensionsIncludeBase !== false,
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

  function candidateForSpace(
    item,
    remainingCount,
    space,
    placedWeight,
    container
  ) {
    const unitWeight = Math.max(0, Number(item.weight) || 0);
    let best = null;
    const longCargo = isLongCargo(item, container);

    if (
      longCargo &&
      (container.longCargoWidthColumns <= 0 ||
        container.longCargoMaxLayers <= 0)
    ) {
      return null;
    }

    for (const orientation of uniqueOrientations(item)) {
      const capacity = countFits(space, orientation);
      let layers = capacity.z;
      if (longCargo) {
        capacity.x = Math.min(
          capacity.x,
          Math.max(1, Number(container.longCargoWidthColumns) || 1)
        );
        capacity.y = Math.min(
          capacity.y,
          Math.max(1, Number(container.longCargoLengthPositions) || 1)
        );
        layers = Math.min(
          layers,
          Math.max(1, Number(container.longCargoMaxLayers) || 1)
        );
      }
      const requiredSupport = Math.max(
        0,
        Math.min(1, Number(item.supportRequired ?? 1))
      );
      const topLoadKg = Math.max(0, Number(item.topLoadKg) || 0);

      if (item.onlyBottom) {
        if (space.z > 0.01) {
          continue;
        }
      }

      if (
        topLoadKg <= 0 &&
        !(longCargo && container.longCargoMaxLayers > 1)
      ) {
        layers = Math.min(layers, 1);
      }

      if (unitWeight > 0 && topLoadKg > 0) {
        const selfStackLayers = 1 + Math.floor(topLoadKg / unitWeight);
        layers = Math.min(layers, selfStackLayers);
      }

      if (capacity.x < 1 || capacity.y < 1 || layers < 1) {
        continue;
      }

      const unitsPerLayer = capacity.x * capacity.y;
      if (unitWeight > 0) {
        const availableWeight = Math.max(0, container.payload - placedWeight);
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

      const unitVolume = unitVolumeForItem(item);
      const occupiedActualVolume = count * unitVolume;
      const boundingVolume =
        occupied.dx * occupied.dy * occupied.dz || occupiedActualVolume;
      const spaceVolume = space.dx * space.dy * space.dz;
      const gridEfficiency = occupiedActualVolume / spaceVolume;
      const itemEfficiency =
        boundingVolume > 0 ? occupiedActualVolume / boundingVolume : 0;
      const volumeScore = occupiedActualVolume / 1000000000;
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
        requiredSupport,
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

  function overlapArea(a, b) {
    const overlapX =
      Math.min(a.x + a.dx, b.x + b.dx) - Math.max(a.x, b.x);
    const overlapY =
      Math.min(a.y + a.dy, b.y + b.dy) - Math.max(a.y, b.y);
    if (overlapX <= 0 || overlapY <= 0) {
      return 0;
    }
    return overlapX * overlapY;
  }

  function footprintArea(placement) {
    if (placement.shape === "cylinder" && placement.cylinderAxis === "height") {
      const radius = placement.dx / 2;
      return Math.PI * radius * radius;
    }
    return placement.dx * placement.dy;
  }

  function unitVolumeForItem(item) {
    if (item.shape === "cylinder") {
      const diameter = Math.max(1, Number(item.diameter) || 1);
      const length = Math.max(
        1,
        Number(item.cylinderLength) ||
          Number(item.length) ||
          Number(item.height) ||
          1
      );
      return Math.PI * (diameter / 2) ** 2 * length;
    }
    return (
      Math.max(1, Number(item.length) || 1) *
      Math.max(1, Number(item.width) || 1) *
      (Math.max(1, Number(item.height) || 1) +
        (item.dimensionsIncludeBase === false
          ? Math.max(0, Number(item.baseHeight) || 0)
          : 0))
    );
  }

  function validateAndAssignSupports(
    newPlacements,
    existingPlacements,
    existingLoadById,
    itemsById,
    container
  ) {
    const loadById = { ...existingLoadById };
    const allPlacements = [...existingPlacements];

    for (const placement of [...newPlacements].sort(
      (a, b) => a.z - b.z || a.y - b.y || a.x - b.x
    )) {
      const item = itemsById[placement.itemId];
      const supportRequired = Math.max(
        0,
        Math.min(1, Number(item.supportRequired ?? 1))
      );
      const baseArea = footprintArea(placement);

      if (placement.z <= 0.01) {
        placement.supportItemIds = [];
        placement.supportRatio = 1;
        placement.supportDescription = "柜底";
        loadById[placement.placementId] = loadById[placement.placementId] || 0;
        allPlacements.push(placement);
        continue;
      }

      const supports = allPlacements
        .filter(
          (candidate) =>
            Math.abs(candidate.z + candidate.dz - placement.z) <= 0.01
        )
        .map((candidate) => ({
          placement: candidate,
          area: overlapArea(candidate, placement),
        }))
        .filter((entry) => entry.area > 0.01);

      const supportedArea = supports.reduce(
        (sum, entry) => sum + entry.area,
        0
      );
      const supportRatio = baseArea > 0 ? supportedArea / baseArea : 0;

      if (supportRatio + 0.001 < supportRequired) {
        return {
          ok: false,
          reason: `${placement.name || "货物"} 的底部支撑不足`,
        };
      }

      for (const support of supports) {
        const supportItem = itemsById[support.placement.itemId];
        let supportCapacity = Math.max(
          0,
          Number(supportItem.topLoadKg) || 0
        );
        if (isLongCargo(supportItem, container)) {
          supportCapacity = Math.max(supportCapacity, container.payload);
        }
        const allocatedLoad =
          (placement.weight * support.area) / Math.max(supportedArea, 1);
        const currentLoad = loadById[support.placement.placementId] || 0;

        if (
          supportCapacity <= 0 ||
          currentLoad + allocatedLoad > supportCapacity + 0.001
        ) {
          return {
            ok: false,
            reason: `${supportItem.name || "下方货物"} 的顶部承重不足`,
          };
        }

        loadById[support.placement.placementId] =
          currentLoad + allocatedLoad;
      }

      placement.supportItemIds = supports.map(
        (entry) => entry.placement.itemId
      );
      placement.supportRatio = supportRatio;
      placement.supportDescription = Array.from(
        new Set(
          supports.map(
            (entry) => entry.placement.name || "下方货物"
          )
        )
      ).join("、");
      loadById[placement.placementId] = loadById[placement.placementId] || 0;
      allPlacements.push(placement);
    }

    return { ok: true, loadById };
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

  function splitFreeRectangle(rect, placed, epsilon) {
    const tolerance = epsilon || 0.01;
    const result = [];
    const placedRight = placed.x + placed.dx;
    const placedFront = placed.y + placed.dy;
    const rectRight = rect.x + rect.dx;
    const rectFront = rect.y + rect.dy;

    if (placed.x > rect.x + tolerance) {
      result.push(
        createSpace(
          rect.x,
          rect.y,
          0,
          placed.x - rect.x,
          rect.dy,
          rect.dz
        )
      );
    }
    if (placedRight < rectRight - tolerance) {
      result.push(
        createSpace(
          placedRight,
          rect.y,
          0,
          rectRight - placedRight,
          rect.dy,
          rect.dz
        )
      );
    }
    if (placed.y > rect.y + tolerance) {
      result.push(
        createSpace(
          rect.x,
          rect.y,
          0,
          rect.dx,
          placed.y - rect.y,
          rect.dz
        )
      );
    }
    if (placedFront < rectFront - tolerance) {
      result.push(
        createSpace(
          rect.x,
          placedFront,
          0,
          rect.dx,
          rectFront - placedFront,
          rect.dz
        )
      );
    }

    return result;
  }

  function pruneFreeRectangles(rectangles) {
    const valid = dedupeAndPruneSpaces(
      rectangles.map((rect) => createSpace(rect.x, rect.y, 0, rect.dx, rect.dy, 1))
    );
    return valid.map((rect) => createSpace(rect.x, rect.y, 0, rect.dx, rect.dy, 1));
  }

  function placementFromItem(item, x, y, z, orientation) {
    return {
      placementId: `${item.id}-floor-${x}-${y}-${z}`,
      itemId: item.id,
      name: item.name,
      shape: item.shape,
      cylinderAxis: item.cylinderAxis,
      diameter: item.diameter,
      cylinderLength: item.cylinderLength,
      length: item.length,
      width: item.width,
      height: item.height,
      baseHeight:
        item.dimensionsIncludeBase === false
          ? Math.max(0, Number(item.baseHeight) || 0)
          : Math.max(
              0,
              Math.min(
                Number(item.baseHeight) || 0,
                Number(item.height) || 0
              )
            ),
      baseIncluded: item.dimensionsIncludeBase !== false,
      x,
      y,
      z,
      dx: orientation[0],
      dy: orientation[1],
      dz: orientation[2],
      weight: item.weight,
      colorIndex: item.colorIndex,
      supportItemIds: [],
      supportRatio: 1,
      supportDescription: "柜底",
    };
  }

  function expandFloorUnits(itemsById, remainingById, maxUnits) {
    const units = [];
    for (const item of Object.values(itemsById)) {
      const count = Math.min(remainingById[item.id] || 0, maxUnits - units.length);
      for (let index = 0; index < count; index += 1) {
        units.push(item);
      }
      if (units.length >= maxUnits) {
        break;
      }
    }
    return units;
  }

  function sortFloorUnits(units, strategy) {
    const sorted = [...units];
    if (strategy.id === "volume-first") {
      sorted.sort(
        (a, b) =>
          b.length * b.width * b.height -
            a.length * a.width * a.height ||
          Math.max(b.length, b.width) - Math.max(a.length, a.width)
      );
    } else if (strategy.id === "height-first") {
      sorted.sort(
        (a, b) =>
          b.height - a.height ||
          Math.max(b.length, b.width) - Math.max(a.length, a.width)
      );
    } else if (strategy.id === "efficiency-first") {
      sorted.sort(
        (a, b) =>
          Math.max(b.length, b.width) - Math.max(a.length, a.width) ||
          b.length * b.width - a.length * a.width
      );
    } else {
      sorted.sort(
        (a, b) =>
          Math.max(b.length, b.width) - Math.max(a.length, a.width) ||
          b.length * b.width * b.height - a.length * a.width * a.height
      );
    }
    return sorted;
  }

  function packFloorAttempt(
    remainingById,
    itemsById,
    container,
    strategy
  ) {
    const maxUnits = 2500;
    const units = sortFloorUnits(
      expandFloorUnits(itemsById, remainingById, maxUnits),
      strategy
    );
    if (
      container.longCargoWidthColumns <= 1 &&
      units.some((item) => isLongCargo(item, container))
    ) {
      return {
        strategy: `${strategy.id}-floor`,
        placements: [],
        weight: 0,
        volume: 0,
        volumeUtilization: 0,
        weightUtilization: 0,
      };
    }
    let freeRectangles = [
      createSpace(0, 0, 0, container.width, container.length, 1),
    ];
    const placements = [];
    let placedWeight = 0;

    for (const item of units) {
      let best = null;

      for (const rectangle of freeRectangles) {
        for (const orientation of uniqueOrientations(item)) {
          if (
            orientation[0] > rectangle.dx + 0.001 ||
            orientation[1] > rectangle.dy + 0.001 ||
            orientation[2] > container.height + 0.001
          ) {
            continue;
          }
          if (placedWeight + item.weight > container.payload + 0.001) {
            continue;
          }

          const remainingX = rectangle.dx - orientation[0];
          const remainingY = rectangle.dy - orientation[1];
          const shortSide = Math.min(remainingX, remainingY);
          const longSide = Math.max(remainingX, remainingY);
          const score =
            shortSide * 1000000 +
            longSide * 1000 +
            rectangle.y * 0.1 +
            rectangle.x * 0.01;

          if (!best || score < best.score) {
            best = {
              rectangle,
              orientation,
              score,
            };
          }
        }
      }

      if (!best) {
        continue;
      }

      const placement = placementFromItem(
        item,
        best.rectangle.x,
        best.rectangle.y,
        0,
        best.orientation
      );
      placements.push(placement);
      placedWeight += item.weight;
      remainingById[item.id] = Math.max(
        0,
        (remainingById[item.id] || 0) - 1
      );

      const nextRectangles = [];
      for (const rectangle of freeRectangles) {
        const intersects =
          placement.x < rectangle.x + rectangle.dx - 0.01 &&
          placement.x + placement.dx > rectangle.x + 0.01 &&
          placement.y < rectangle.y + rectangle.dy - 0.01 &&
          placement.y + placement.dy > rectangle.y + 0.01;
        if (intersects) {
          nextRectangles.push(
            ...splitFreeRectangle(rectangle, placement)
          );
        } else {
          nextRectangles.push(rectangle);
        }
      }
      freeRectangles = pruneFreeRectangles(nextRectangles);
    }

    const volume = placements.reduce(
      (sum, placement) =>
        sum + unitVolumeForItem(itemsById[placement.itemId]),
      0
    );
    const containerVolume =
      container.width * container.length * container.height;

    return {
      strategy: `${strategy.id}-floor`,
      placements,
      weight: placedWeight,
      volume,
      volumeUtilization: containerVolume ? volume / containerVolume : 0,
      weightUtilization: container.payload
        ? placedWeight / container.payload
        : 0,
    };
  }

  function packContainerAttempt(remainingById, itemsById, container, strategy) {
    const spaces = [
      createSpace(0, 0, 0, container.width, container.length, container.height),
    ];
    const placements = [];
    let placedWeight = 0;
    let loadById = {};
    let longLane = null;
    let longPlacedCount = 0;
    const maxLongUnits =
      Math.max(0, Number(container.longCargoWidthColumns) || 0) *
      Math.max(0, Number(container.longCargoLengthPositions) || 0) *
      Math.max(0, Number(container.longCargoMaxLayers) || 0);

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
            container
          );
          if (candidate) {
            const longCargo = isLongCargo(item, container);
            if (longCargo) {
              const remainingLongSlots = maxLongUnits - longPlacedCount;
              if (remainingLongSlots < 1) {
                continue;
              }
              candidate.count = Math.min(
                candidate.count,
                remainingLongSlots
              );
            }
            if (
              longCargo &&
              longLane &&
              (Math.abs(candidate.space.x - longLane.x) > 0.01 ||
                Math.abs(candidate.space.y - longLane.y) > 0.01)
            ) {
              continue;
            }
            const generated = createGridPlacements(
              candidate.item,
              candidate.space,
              candidate.orientation,
              candidate.capacity,
              candidate.count
            );
            const supportCheck = validateAndAssignSupports(
              generated.placements,
              placements,
              loadById,
              itemsById,
              container
            );
            if (supportCheck.ok) {
              candidates.push({
                ...candidate,
                generated,
                nextLoadById: supportCheck.loadById,
              });
            }
          }
        }
      }

      const selected = chooseCandidate(candidates, strategy);
      if (!selected) {
        break;
      }

      const generated = selected.generated;
      if (isLongCargo(selected.item, container) && !longLane) {
        const firstLongPlacement = generated.placements[0];
        longLane = {
          x: firstLongPlacement.x,
          y: firstLongPlacement.y,
          width: firstLongPlacement.dx,
        };
      }
      if (isLongCargo(selected.item, container)) {
        longPlacedCount += generated.placements.length;
      }

      placements.push(...generated.placements);
      loadById = selected.nextLoadById;
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

    const volume = placements.reduce((sum, placement) => {
      const item = itemsById[placement.itemId];
      const placementVolume =
        item ? unitVolumeForItem(item) : placement.dx * placement.dy * placement.dz;
      return sum + placementVolume;
    }, 0);
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
    const attempts = [];

    for (const strategy of STRATEGIES) {
      const attemptRemaining = { ...remainingById };
      const attempt = packContainerAttempt(
        attemptRemaining,
        itemsById,
        container,
        strategy
      );
      attempts.push({
        attempt,
        remainingById: attemptRemaining,
      });

      const floorRemaining = { ...remainingById };
      const floorAttempt = packFloorAttempt(
        floorRemaining,
        itemsById,
        container,
        strategy
      );
      attempts.push({
        attempt: floorAttempt,
        remainingById: floorRemaining,
      });
    }

    for (const entry of attempts) {
      const { attempt, remainingById: attemptRemaining } = entry;
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
          supports: new Set(),
          floorCount: 0,
        };
      }
      const entry = byItem[placement.itemId];
      entry.count += 1;
      entry.volume += placement.dx * placement.dy * placement.dz;
      entry.weight += placement.weight;
      entry.orientations.add(
        [placement.dx, placement.dy, placement.dz].join("x")
      );
      if (placement.z <= 0.01) {
        entry.floorCount += 1;
      } else if (placement.supportDescription) {
        entry.supports.add(placement.supportDescription);
      }
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
        supportDescription:
          entry.floorCount > 0 && entry.supports.size > 0
            ? `柜底 ${entry.floorCount} 件 / 叠放于 ${Array.from(
                entry.supports
              ).join("、")}`
            : entry.supports.size > 0
              ? `叠放于 ${Array.from(entry.supports).join("、")}`
              : "柜底",
        floorCount: entry.floorCount,
        shape: item ? item.shape : "box",
        cbm: entry.volume / 1000000000,
        sku: item ? item.sku : "",
      };
    });
  }

  function normalizeItems(items) {
    return items.map((item, index) => {
      const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0));
      const packageType = String(item.packageType || "carton");
      const shape =
        item.shape ||
        (packageType === "cylinder" ? "cylinder" : "box");
      return {
        id: String(item.id || `item-${index + 1}`),
        sku: String(item.sku || ""),
        name: String(item.name || `货物 ${index + 1}`),
        packageType,
        shape,
        length: Math.max(1, Number(item.length) || 0),
        width: Math.max(1, Number(item.width) || 0),
        height: Math.max(1, Number(item.height) || 0),
        diameter: Math.max(0, Number(item.diameter) || 0),
        cylinderLength: Math.max(0, Number(item.cylinderLength) || 0),
        cylinderAxis: item.cylinderAxis || "length",
        clearance: Math.max(0, Number(item.clearance) || 0),
        baseHeight: Math.max(0, Number(item.baseHeight) || 0),
        dimensionsIncludeBase: item.dimensionsIncludeBase !== false,
        weight: Math.max(0, Number(item.weight) || 0),
        topLoadKg: Math.max(0, Number(item.topLoadKg) || 0),
        supportRequired: Math.max(
          0,
          Math.min(1, Number(item.supportRequired ?? 1))
        ),
        onlyBottom: Boolean(item.onlyBottom),
        quantity,
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
      if (item.shape === "cylinder") {
        if (!item.diameter || !item.cylinderLength) {
          errors.push(`${label} 的圆柱直径和长度必须大于 0。`);
        }
      } else if (!item.length || !item.width || !item.height) {
        errors.push(`${label} 的包装尺寸必须大于 0。`);
      }
      if (item.quantity < 1) {
        errors.push(`${label} 的数量必须大于 0。`);
      }
      if (
        isLongCargo(item, container) &&
        (container.longCargoWidthColumns <= 0 ||
          container.longCargoLengthPositions <= 0 ||
          container.longCargoMaxLayers <= 0)
      ) {
        errors.push(
          `${label} 属于长管件，当前柜型设置为不允许装载长管。`
        );
        return;
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
