(function attachCircleRenderer(globalObject) {
  const SVG_NS = "http://www.w3.org/2000/svg";

  function createSvgElement(tagName, attrs = {}) {
    const element = document.createElementNS(SVG_NS, tagName);
    Object.entries(attrs).forEach(([key, value]) => {
      element.setAttribute(key, String(value));
    });
    return element;
  }

  function clearElement(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  function lineEndpoints(start, end, nodeRadius) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.hypot(dx, dy) || 1;
    const trim = Math.max(nodeRadius - 3, 0);

    return {
      x1: start.x + (dx / distance) * trim,
      y1: start.y + (dy / distance) * trim,
      x2: end.x - (dx / distance) * trim,
      y2: end.y - (dy / distance) * trim,
    };
  }

  function applyStrokeAnimation(element) {
    if (typeof element.getTotalLength !== "function") {
      return;
    }
    const startAnimation = () => {
      try {
        const length = element.getTotalLength();
        if (!Number.isFinite(length) || length <= 0) {
          return;
        }
        element.style.setProperty("--line-length", `${length}`);
        element.style.strokeDasharray = `${length}`;
        element.style.strokeDashoffset = `${length}`;
        element.classList.add("draw-line");
      } catch (_error) {
        // Some browsers throw if geometry is not yet renderable; skip animation but keep line visible.
      }
    };

    requestAnimationFrame(startAnimation);
  }

  function createCircleRenderer({
    svgElement,
    tooltipElement,
    noteNames,
    onNoteSelect,
    onNotePlay,
    getTooltipContent,
  }) {
    const geometry = {
      size: 600,
      center: 300,
      ringRadius: 224,
      nodeRadius: 24,
      loopRadius: 33,
      markerRadius: 3,
    };

    const notePositions = noteNames.map((_, index) => {
      const angle = (index * Math.PI) / 6 - Math.PI / 2;
      return {
        x: geometry.center + Math.cos(angle) * geometry.ringRadius,
        y: geometry.center + Math.sin(angle) * geometry.ringRadius,
        angle,
      };
    });

    clearElement(svgElement);

    const baseGroup = createSvgElement("g", { "data-layer": "base" });
    const scaleGroup = createSvgElement("g", { "data-layer": "scale" });
    const harmonyGroup = createSvgElement("g", { "data-layer": "harmony" });
    const chordGroup = createSvgElement("g", { "data-layer": "chord" });
    const intervalGroup = createSvgElement("g", { "data-layer": "interval" });
    const nodeGroup = createSvgElement("g", { "data-layer": "nodes" });

    svgElement.append(baseGroup, scaleGroup, harmonyGroup, chordGroup, intervalGroup, nodeGroup);

    baseGroup.appendChild(
      createSvgElement("circle", {
        cx: geometry.center,
        cy: geometry.center,
        r: geometry.ringRadius,
        class: "chromatic-ring",
      }),
    );

    notePositions.forEach((position) => {
      baseGroup.appendChild(
        createSvgElement("circle", {
          cx: position.x,
          cy: position.y,
          r: geometry.markerRadius,
          class: "hour-marker",
        }),
      );
    });

    const nodeElements = noteNames.map((noteName, index) => {
      const position = notePositions[index];
      const node = createSvgElement("g", { class: "note-node", "data-index": index });
      const circle = createSvgElement("circle", {
        cx: position.x,
        cy: position.y,
        r: geometry.nodeRadius,
      });
      const text = createSvgElement("text", { x: position.x, y: position.y });
      text.textContent = noteName;
      node.append(circle, text);

      node.addEventListener("click", () => {
        onNoteSelect(index);
        if (onNotePlay) {
          onNotePlay(index);
        }
      });

      node.addEventListener("mouseenter", (event) => {
        if (!getTooltipContent) {
          return;
        }
        const content = getTooltipContent(index);
        if (!content) {
          return;
        }
        tooltipElement.innerHTML = content;
        tooltipElement.classList.add("visible");
        const bounds = svgElement.getBoundingClientRect();
        tooltipElement.style.left = `${event.clientX - bounds.left}px`;
        tooltipElement.style.top = `${event.clientY - bounds.top}px`;
      });

      node.addEventListener("mousemove", (event) => {
        if (!tooltipElement.classList.contains("visible")) {
          return;
        }
        const bounds = svgElement.getBoundingClientRect();
        tooltipElement.style.left = `${event.clientX - bounds.left}px`;
        tooltipElement.style.top = `${event.clientY - bounds.top}px`;
      });

      node.addEventListener("mouseleave", () => {
        tooltipElement.classList.remove("visible");
      });

      nodeGroup.appendChild(node);
      return node;
    });

    function renderConnectionLayer(group, connections) {
      clearElement(group);

      connections.forEach((connection) => {
        const start = notePositions[connection.startIndex];
        const end = notePositions[connection.targetIndex];
        const className = connection.className ?? "";

        let element;

        if (connection.isLoop) {
          element = createSvgElement("circle", {
            cx: start.x,
            cy: start.y,
            r: geometry.loopRadius,
            class: `${className} line-loop`,
          });
        } else {
          const endpoints = lineEndpoints(start, end, geometry.nodeRadius);
          element = createSvgElement("line", {
            x1: endpoints.x1,
            y1: endpoints.y1,
            x2: endpoints.x2,
            y2: endpoints.y2,
            class: className,
          });
        }

        if (connection.color) {
          element.setAttribute("stroke", connection.color);
        }

        if (connection.title) {
          const titleElement = createSvgElement("title");
          titleElement.textContent = connection.title;
          element.appendChild(titleElement);
        }

        group.appendChild(element);
        applyStrokeAnimation(element);
      });
    }

    function updateNodeStates({ tonicIndex, scaleNoteIndices, chordNoteIndices, intervalEndpoints }) {
      const scaleSet = new Set(scaleNoteIndices);
      const chordSet = new Set(chordNoteIndices);
      const intervalSet = new Set(intervalEndpoints);

      nodeElements.forEach((nodeElement, index) => {
        nodeElement.classList.toggle("tonic", index === tonicIndex);
        nodeElement.classList.toggle("in-scale", scaleSet.has(index));
        nodeElement.classList.toggle("in-chord", chordSet.has(index));
        nodeElement.classList.toggle("interval-endpoint", intervalSet.has(index));
      });
    }

    return {
      updateNodeStates,
      renderScaleConnections(connections) {
        renderConnectionLayer(scaleGroup, connections);
      },
      renderHarmonyConnections(connections) {
        renderConnectionLayer(harmonyGroup, connections);
      },
      renderChordConnections(connections) {
        renderConnectionLayer(chordGroup, connections);
      },
      renderIntervalConnection(connection) {
        renderConnectionLayer(intervalGroup, connection ? [connection] : []);
      },
    };
  }

  globalObject.CircleRenderer = Object.freeze({
    createCircleRenderer,
  });
})(window);
