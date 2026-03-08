import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { createSwapy } from "swapy";
import type { Swapy } from "swapy";

const STORAGE_KEY = "oc-overview-card-order";

/**
 * Overview layout wrapper that enables drag-to-swap card reordering
 * using the swapy library. Card order is persisted in localStorage.
 */
@customElement("oc-overview-layout")
export class OcOverviewLayout extends LitElement {
  private _swapy: Swapy | null = null;

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
      this._restoreOrder();
      this._initSwapy();
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._swapy?.destroy();
    this._swapy = null;
  }

  /** Restore saved slot ordering by rearranging DOM children */
  private _restoreOrder() {
    const container = this.querySelector(".overview-swapy");
    if (!container) {
      return;
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return;
    }
    try {
      const order = JSON.parse(saved) as Array<{ slot: string; item: string }>;
      // Rearrange slot divs to match saved order
      for (const { slot } of order) {
        const el = container.querySelector(`[data-swapy-slot="${slot}"]`);
        if (el) {
          container.appendChild(el);
        }
      }
    } catch {
      // ignore corrupted data
    }
  }

  private _initSwapy() {
    const container = this.querySelector(".overview-swapy");
    if (!container) {
      return;
    }

    this._swapy = createSwapy(container, {
      swapMode: "hover",
      animation: "dynamic",
      autoScrollOnDrag: true,
      dragOnHold: true,
    });

    this._swapy.onSwapEnd((event) => {
      if (event.hasChanged) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(event.slotItemMap.asArray));
      }
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "oc-overview-layout": OcOverviewLayout;
  }
}
