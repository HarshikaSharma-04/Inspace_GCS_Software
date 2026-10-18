// ─── Inject CSS: defeat global `canvas { padding:15px; margin:20px }` rule ────
(function injectCanvasTableStyles() {
  const style = document.createElement("style");
  style.textContent = `
    /* Strip the global canvas rule for the table canvas only */
    #telemetry-table canvas,
    canvas.canvas-table-el {
      display: block        !important;
      position: sticky      !important;
      top: 0                !important;
      left: 0               !important;
      z-index: 1            !important;
      padding: 0            !important;
      margin: 0             !important;
      box-shadow: none      !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      border-radius: 0      !important;
      border: none          !important;
      image-rendering: auto !important;
    }
    /* Wrapper: overflow+max-height so internal scrollbar appears */
    #telemetry-table {
      margin: 0;
      padding: 0;
      width: 100%;
      box-sizing: border-box;
      background: #ffffff;
      overflow-y: auto;
      overflow-x: none;
      max-height: 100vh;
      border: 1px solid #d8cff0;
      border-radius: 4px;
      scrollbar-width: thin;
      scrollbar-color: #9f8ec4 #f3f0ff;
    }
    #telemetry-table::-webkit-scrollbar       { width: 7px; height: 7px; }
    #telemetry-table::-webkit-scrollbar-track { background: #f3f0ff; }
    #telemetry-table::-webkit-scrollbar-thumb { background: #9f8ec4; border-radius: 4px; }
    #telemetry-table::-webkit-scrollbar-thumb:hover { background: #6750a4; }
    /* Outer flex column: lost-packet label stacks above table */
    .table-outer-flex-container {
      display: flex;
      flex-direction: column;
      width: 100%;
      padding-bottom: 32px;
    }
    /* Lost-packet label */
    .csv-lost-packet-box {
      display: none;
      padding: 6px 12px;
      font-size: 13px;
      font-weight: bold;
      color: #4a3580;
      background: #ede7ff;
      border-bottom: 2px solid #9f8ec4;
    }
    /* Bottom breathing room for the CSV wrapper itself */
    .telemetry-csv-wrapper {
      padding-bottom: 32px;
    }
  `;
  document.head.appendChild(style);
})();

class CanvasTable {
  constructor(containerId, cols) {
    this.cols = cols;
    this.rows = [];
    this.ROW_H = 22;
    this.HEAD_H = 34;
    this._dirty = false;
    this._dpr = Math.min(window.devicePixelRatio || 1, 2);
    this._baseW = cols.reduce((s, c) => s + c.w, 0); // sum of defined widths

    // Purple theme matching the project's #6750a4 active button colour
    this._headBg = "#6750a4";
    this._headFg = "#ffffff";
    this._evenBg = "#ffffff";
    this._oddBg = "#f3f0ff";
    this._fg = "#1a1a2e";
    this._grid = "#e0d8f0";

    // ── Auto-scroll via _pendingScroll flag ──────────────────────────
    // _pendingScroll is set in addData(), consumed inside _paint() AFTER
    // the canvas is already sized — so scrollHeight is always accurate.
    // This is the only race-free approach.
    this._autoScroll = true;
    this._pendingScroll = false;

    this._wrap = document.getElementById(containerId);
    // Minimal inline styles — the injected <style> block handles the rest
    this._wrap.style.position = "relative";
    this._wrap.style.overflow = "auto";

    // Canvas — inline style wins over any CSS rule (belt-and-suspenders)
    this._canvas = document.createElement("canvas");
    this._canvas.className = "canvas-table-el";
    this._canvas.style.cssText =
      "display:block;position:sticky;top:0;left:0;z-index:1;padding:0;margin:0;box-shadow:none;" +
      "backdrop-filter:none;border:none;border-radius:0;image-rendering:auto;";
    this._wrap.appendChild(this._canvas);
    this._ctx = this._canvas.getContext("2d", { alpha: false });

    this._spacer = document.createElement("div");
    this._spacer.style.cssText = "width:1px;height:0;pointer-events:none;";
    this._wrap.appendChild(this._spacer);

    // Scroll: repaint + track user position.
    // _pendingScroll guard: if scroll fires while we're programmatically
    // scrolling, don't update _autoScroll (it was us, not the user).
    this._wrap.addEventListener(
      "scroll",
      () => {
        this._dirty = true;

        clearTimeout(this._scrollStopTimer);

        // pause while user is actively scrolling
        this._autoScroll = false;

        // resume auto-scroll shortly after user stops scrolling
        this._scrollStopTimer = setTimeout(() => {
          this._autoScroll = true;
        }, 100);
      },
      { passive: true },
    );

    // User-initiated scroll → pause auto-scroll
    this._wrap.addEventListener(
      "wheel",
      () => {
        this._autoScroll = false;
      },
      { passive: true },
    );
    this._wrap.addEventListener(
      "touchstart",
      () => {
        this._autoScroll = false;
      },
      { passive: true },
    );

    window.addEventListener("resize", () => {
      this._syncSize();
      this._dirty = true;
    });

    this._syncSize();
    this._dirty = true; // ensure first paint fires immediately
    this._loop();
  }

