(function () {
  "use strict";

  // Inject a skip-to-content link and ensure <main> is focusable, once per page.
  function injectSkipLink() {
    if (document.querySelector(".skip-link")) return;
    var main = document.querySelector("main");
    if (main && !main.id) main.id = "main-content";
    var target = main ? main.id : null;
    if (!target) return;
    if (main && !main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
    var link = document.createElement("a");
    link.className = "skip-link";
    link.href = "#" + target;
    link.textContent = "Skip to content";
    document.body.insertBefore(link, document.body.firstChild);
  }

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

  // Wire the injected header: mobile toggle + active-page marking.
  // Runs from core JS (after partials inject) because <script> tags inserted
  // via innerHTML do not execute.
  function initHeader() {
    var toggle = document.getElementById("navMobileToggle");
    var nav = document.getElementById("siteNavLeft");
    if (toggle && nav) {
      toggle.addEventListener("click", function () {
        var open = nav.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", String(open));
      });
    }
    if (nav) {
      try {
        var here = (location.pathname.split("/").pop() || "index.html").toLowerCase();
        if (here === "") here = "index.html";
        nav.querySelectorAll("a").forEach(function (a) {
          var href = (a.getAttribute("href") || "").toLowerCase();
          if (href === here) a.setAttribute("aria-current", "page");
        });
      } catch (e) {}
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

    // Touch support: translate touch events to the same drag logic
    boardEl.addEventListener("touchstart", function (e) {
      const touch = e.touches[0];
      if (!touch) return;
      const el = touch.target.closest(noteSelector);
      if (!el) return;
      e.preventDefault();
      onMouseDown({ target: touch.target, button: 0, clientX: touch.clientX, clientY: touch.clientY });
    }, { passive: false });

    document.addEventListener("touchmove", function (e) {
      if (!dragging) return;
      e.preventDefault();
      const touch = e.touches[0];
      if (touch) onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
    }, { passive: false });

    document.addEventListener("touchend", function () {
      if (dragging) onMouseUp();
    });
  }

  // Expose helpers for tool pages
  window.imthebusCore = {
    initCollapsibles: initCollapsibles,
    initDraggableNotes: initDraggableNotes
  };

  document.addEventListener("DOMContentLoaded", function () {
    injectSkipLink();
    injectPartials().then(function () {
      initHeader();
      initCollapsibles();
      initToolCounter();
      // per page scripts run after this via their own script tags
    });
  });
})();

