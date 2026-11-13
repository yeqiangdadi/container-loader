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
      allowStacking: true,
      defaultTopLoadKg: 100,
      longCargoAllowed: false,
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
      allowStacking: true,
      defaultTopLoadKg: 100,
      longCargoAllowed: true,
      longCargoWidthColumns: 0,
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
      allowStacking: true,
      defaultTopLoadKg: 100,
      longCargoAllowed: true,
      longCargoWidthColumns: 0,
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
      allowStacking: true,
      defaultTopLoadKg: 100,
      longCargoAllowed: true,
      longCargoWidthColumns: 0,
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
      const mode = item.rotation || "all";
      const alongLength = [diameter, length, diameter];
      const alongWidth = [length, diameter, diameter];
      const standing = [diameter, diameter, length];
      const axis =
        item.cylinderAxis === "height"
          ? "height"
          : item.cylinderAxis === "width"
            ? "width"
            : "length";
      let candidates;
      if (axis === "height") {
        candidates = mode === "all" ? [standing, alongLength, alongWidth] : [standing];
      } else if (axis === "width") {
        candidates =
          mode === "fixed"
            ? [alongWidth]
            : mode === "upright"
              ? [alongWidth, alongLength]
              : [alongWidth, alongLength, standing];
      } else {
        candidates =
          mode === "fixed"
            ? [alongLength]
            : mode === "upright"
              ? [alongLength, alongWidth]
              : [alongLength, alongWidth, standing];
      }
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

    let dimensions;
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

  // 最大空间法（MaxRects-3D / EB-AFIT 空间消去）：
  // 放置一个箱体后，从每一个与它相交的空闲空间里挖掉该箱体，
  // 每个相交空间最多生成 6 个残余空间。空闲空间之间允许重叠，
  // 但任何已放置的箱体不再位于任何空闲空间内，因此不会产生重叠摆放。
  function subtractBoxFromSpaces(spaces, box) {
    const next = [];
    const tolerance = 0.01;

    for (const space of spaces) {
      const ix0 = Math.max(space.x, box.x);
      const iy0 = Math.max(space.y, box.y);
      const iz0 = Math.max(space.z, box.z);
      const ix1 = Math.min(space.x + space.dx, box.x + box.dx);
      const iy1 = Math.min(space.y + space.dy, box.y + box.dy);
      const iz1 = Math.min(space.z + space.dz, box.z + box.dz);

      const intersects =
        ix1 - ix0 > tolerance &&
        iy1 - iy0 > tolerance &&
        iz1 - iz0 > tolerance;

      if (!intersects) {
        next.push(space);
        continue;
      }

      const leftWidth = box.x - space.x;
      const rightWidth = space.x + space.dx - (box.x + box.dx);
      const frontDepth = box.y - space.y;
      const backDepth = space.y + space.dy - (box.y + box.dy);
      const belowHeight = box.z - space.z;
      const aboveHeight = space.z + space.dz - (box.z + box.dz);

      if (leftWidth > tolerance) {
        next.push(
          createSpace(
            space.x,
            space.y,
            space.z,
            leftWidth,
            space.dy,
            space.dz
          )
        );
      }
      if (rightWidth > tolerance) {
        next.push(
          createSpace(
            box.x + box.dx,
            space.y,
            space.z,
            rightWidth,
            space.dy,
            space.dz
          )
        );
      }
      if (frontDepth > tolerance) {
        next.push(
          createSpace(
            space.x,
            space.y,
            space.z,
            space.dx,
            frontDepth,
            space.dz
          )
        );
      }
      if (backDepth > tolerance) {
        next.push(
          createSpace(
            space.x,
            box.y + box.dy,
            space.z,
            space.dx,
            backDepth,
            space.dz
          )
        );
      }
      if (belowHeight > tolerance) {
        next.push(
          createSpace(
            space.x,
            space.y,
            space.z,
            space.dx,
            space.dy,
            belowHeight
          )
        );
      }
      if (aboveHeight > tolerance) {
        next.push(
          createSpace(
            space.x,
            space.y,
            box.z + box.dz,
            space.dx,
            space.dy,
            aboveHeight
          )
        );
      }
    }

    return dedupeAndPruneSpaces(next);
  }

  function supportedCandidateSpaces(spaces, placements, itemsById, container) {
    if (container.allowStacking === false || !placements.length) {
      return spaces;
    }
    const result = [];
    const seen = new Set();
    const add = (space) => {
      if (!isSpaceValid(space)) {
        return;
      }
      const key = [space.x, space.y, space.z, space.dx, space.dy, space.dz]
        .map((value) => round(value, 3))
        .join("|");
      if (!seen.has(key)) {
        seen.add(key);
        result.push(space);
      }
    };
    const supports = placements.filter(
      (placement) => itemsById[placement.itemId].stackable !== false
    );

    for (const space of spaces) {
      add(space);
      for (const support of supports) {
        const z = support.z + support.dz;
        if (z < space.z - 0.01 || z >= space.z + space.dz - 0.01) {
          continue;
        }
        const x = Math.max(space.x, support.x);
        const y = Math.max(space.y, support.y);
        const right = Math.min(space.x + space.dx, support.x + support.dx);
        const front = Math.min(space.y + space.dy, support.y + support.dy);
        if (right <= x + 0.01 || front <= y + 0.01) {
          continue;
        }
        const height = space.z + space.dz - z;
        add(createSpace(x, y, z, space.x + space.dx - x, space.y + space.dy - y, height));
        add(createSpace(x, y, z, right - x, front - y, height));
      }
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
            cylinderAxis: cylinderAxisFromOrientation(item, orientation),
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
    container,
    acceptCandidate = (candidate) => candidate
  ) {
    if (
      (item.onlyTop && space.z <= 0.01) ||
      ((item.onlyBottom || container.allowStacking === false) && space.z > 0.01)
    ) {
      return null;
    }
    const unitWeight = Math.max(0, Number(item.weight) || 0);
    let best = null;
    const longCargo = isLongCargo(item, container);
    const stackingAllowed = container.allowStacking !== false;
    const itemStackable = item.stackable !== false;
    const defaultTopLoad = Math.max(
      0,
      Number(container.defaultTopLoadKg) || 0
    );
    const explicitTopLoad = Math.max(0, Number(item.topLoadKg) || 0);
    const topLoadKg = itemStackable
      ? explicitTopLoad > 0
        ? explicitTopLoad
        : defaultTopLoad
      : 0;

    if (
      longCargo &&
      (container.longCargoAllowed === false ||
        container.longCargoLengthPositions <= 0 ||
        container.longCargoMaxLayers <= 0)
    ) {
      return null;
    }

    for (const orientation of uniqueOrientations(item)) {
      const capacity = countFits(space, orientation);
      let layers = capacity.z;
      if (longCargo) {
        capacity.y = Math.min(
          capacity.y,
          Math.max(1, Number(container.longCargoLengthPositions) || 1)
        );
        if (Number(container.longCargoWidthColumns) > 0) {
          capacity.x = Math.min(
            capacity.x,
            Number(container.longCargoWidthColumns)
          );
        }
        layers = Math.min(
          layers,
          Math.max(1, Number(container.longCargoMaxLayers) || 1)
        );
      }
      const requiredSupport = Math.max(
        0,
        Math.min(1, Number(item.supportRequired ?? 1))
      );

      if (
        item.onlyBottom ||
        !stackingAllowed ||
        !itemStackable ||
        topLoadKg <= 0
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

      capacity.z = layers;
      const availableWeight = Math.max(0, container.payload - placedWeight);
      const weightCount = unitWeight > 0
        ? Math.floor((availableWeight + 0.0001) / unitWeight)
        : Infinity;
      const capacityCount = capacity.x * capacity.y * capacity.z;
      const count = Math.min(capacityCount, remainingCount, weightCount);
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
        const accepted = acceptCandidate(candidate);
        if (accepted) {
          best = accepted;
        }
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
    const placementsById = new Map(
      existingPlacements.map((placement) => [placement.placementId, placement])
    );
    const capacityFor = (placement) => {
      const item = itemsById[placement.itemId];
      if (container.allowStacking === false || item.stackable === false) {
        return 0;
      }
      return Math.max(0, Number(item.topLoadKg) || 0) ||
        Math.max(0, Number(container.defaultTopLoadKg) || 0);
    };

    for (const placement of [...newPlacements].sort(
      (a, b) => a.z - b.z || a.y - b.y || a.x - b.x
    )) {
      const item = itemsById[placement.itemId];
      const onFloor = placement.z <= 0.01;
      if (
        (onFloor && item.onlyTop) ||
        (!onFloor && (item.onlyBottom || container.allowStacking === false))
      ) {
        return { ok: false, reason: `${placement.name || "货物"} 的层位限制不满足` };
      }
      const supportRequired = Math.max(
        0,
        Math.min(1, Number(item.supportRequired ?? 1))
      );
      const baseArea = footprintArea(placement);
      const supports = onFloor ? [] : allPlacements
        .filter(
          (candidate) =>
            candidate.z < placement.z &&
            Math.abs(candidate.z + candidate.dz - placement.z) <= 0.01
        )
        .map((candidate) => ({
          placement: candidate,
          area: overlapArea(candidate, placement),
        }))
        .filter((entry) => entry.area > 0.01);
      const supportedArea = supports.reduce((sum, entry) => sum + entry.area, 0);
      const supportRatio = onFloor ? 1 : baseArea > 0 ? supportedArea / baseArea : 0;

      if (!onFloor && (!supports.length || supportRatio + 0.001 < supportRequired)) {
        return {
          ok: false,
          reason: `${placement.name || "货物"} 的底部支撑不足`,
        };
      }
      for (const support of supports) {
        if (capacityFor(support.placement) <= 0) {
          return {
            ok: false,
            reason: `${support.placement.name || "下方货物"} 的顶部承重不足`,
          };
        }
      }

      placement.supportShares = supports.map((entry) => ({
        placementId: entry.placement.placementId,
        ratio: entry.area / supportedArea,
      }));
      placement.supportItemIds = supports.map((entry) => entry.placement.itemId);
      placement.supportRatio = supportRatio;
      placement.supportDescription = onFloor ? "柜底" : Array.from(
        new Set(supports.map((entry) => entry.placement.name || "下方货物"))
      ).join("、");
      placement.longStackLayers = isLongCargo(item, container)
        ? 1 + Math.max(0, ...supports.map((entry) => entry.placement.longStackLayers || 0))
        : 0;
      if (placement.longStackLayers > container.longCargoMaxLayers) {
        return { ok: false, reason: `${placement.name || "货物"} 超过长管叠层限制` };
      }
      loadById[placement.placementId] = 0;
      allPlacements.push(placement);
      placementsById.set(placement.placementId, placement);
    }

    const addedLoads = new Map(
      newPlacements.map((placement) => [placement.placementId, placement.weight])
    );
    for (const placement of [...allPlacements].sort((a, b) => b.z - a.z)) {
      const addedLoad = addedLoads.get(placement.placementId) || 0;
      if (!addedLoad) {
        continue;
      }
      let shares = placement.supportShares;
      if (!shares) {
        const supports = placement.z <= 0.01 ? [] : allPlacements
          .filter((candidate) =>
            candidate.z < placement.z &&
            Math.abs(candidate.z + candidate.dz - placement.z) <= 0.01
          )
          .map((candidate) => ({
            placementId: candidate.placementId,
            area: overlapArea(candidate, placement),
          }))
          .filter((entry) => entry.area > 0.01);
        const area = supports.reduce((sum, entry) => sum + entry.area, 0);
        shares = supports.map((entry) => ({
          placementId: entry.placementId,
          ratio: entry.area / area,
        }));
      }
      for (const share of shares) {
        const support = placementsById.get(share.placementId);
        const allocatedLoad = addedLoad * share.ratio;
        const totalLoad = (loadById[share.placementId] || 0) + allocatedLoad;
        if (totalLoad > capacityFor(support) + 0.001) {
          return {
            ok: false,
            reason: `${support.name || "下方货物"} 的顶部承重不足`,
          };
        }
        loadById[share.placementId] = totalLoad;
        addedLoads.set(
          share.placementId,
          (addedLoads.get(share.placementId) || 0) + allocatedLoad
        );
      }
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

  function cylinderAxisFromOrientation(item, orientation) {
    if (item.shape !== "cylinder") {
      return item.cylinderAxis;
    }
    const rawLength = Math.max(
      1,
      Number(item.cylinderLength) || Number(item.length) || 1
    );
    const tolerance = Math.max(2, Number(item.clearance) || 0) + 2;
    if (Math.abs(orientation[2] - rawLength) <= tolerance) {
      return "height";
    }
    if (Math.abs(orientation[0] - rawLength) <= tolerance) {
      return "width";
    }
    return "length";
  }

  function placementFromItem(item, x, y, z, orientation) {
    return {
      placementId: `${item.id}-floor-${x}-${y}-${z}`,
      itemId: item.id,
      name: item.name,
      shape: item.shape,
      cylinderAxis: cylinderAxisFromOrientation(item, orientation),
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
      if (item.onlyTop) {
        continue;
      }
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

    while (spaces.length) {
      const candidates = [];
      // 有长管件未装时优先装长管件：先排满长件通道，再让普通箱填补周边
      const longRemaining = Object.entries(remainingById).some(
        ([id, count]) =>
          count > 0 && itemsById[id] && isLongCargo(itemsById[id], container)
      );

      const candidateSpaces = supportedCandidateSpaces(
        spaces, placements, itemsById, container
      );
      const acceptCandidate = (candidate) => {
        if (
          isLongCargo(candidate.item, container) &&
          longLane &&
          Math.abs(candidate.space.y - longLane.y) > 0.01
        ) {
          return null;
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
        return supportCheck.ok ? {
          ...candidate,
          generated,
          nextLoadById: supportCheck.loadById,
        } : null;
      };
      for (const longPass of longRemaining ? [true, false] : [false]) {
        for (const space of candidateSpaces) {
          for (const item of Object.values(itemsById)) {
            const remainingCount = remainingById[item.id] || 0;
            if (remainingCount < 1 || isLongCargo(item, container) !== longPass) {
              continue;
            }
            const candidate = candidateForSpace(
              item,
              remainingCount,
              space,
              placedWeight,
              container,
              acceptCandidate
            );
            if (candidate) {
              candidates.push(candidate);
            }
          }
        }
        if (candidates.length) {
          break;
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
          y: firstLongPlacement.y,
        };
      }

      placements.push(...generated.placements);
      loadById = selected.nextLoadById;
      placedWeight += generated.placements.reduce(
        (sum, placement) => sum + placement.weight,
        0
      );
      remainingById[selected.item.id] =
        (remainingById[selected.item.id] || 0) - generated.placements.length;

      const nextSpaces = subtractBoxFromSpaces(spaces, generated.occupied);
      spaces.length = 0;
      spaces.push(...nextSpaces);
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
        stackable: item.stackable !== false,
        supportRequired: Math.max(
          0,
          Math.min(1, Number(item.supportRequired ?? 1))
        ),
        onlyBottom: Boolean(item.onlyBottom),
        onlyTop: Boolean(item.onlyTop),
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
      if (item.onlyTop && item.onlyBottom) {
        errors.push(`${label} 不能同时设置为仅限上层和仅限底层。`);
      }
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
        (container.longCargoAllowed === false ||
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
        if (item.shape === "cylinder") {
          const axisLabel =
            item.cylinderAxis === "height"
              ? "竖放"
              : item.cylinderAxis === "width"
                ? "沿柜宽"
                : "沿柜长";
          errors.push(
            `${label}：直径 ${round(item.diameter, 0)} mm、长度 ${round(
              item.cylinderLength,
              0
            )} mm 的圆柱（${axisLabel}）放不进柜内空间（柜内宽 ${container.width} / 长 ${
              container.length
            } / 高 ${container.height} mm），请核对直径、长度和轴向。`
          );
        } else {
          errors.push(`${label} 的尺寸可能无法放入当前柜型。`);
        }
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

  function itemFitsContainer(item, container) {
    return uniqueOrientations(item).some(
      (orientation) =>
        orientation[0] <= container.width + 0.001 &&
        orientation[1] <= container.length + 0.001 &&
        orientation[2] <= container.height + 0.001
    );
  }

  function footprintOrientations(item) {
    return [
      [item.length, item.width],
      [item.width, item.length],
    ];
  }

  function singleSupport(top, base, height) {
    if (base.shape !== "box" || top.shape !== "box") {
      return null;
    }
    if (base.height + top.height > height) {
      return null;
    }
    for (const [baseLength, baseWidth] of footprintOrientations(base)) {
      for (const [topLength, topWidth] of footprintOrientations(top)) {
        if (baseLength >= topLength && baseWidth >= topWidth) {
          return {
            length: baseLength,
            width: baseWidth,
            topLength,
            topWidth,
          };
        }
      }
    }
    return null;
  }

  function pairSupport(top, first, second, height) {
    if (
      first.shape !== "box" ||
      second.shape !== "box" ||
      top.shape !== "box"
    ) {
      return null;
    }
    if (first.height !== second.height) {
      return null;
    }
    if (first.height + top.height > height) {
      return null;
    }
    for (const [firstLength, firstWidth] of footprintOrientations(first)) {
      for (const [secondLength, secondWidth] of footprintOrientations(second)) {
        for (const [topLength, topWidth] of footprintOrientations(top)) {
          if (
            firstWidth >= topWidth &&
            secondWidth >= topWidth &&
            firstLength + secondLength >= topLength
          ) {
            return {
              length: firstLength + secondLength,
              width: Math.max(firstWidth, secondWidth),
              topLength,
              topWidth,
              firstLength,
              firstWidth,
              secondLength,
              secondWidth,
            };
          }
        }
      }
    }
    return null;
  }

  function buildStackUnits(items, container, height) {
    const order = new Map(items.map((item, index) => [item.id, index]));
    const tops = items
      .filter((item) => item.onlyTop && item.quantity === 1)
      .sort((a, b) => order.get(a.id) - order.get(b.id));
    const bases = items.filter(
      (item) =>
        !item.onlyTop &&
        item.quantity === 1 &&
        item.packageType !== "bundle" &&
        item.shape === "box"
    );
    const used = new Set();
    const units = [];

    for (const top of tops) {
      const free = bases.filter((base) => !used.has(base.id));
      const pairs = [];
      for (let i = 0; i < free.length; i += 1) {
        for (let j = i + 1; j < free.length; j += 1) {
          const first = free[i];
          const second = free[j];
          const support = pairSupport(top, first, second, height);
          if (!support) {
            continue;
          }
          const bottomCount =
            (first.onlyBottom ? 1 : 0) + (second.onlyBottom ? 1 : 0);
          const bottomRank = bottomCount === 2 ? 0 : bottomCount === 1 ? 1 : 2;
          const identical =
            first.length === second.length && first.width === second.width
              ? 0
              : 1;
          pairs.push({
            first,
            second,
            support,
            rank: [
              identical,
              bottomRank,
              support.length * support.width,
              order.get(first.id),
              order.get(second.id),
            ],
          });
        }
      }
      pairs.sort((a, b) => {
        for (let k = 0; k < a.rank.length; k += 1) {
          if (a.rank[k] < b.rank[k]) return -1;
          if (a.rank[k] > b.rank[k]) return 1;
        }
        return 0;
      });

      let matched = null;
      let isSingle = false;
      const singleBases = free
        .filter((base) => base.onlyBottom)
        .map((base) => ({ base, support: singleSupport(top, base, height) }))
        .filter((candidate) => candidate.support)
        .sort(
          (a, b) =>
            a.support.length * a.support.width -
            b.support.length * b.support.width
        );
      if (singleBases.length) {
        matched = { base: singleBases[0].base, support: singleBases[0].support };
        isSingle = true;
      }
      if (!matched && pairs.length) {
        matched = pairs[0];
      }
      if (!matched) {
        continue;
      }

      const members = [];
      if (isSingle) {
        const base = matched.base;
        const support = matched.support;
        members.push({
          item: base,
          x: 0,
          y: 0,
          z: 0,
          dx: support.width,
          dy: support.length,
          dz: base.height,
        });
        members.push({
          item: top,
          x: 0,
          y: 0,
          z: base.height,
          dx: support.topWidth,
          dy: support.topLength,
          dz: top.height,
        });
        used.add(base.id);
      } else {
        const { first, second, support } = matched;
        members.push({
          item: first,
          x: 0,
          y: 0,
          z: 0,
          dx: support.firstWidth,
          dy: support.firstLength,
          dz: first.height,
        });
        members.push({
          item: second,
          x: 0,
          y: support.firstLength,
          z: 0,
          dx: support.secondWidth,
          dy: support.secondLength,
          dz: second.height,
        });
        members.push({
          item: top,
          x: 0,
          y: 0,
          z: first.height,
          dx: support.topWidth,
          dy: support.topLength,
          dz: top.height,
        });
        used.add(first.id);
        used.add(second.id);
      }

      units.push({
        id: `stack-unit-${units.length + 1}`,
        sku: `组合${String.fromCharCode(65 + units.length)}`,
        name: `预组合 ${members
          .filter((member) => member.item !== top)
          .map((member) => member.item.sku || member.item.name)
          .join("+")}/${top.sku || top.name}`,
        packageType: "pallet",
        shape: "box",
        length: Math.max(...members.map((member) => member.y + member.dy)),
        width: Math.max(...members.map((member) => member.x + member.dx)),
        height: matched.support ? members[0].item.height + top.height : top.height,
        quantity: 1,
        weight: members.reduce((sum, member) => sum + member.item.weight, 0),
        rotation: "fixed",
        clearance: 0,
        baseHeight: 0,
        dimensionsIncludeBase: true,
        onlyBottom: true,
        onlyTop: false,
        stackable: false,
        supportRequired: 1,
        topLoadKg: 0,
        colorIndex: top.colorIndex,
        members,
      });
    }

    units.forEach((unit) => {
      if (unit.height > height) {
        unit.height = height;
      }
    });
    return units;
  }

  function expandUnitPlacements(placements, unitsById) {
    const expanded = [];
    for (const placement of placements) {
      const unit = unitsById[placement.itemId];
      if (!unit) {
        expanded.push(placement);
        continue;
      }
      for (const member of unit.members) {
        expanded.push({
          ...member.item,
          placementId: `${placement.placementId || placement.itemId}-${member.item.id}`,
          itemId: member.item.id,
          x: placement.x + member.x,
          y: placement.y + member.y,
          z: placement.z + member.z,
          dx: member.dx,
          dy: member.dy,
          dz: member.dz,
          weight: member.item.weight,
          unitId: unit.id,
          unitName: unit.name,
          supportDescription:
            member.z > 0
              ? unit.name
              : placement.supportDescription,
        });
      }
    }
    return expanded;
  }

  function laneCandidate(item, container) {
    return uniqueOrientations(item).find(
      (orientation) =>
        orientation[1] >= container.length * 0.95 &&
        orientation[0] <= container.width * 0.5 &&
        orientation[2] <= container.height
    );
  }

  function planLoadSequence(rawItems, rawContainers, options = {}) {
    const items = normalizeItems(rawItems);
    if (!Array.isArray(rawContainers) || !rawContainers.length) {
      return {
        ok: false,
        errors: ["请至少设置一个集装箱。"],
        sequence: true,
        containers: [],
        items,
        unloaded: [],
      };
    }
    const templates = rawContainers.map((raw) => ({
      ...raw,
      width: Math.max(1, Number(raw.width) || 0),
      length: Math.max(1, Number(raw.length) || 0),
      height: Math.max(1, Number(raw.height) || 0),
      payload: Math.max(0, Number(raw.payload) || 0),
    }));
    const autoGroup = options.autoGroup !== false;
    const laneClearance = Math.max(0, Number(options.laneClearance) || 0);
    const units = autoGroup ? buildStackUnits(items, templates[0], templates[0].height) : [];
    const unitsById = Object.fromEntries(units.map((unit) => [unit.id, unit]));
    const groupedIds = new Set(
      units.flatMap((unit) => unit.members.map((member) => member.item.id))
    );
    const itemsById = Object.fromEntries(items.map((item) => [item.id, item]));
    let pendingUnits = units.slice();
    let pendingItems = items.filter((item) => !groupedIds.has(item.id));
    const containers = [];

    const expand = (placements) =>
      autoGroup ? expandUnitPlacements(placements, unitsById) : placements;

    const measure = (placements, template, label) => {
      const volume = placements.reduce(
        (sum, placement) =>
          sum + placement.dx * placement.dy * placement.dz,
        0
      );
      const weight = placements.reduce(
        (sum, placement) => sum + (Number(placement.weight) || 0),
        0
      );
      const containerVolume =
        template.width * template.length * template.height;
      return {
        index: containers.length + 1,
        label,
        container: template,
        placements,
        summary: summarizePlacements(placements, itemsById),
        weight,
        volume,
        cbm: volume / 1000000000,
        volumeUtilization: containerVolume ? volume / containerVolume : 0,
        weightUtilization: template.payload ? weight / template.payload : 0,
      };
    };

    for (let index = 0; index < templates.length; index += 1) {
      const template = templates[index];
      const label = rawContainers[index].label || `第 ${index + 1} 柜`;
      const unitsOnly = index === 0 && pendingUnits.length > 0;
      const eligibleUnits = pendingUnits.filter((unit) =>
        itemFitsContainer(unit, template)
      );
      const eligibleItems = pendingItems.filter((item) =>
        itemFitsContainer(item, template)
      );
      let candidates = unitsOnly
        ? eligibleUnits
        : [...eligibleUnits, ...eligibleItems];
      if (!candidates.length) {
        continue;
      }

      const laneItems = candidates.filter((item) => laneCandidate(item, template));
      const laneItem = laneItems.length === 1 ? laneItems[0] : null;
      const laneOrientation = laneItem ? laneCandidate(laneItem, template) : null;
      const laneWidth = laneOrientation ? laneOrientation[0] : 0;
      const zone = laneItem
        ? {
            ...template,
            width: template.width - laneWidth,
            height: Math.max(1, template.height - laneClearance),
            payload: Math.max(0, template.payload - laneItem.weight),
          }
        : template;
      const packItems = laneItem
        ? candidates.filter(
            (item) => item.id !== laneItem.id && itemFitsContainer(item, zone)
          )
        : candidates;

      const attempts = [packItems];
      if (unitsOnly && !packItems.length) {
        attempts.push([...eligibleItems]);
      }
      let packed = null;
      let usedInput = null;
      for (const attemptInput of attempts) {
        if (!attemptInput.length) {
          continue;
        }
        const result = planLoad(attemptInput, zone);
        if (result.containers.length) {
          packed = result.containers[0];
          usedInput = attemptInput;
          break;
        }
      }
      if (!packed) {
        continue;
      }

      const lanePlacements = [];
      if (laneItem && laneOrientation) {
        lanePlacements.push({
          ...laneItem,
          placementId: laneItem.id,
          itemId: laneItem.id,
          x: 0,
          y: 0,
          z: 0,
          dx: laneOrientation[0],
          dy: laneOrientation[1],
          dz: laneOrientation[2],
          supportDescription: "柜底长货通道",
        });
      }
      const shifted = packed.placements.map((placement) =>
        laneWidth ? { ...placement, x: placement.x + laneWidth } : placement
      );
      const expanded = expand([...lanePlacements, ...shifted]);
      const placedIds = new Set(packed.placements.map((placement) => placement.itemId));
      const laneIds = new Set(lanePlacements.map((placement) => placement.itemId));

      containers.push(measure(expanded, template, label));
      pendingUnits = pendingUnits.filter((unit) => !placedIds.has(unit.id));
      pendingItems = pendingItems.filter(
        (item) => !placedIds.has(item.id) && !laneIds.has(item.id)
      );
    }

    const unloaded = [
      ...pendingItems.map((item) => ({
        itemId: item.id,
        name: item.name,
        sku: item.sku,
        count: item.quantity,
      })),
      ...pendingUnits.flatMap((unit) =>
        unit.members.map((member) => ({
          itemId: member.item.id,
          name: member.item.name,
          sku: member.item.sku,
          count: 1,
        }))
      ),
    ];

    if (!containers.length || unloaded.length) {
      const errors = [];
      if (!containers.length) {
        errors.push("当前条件下没有任何货物可以装入。");
      } else {
        errors.push(
          `仍有 ${unloaded.reduce(
            (sum, item) => sum + item.count,
            0
          )} 件货物未能装载，请检查重量、旋转或叠放限制。`
        );
      }
      return {
        ok: false,
        errors,
        sequence: true,
        containers,
        items,
        unloaded,
        autoGroups: units.map((unit) => ({
          id: unit.id,
          name: unit.name,
          members: unit.members.map((member) => member.item.id),
        })),
      };
    }

    const totalWeight = containers.reduce(
      (sum, entry) => sum + entry.weight,
      0
    );
    const totalVolume = containers.reduce(
      (sum, entry) => sum + entry.volume,
      0
    );
    const totalContainerVolume = containers.reduce(
      (sum, entry) =>
        sum +
        entry.container.width * entry.container.length * entry.container.height,
      0
    );
    const totalPayload = containers.reduce(
      (sum, entry) => sum + entry.container.payload,
      0
    );

    return {
      ok: true,
      errors: [],
      sequence: true,
      container: templates[0],
      containers,
      items,
      unloaded: [],
      totals: {
        containers: containers.length,
        units: containers.reduce(
          (sum, entry) => sum + entry.placements.length,
          0
        ),
        weight: totalWeight,
        volume: totalVolume,
        cbm: totalVolume / 1000000000,
        volumeUtilization: totalContainerVolume
          ? totalVolume / totalContainerVolume
          : 0,
        weightUtilization: totalPayload ? totalWeight / totalPayload : 0,
      },
      autoGroups: units.map((unit) => ({
        id: unit.id,
        name: unit.name,
        members: unit.members.map((member) => member.item.id),
      })),
    };
  }

  return {
    CONTAINERS,
    buildStackUnits,
    normalizeItems,
    planLoad,
    planLoadSequence,
    uniqueOrientations,
  };
});