  // ── Compute effective column widths ──────────────────────────────────
  // If the wrapper is wider than the sum of column widths, scale all columns
  // up proportionally so there is NEVER empty space on the right.
  // If narrower, keep defined widths and let the wrapper horizontal-scroll.
  _effectiveCols() {
    const available = this._wrap.clientWidth || this._baseW;

    const scale = available / this._baseW;

    return this.cols.map(c => Math.round(c.w * scale));
  }

  _syncSize() {
    this._ew = this._effectiveCols();
    this._totalW = this._ew.reduce((s, w) => s + w, 0);

    const logW = this._wrap.clientWidth;
    const viewH = this._wrap.clientHeight || 400;

    // Only update canvas if container dimensions actually changed
    if (this._logW !== logW || this._logH !== viewH) {
      this._logW = logW;
      this._logH = viewH;

      this._canvas.width = Math.round(logW * this._dpr);
      this._canvas.height = Math.round(viewH * this._dpr);
      this._canvas.style.width = logW + "px";
      this._canvas.style.height = viewH + "px";
      this._ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
    }

    // Update spacer to maintain total scroll height (this does NOT clear canvas)
    const totalH =
      this.HEAD_H + this.rows.length * this.ROW_H;

    this._spacer.style.height =
      Math.max(0, totalH - this._logH) + "px";
  }

  _loop() {
    if (this._dirty) {
      this._paint();
      this._dirty = false;
    }
    requestAnimationFrame(() => this._loop());
  }

  _paint() {
    const ctx = this._ctx;
    const W = this._logW;
    const ew = this._ew;
    const rH = this.ROW_H;
    const hH = this.HEAD_H;
    const sTop = this._wrap.scrollTop;
    const sLeft = this._wrap.scrollLeft;
    const viewH = this._logH; // Fixed canvas height = viewport height
    const yOffset = -sTop; // Translate content by scrollTop for fixed-height canvas

    // Full background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, viewH);

    // ── Sticky header: painted at sTop so it always sits at viewport top ──
    const hy = 0;
    ctx.fillStyle = this._headBg;
    ctx.fillRect(0, hy, W, hH);

    ctx.font = "bold 11px Arial,sans-serif";
    ctx.textBaseline = "middle";

    let hx = -sLeft;
    this.cols.forEach((col, ci) => {
      const cw = ew[ci];
      if (hx + cw > 0 && hx < W) {
        ctx.fillStyle = this._headFg;
        ctx.save();
        ctx.beginPath();
        ctx.rect(hx + 5, hy, cw - 8, hH);
        ctx.clip();
        ctx.fillText(col.title, hx + 5, hy + hH / 2);
        ctx.restore();
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(hx + cw - 0.5, hy);
        ctx.lineTo(hx + cw - 0.5, hy + hH);
        ctx.stroke();
      }
      hx += cw;
    });

    // Header bottom border
    ctx.strokeStyle = "#4a3580";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, hy + hH);
    ctx.lineTo(W, hy + hH);
    ctx.stroke();

    // ── Virtual row rendering: only visible rows ──────────────────────
    const first = Math.max(0, Math.floor((sTop - hH) / rH));
    const last = Math.min(
      this.rows.length - 1,
      first + Math.ceil(viewH / rH) + 2,
    );

