(function () {
  // Simple partial include for shared header and footer
  async function injectPartials() {
    const nodes = document.querySelectorAll("[data-include]");
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

  // Collapsibles
  function initCollapsibles() {
    document.querySelectorAll("[data-collapsible]").forEach(section => {
      const toggle = section.querySelector(".collapsible-toggle");
      const body = section.querySelector(".collapsible-body");
      if (!toggle || !body) return;

      toggle.addEventListener("click", () => {
        const open = body.classList.toggle("open");
        // optional symbol swap
        if (toggle.dataset.labelBase) {
          toggle.textContent = (open ? "− " : "+ ") + toggle.dataset.labelBase;
        }
      });
    });
  }

  // Generic note dragging - individual tools can call this
  function initDraggableNotes(options) {
    const boardEl = options.boardEl;
    const onDrop = options.onDrop; // (noteEl, xNorm, yNorm) -> void
    if (!boardEl) return;

    let dragging = null;

    function onMouseDown(e) {
      const el = e.target.closest(".note");
      if (!el || e.button !== 0) return;
      dragging = {
        el,
        startX: e.clientX,
        startY: e.clientY
      };
      const rect = el.getBoundingClientRect();
      dragging.originLeft = rect.left;
      dragging.originTop = rect.top;
      dragging.boardRect = boardEl.getBoundingClientRect();
      el.classList.add("dragging");
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    }

    function onMouseMove(e) {
      if (!dragging) return;
      const { el, startX, startY, originLeft, originTop, boardRect } = dragging;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newLeft = originLeft + dx;
      const newTop = originTop + dy;
      const noteWidth = el.offsetWidth;
      const noteHeight = el.offsetHeight;

      const clampedLeft = Math.min(
        Math.max(newLeft, boardRect.left),
        boardRect.right - noteWidth
      );
      const clampedTop = Math.min(
        Math.max(newTop, boardRect.top),
        boardRect.bottom - noteHeight
      );

      el.style.left = clampedLeft - boardRect.left + "px";
      el.style.top = clampedTop - boardRect.top + "px";

      const centerX = clampedLeft - boardRect.left + noteWidth / 2;
      const centerY = clampedTop - boardRect.top + noteHeight / 2;

      dragging.xNorm = centerX / boardRect.width;
      dragging.yNorm = centerY / boardRect.height;
    }

    function onMouseUp() {
      if (!dragging) return;
      const { el, xNorm, yNorm } = dragging;
      el.classList.remove("dragging");
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);

      if (typeof onDrop === "function" && xNorm != null && yNorm != null) {
        onDrop(el, xNorm, yNorm);
      }
      dragging = null;
    }

    boardEl.addEventListener("mousedown", onMouseDown);
  }

  // Expose helpers for tool pages
  window.imthebusCore = {
    initCollapsibles,
    initDraggableNotes
  };

  document.addEventListener("DOMContentLoaded", () => {
    injectPartials().then(() => {
      imthebusCore.initCollapsibles();
      // page specific JS will run after this
    });
  });
})();
