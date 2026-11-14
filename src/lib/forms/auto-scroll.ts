"use client";

/**
 * Attempts to find a DOM element corresponding to a form field name.
 */
export function findFieldElement(
  fieldName: string,
  root: HTMLElement | Document = typeof document !== "undefined" ? document : ({} as Document)
): HTMLElement | null {
  if (!root || !fieldName) return null;

  // Clean the field name for selector queries
  const cleanField = fieldName.replace(/[\[\]\.]/g, "_");
  const rawField = fieldName;
  const leafField = fieldName.split(".").pop()?.replace(/\[\d+\]/, "") || fieldName;
  const capitalized = leafField.charAt(0).toUpperCase() + leafField.slice(1);

  const candidateSelectors = [
    // Direct matches
    `[name="${rawField}"]`,
    `[id="${rawField}"]`,
    `[name="${leafField}"]`,
    `[id="${leafField}"]`,

    // Common INVENTRA prefixes (e.g., custPan, custGstin, custMobile, custCode, siteCode)
    `[id="cust${capitalized}"]`,
    `[id="site${capitalized}"]`,
    `[id="field_${rawField}"]`,
    `[id="field_${cleanField}"]`,

    // Data attributes
    `[data-field="${rawField}"]`,
    `[data-field="${leafField}"]`,
    `[data-testid="${rawField}"]`,
    `[data-testid="${leafField}"]`,

    // Special field aliases (e.g. GPS coordinates to Google Maps link field)
    ...(leafField === "gpsLatitude" || leafField === "gpsLongitude" || leafField === "mapsUrl"
      ? [`#siteMapsUrl`, `[name="mapsUrl"]`, `[data-field="mapsUrl"]`, `[data-field-container="gpsCoordinates"]`]
      : []),

    // Aria labels & placeholders
    `input[placeholder*="${leafField}" i]`,
    `textarea[placeholder*="${leafField}" i]`,
  ];

  for (const selector of candidateSelectors) {
    try {
      const el = root.querySelector<HTMLElement>(selector);
      if (el) return el;
    } catch {
      // Ignore malformed selector syntax
    }
  }

  return null;
}

/**
 * Checks whether the element is inside an inactive tab or collapsed container,
 * and expands/activates it so the element becomes visible before scrolling.
 */
export function revealFieldIfHidden(element: HTMLElement): void {
  if (typeof window === "undefined" || !element) return;

  // 1. Inside a closed <details> element
  const details = element.closest("details");
  if (details && !details.open) {
    details.open = true;
  }

  // 2. Inside an inactive Radix Tabs content panel: [role="tabpanel"][data-state="inactive"]
  const inactiveTabPanel = element.closest<HTMLElement>(
    '[role="tabpanel"][data-state="inactive"], [data-radix-tabs-content][data-state="inactive"]'
  );
  if (inactiveTabPanel) {
    const tabId = inactiveTabPanel.getAttribute("id");
    const ariaLabelledby = inactiveTabPanel.getAttribute("aria-labelledby");

    let trigger: HTMLElement | null = null;
    if (ariaLabelledby) {
      trigger = document.getElementById(ariaLabelledby);
    } else if (tabId) {
      trigger = document.querySelector<HTMLElement>(`[aria-controls="${tabId}"]`);
    }

    if (trigger && typeof trigger.click === "function") {
      trigger.click();
    }
  }

  // 3. Inside a collapsed Accordion panel
  const collapsedAccordion = element.closest<HTMLElement>(
    '[data-state="closed"][data-radix-accordion-content], [role="region"][aria-hidden="true"]'
  );
  if (collapsedAccordion) {
    const accordionId = collapsedAccordion.getAttribute("id");
    const trigger = document.querySelector<HTMLElement>(
      `[aria-controls="${accordionId}"][data-state="closed"]`
    );
    if (trigger && typeof trigger.click === "function") {
      trigger.click();
    }
  }
}

export interface ScrollOptions {
  container?: HTMLElement | null;
  offset?: number;
  focus?: boolean;
}

/**
 * Scrolls smoothly to the first invalid field in the form, ensuring it is positioned
 * comfortably below sticky headers and modals, and focuses the input.
 */
export function scrollToFirstInvalidField(
  fieldNames: string[] | Record<string, any>,
  options: ScrollOptions = {}
): boolean {
  if (typeof window === "undefined") return false;

  const names: string[] = Array.isArray(fieldNames)
    ? fieldNames
    : Object.keys(fieldNames || {});

  if (names.length === 0) return false;

  const root = options.container || document;

  // Locate the first element that exists in the DOM
  let targetElement: HTMLElement | null = null;
  for (const name of names) {
    const el = findFieldElement(name, root);
    if (el) {
      targetElement = el;
      break;
    }
  }

  if (!targetElement) return false;

  // Reveal element if tucked inside an inactive tab or accordion
  revealFieldIfHidden(targetElement);

  // Check user preference for reduced motion
  const prefersReducedMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const behavior: ScrollBehavior = prefersReducedMotion ? "auto" : "smooth";

  // Check if we are inside a scrollable modal container (e.g. Radix DialogContent)
  const modalScrollContainer = targetElement.closest<HTMLElement>(
    '[role="dialog"], [data-radix-dialog-content], .overflow-y-auto'
  );

  const headerOffset = options.offset ?? 90;

  // Perform smooth scrolling
  setTimeout(() => {
    try {
      if (modalScrollContainer && modalScrollContainer !== document.body) {
        // Modal scrolling
        const containerRect = modalScrollContainer.getBoundingClientRect();
        const elementRect = targetElement!.getBoundingClientRect();
        const currentScroll = modalScrollContainer.scrollTop;
        const targetScroll =
          currentScroll + (elementRect.top - containerRect.top) - headerOffset;

        modalScrollContainer.scrollTo({
          top: Math.max(0, targetScroll),
          behavior,
        });
      } else {
        // Window scrolling with sticky header offset
        const elementRect = targetElement!.getBoundingClientRect();
        const absoluteElementTop = elementRect.top + window.pageYOffset;
        const targetScroll = absoluteElementTop - headerOffset;

        window.scrollTo({
          top: Math.max(0, targetScroll),
          behavior,
        });
      }
    } catch {
      // Fallback
      targetElement!.scrollIntoView({ behavior, block: "center" });
    }

    // Auto-focus the input
    if (options.focus !== false) {
      setTimeout(() => {
        try {
          if (
            targetElement instanceof HTMLInputElement ||
            targetElement instanceof HTMLTextAreaElement ||
            targetElement instanceof HTMLSelectElement ||
            targetElement?.getAttribute("tabindex") !== null
          ) {
            targetElement.focus({ preventScroll: true });
          } else {
            // If it's a combobox container, focus its child button or input
            const innerFocusable = targetElement?.querySelector<HTMLElement>(
              "input, button, [tabindex]"
            );
            if (innerFocusable) {
              innerFocusable.focus({ preventScroll: true });
            }
          }
        } catch {
          // Ignore focus errors
        }
      }, 150);
    }
  }, 50);

  return true;
}