    ctx.font = "10px Arial,sans-serif";

    for (let i = first; i <= last; i++) {
      const row = this.rows[i];
      const ry = hH + i * rH + yOffset;

      ctx.fillStyle = i % 2 === 0 ? this._evenBg : this._oddBg;
      ctx.fillRect(sLeft, ry, W, rH);

      ctx.strokeStyle = this._grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sLeft, ry + rH - 0.5);
      ctx.lineTo(sLeft + W, ry + rH - 0.5);
      ctx.stroke();

      let cx = -sLeft;
      this.cols.forEach((col, ci) => {
        const cw = ew[ci];
        if (cx + cw > 0 && cx < W) {
          ctx.fillStyle = this._fg;
          ctx.save();
          ctx.beginPath();
          ctx.rect(cx + 5, ry + 1, cw - 8, rH - 2);
          ctx.clip();
          ctx.fillText(String(row[col.field] ?? ""), cx + 5, ry + rH / 2);
          ctx.restore();
          ctx.strokeStyle = this._grid;
          ctx.beginPath();
          ctx.moveTo(cx + cw - 0.5, ry);
          ctx.lineTo(cx + cw - 0.5, ry + rH);
          ctx.stroke();
        }
        cx += cw;
      });
    }

    // Empty-state placeholder
    if (this.rows.length === 0) {
      ctx.font = "13px Arial,sans-serif";
      ctx.fillStyle = "#9f8ec4";
      ctx.textAlign = "center";
      ctx.fillText("Waiting for Telemetry...", W / 2, hH + 60);
      ctx.textAlign = "left";
    }

    // ── Auto-scroll: direct assignment in same frame (no nested RAF jitter) ──
    if (this._pendingScroll) {
      this._pendingScroll = false;
      this._wrap.scrollTop = this._wrap.scrollHeight;
    }
  }

  // ── Public API ────────────────────────────────────────────────────────
  clearData() {
    this.rows = [];
    this._autoScroll = true;
    this._pendingScroll = false;
    // Reset spacer to just header height
    this._spacer.style.height = this.HEAD_H + "px";
    this._dirty = true;
  }

  blockRedraw() { } // no-op — compat
  restoreRedraw() { } // no-op

  addData(rowsArr, atTop) {
    if (atTop) this.rows.unshift(...rowsArr);
    else this.rows.push(...rowsArr);

    const totalH = this.HEAD_H + this.rows.length * this.ROW_H;

    this._spacer.style.height =
      Math.max(0, totalH - this._wrap.clientHeight) + "px";

    this._dirty = true;

    if (this._autoScroll && !atTop) {
      requestAnimationFrame(() => {
        this._wrap.scrollTop = this._wrap.scrollHeight;
      });
    }
  }

  deleteFirstRow() {
    if (this.rows.length > 0) {
      // Check if user is NOT at bottom before deleting
      const isAtBottom = this._wrap.scrollTop + this._wrap.clientHeight >= this._wrap.scrollHeight - 4;

      this.rows.shift();
      // Update spacer height for scrolling, but DON'T resize canvas (no flicker!)
      const totalH = this.HEAD_H + this.rows.length * this.ROW_H;
      this._spacer.style.height = totalH + "px";

      // Compensate for row deletion: if user is not at bottom, subtract ROW_H from scrollTop
      // This keeps them viewing the same historical data despite the row shift
      if (!isAtBottom) {
        this._wrap.scrollTop = Math.max(0, this._wrap.scrollTop - this.ROW_H);
      }

      this._dirty = true;
    }
  }

  scrollToBottom() {
    this._pendingScroll = true;
    this._dirty = true;
  }

  // Called when the CSV tab becomes visible (wrapper was display:none at init)
  onShow() {
    this._syncSize();

    const totalH =
      this.HEAD_H + Math.max(1, this.rows.length) * this.ROW_H;

    this._spacer.style.height =
      Math.max(0, totalH - this._wrap.clientHeight) + "px";

    this._dirty = true;

    this._autoScroll = true;

    // wait till browser fully renders visible tab
    setTimeout(() => {
      this._wrap.scrollTop =
        this._wrap.scrollHeight;
    }, 0);
  }
}

export default CanvasTable;
