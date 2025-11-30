(function () {
  "use strict";

  // Inject header/footer partials
  async function injectPartials() {
    const nodes = document.querySelectorAll("[data-include]");
    if (!nodes.length) return;

    for (const el of nodes) {
      const url = el.getAttribute("data-include");
      if (!url) continue;
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const html = await res.text();
        el.innerHTML = html;
      } catch (err) {
        console.warn("Could not load partial", url, err);
      }
    }
  }

  // Simple collapsible helper (optional, for pages that use it)
  function initCollapsibles() {
    const toggles = document.querySelectorAll("[data-collapsible-toggle]");
    toggles.forEach(function (toggle) {
      const targetSelector = toggle.getAttribute("data-collapsible-target");
      if (!targetSelector) return;
      const body = document.querySelector(targetSelector);
      if (!body) return;

      const baseLabel = toggle.getAttribute("data-label-base") || toggle.textContent || "";
      function setLabel(open) {
        toggle.textContent = (open ? "- " : "+ ") + baseLabel;
      }

      setLabel(body.classList.contains("open"));

      toggle.addEventListener("click", function () {
        const open = !body.classList.contains("open");
        body.classList.toggle("open", open);
        setLabel(open);
      });
    });
  }

  // Counter API integration, expects:
  // - body[data-counter-key="unique_key"]
  // - span#toolUsageCount in footer partial
  async function initToolCounter() {
    const body = document.body;
    if (!body) return;
    const key = body.getAttribute("data-counter-key");
    if (!key) return;

    const span = document.getElementById("toolUsageCount");
    if (!span) return;

    try {
      const url =
        "https://api.counterapi.dev/v1/imthebus/" +
        encodeURIComponent(key) +
        "/up";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Counter API bad status " + res.status);
      const data = await res.json();
      const value =
        data.count != null
          ? data.count
          : data.value != null
          ? data.value
          : data.counter != null
          ? data.counter
          : null;
      span.textContent = value != null ? String(value) : "?";
    } catch (err) {
      console.warn("Tool counter could not be loaded", err);
      span.textContent = "?";
    }
  }

  // Generic draggable notes helper
  // options = {
  //   boardEl: HTMLElement (required),
  //   noteSelector: string (defaults to ".note"),
  //   onDrop: function (noteEl, xNorm, yNorm) {}
  // }
  function initDraggableNotes(options) {
    const boardEl = options && options.boardEl;
    if (!boardEl) return;

    const noteSelector = options.noteSelector || ".note";
    const onDrop =
      typeof options.onDrop === "function" ? options.onDrop : function () {};

    let dragging = null;
    let topZ = 10;

    function onMouseDown(e) {
      const el = e.target.closest(noteSelector);
      if (!el || e.button !== 0) return;

      const boardRect = boardEl.getBoundingClientRect();
      const noteRect = el.getBoundingClientRect();

      dragging = {
        el: el,
        boardRect: boardRect,
        offsetX: e.clientX - noteRect.left,
        offsetY: e.clientY - noteRect.top
      };

      topZ += 1;
      el.style.zIndex = String(topZ);
      el.classList.add("dragging");

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    }

    function onMouseMove(e) {
      if (!dragging) return;
      const el = dragging.el;
      const boardRect = dragging.boardRect;

      const noteWidth = el.offsetWidth || 140;
      const noteHeight = el.offsetHeight || 60;

      let left = e.clientX - boardRect.left - dragging.offsetX;
      let top = e.clientY - boardRect.top - dragging.offsetY;

      const maxLeft = boardRect.width - noteWidth;
      const maxTop = boardRect.height - noteHeight;

      left = Math.max(0, Math.min(left, maxLeft));
      top = Math.max(0, Math.min(top, maxTop));

      el.style.left = left + "px";
      el.style.top = top + "px";

      const centerX = left + noteWidth / 2;
      const centerY = top + noteHeight / 2;

      dragging.xNorm = centerX / boardRect.width;
      dragging.yNorm = centerY / boardRect.height;
    }

    function onMouseUp() {
      if (!dragging) return;
      const el = dragging.el;
      el.classList.remove("dragging");

      const x = typeof dragging.xNorm === "number" ? dragging.xNorm : null;
      const y = typeof dragging.yNorm === "number" ? dragging.yNorm : null;
      dragging = null;

      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);

      if (x == null || y == null) return;
      onDrop(el, x, y);
    }

    boardEl.addEventListener("mousedown", onMouseDown);
  }

  // Expose helpers for tool pages
  window.imthebusCore = {
    initCollapsibles: initCollapsibles,
    initDraggableNotes: initDraggableNotes
  };

  document.addEventListener("DOMContentLoaded", function () {
    injectPartials().then(function () {
      initCollapsibles();
      initToolCounter();
      // per page scripts run after this via their own script tags
    });
  });
})();
