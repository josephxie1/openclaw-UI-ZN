import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { createSwapy } from "swapy";
import type { Swapy } from "swapy";

const STORAGE_KEY = "oc-overview-card-order-v3";

/**
 * Overview layout wrapper that enables drag-to-swap card reordering
 * using the swapy library. Card order is persisted in localStorage
 * and read back by renderOverview() on each render to maintain order.
 */
@customElement("oc-overview-layout")
export class OcOverviewLayout extends LitElement {
  private _swapy: Swapy | null = null;
  private _observer: MutationObserver | null = null;

  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <slot></slot>
    `;
  }

  protected firstUpdated() {
    // Wait for slotted children to be in the DOM
    requestAnimationFrame(() => {
      this._initSwapy();
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._observer?.disconnect();
    this._observer = null;
    this._swapy?.destroy();
    this._swapy = null;
  }

  private _initSwapy() {
    const container = this.querySelector(".overview-swapy");
    if (!container) {
      return;
    }

    this._swapy = createSwapy(container as HTMLElement, {
      swapMode: "hover",
      animation: "dynamic",
      autoScrollOnDrag: true,
    });

    this._swapy.onSwapEnd((event) => {
      if (event.hasChanged) {
        // Save to localStorage — renderOverview() reads this on next render
        localStorage.setItem(STORAGE_KEY, JSON.stringify(event.slotItemMap.asArray));
      }
    });

    // Watch for direct child changes (e.g. when async data loads and cards re-render)
    // Only childList on container itself — NOT subtree, to avoid Chart.js canvas noise
    this._observer = new MutationObserver(() => {
      this._swapy?.update();
    });
    this._observer.observe(container, { childList: true });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "oc-overview-layout": OcOverviewLayout;
  }
}
