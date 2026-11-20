import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("INVENTRA – Mobile PWA iOS Issues Resolution Test Suite", async (t) => {
  const rootDir = process.cwd();

  await t.test("Issue 1: Sidebar Touch Alignment & Drag Ghosting Prevention", async (st) => {
    const sidebarPath = path.join(rootDir, "src/components/layout/sidebar.tsx");
    assert.ok(fs.existsSync(sidebarPath), "sidebar.tsx should exist");
    const content = fs.readFileSync(sidebarPath, "utf-8");

    await st.test("should ensure minimum 44px touch targets on navigation items", () => {
      assert.ok(
        content.includes("min-h-[44px]"),
        "Sidebar navigation links must have min-h-[44px] for iOS touch ergonomics"
      );
    });

    await st.test("should prevent iOS drag previews with draggable={false}", () => {
      assert.ok(
        content.includes("draggable={false}"),
        "Sidebar navigation links must disable native dragging to prevent ghost drag badges on iOS"
      );
    });

    await st.test("should apply select-none and touch-manipulation to sidebar links and aside", () => {
      assert.ok(
        content.includes("touch-manipulation"),
        "Sidebar must enforce touch-manipulation to eliminate 300ms tap delay"
      );
      assert.ok(
        content.includes("select-none"),
        "Sidebar must enforce select-none to prevent text selection callouts on tap"
      );
    });

    await st.test("should auto-close mobile drawer on route pathname change", () => {
      assert.ok(
        content.includes("setMobileOpen(false)") && content.includes("[pathname, setMobileOpen]"),
        "Sidebar must automatically close when route pathname updates"
      );
    });

    await st.test("should verify globals.css sets -webkit-user-drag: none and -webkit-touch-callout: none", () => {
      const cssPath = path.join(rootDir, "src/app/globals.css");
      const css = fs.readFileSync(cssPath, "utf-8");
      assert.ok(
        css.includes("-webkit-touch-callout: none") && css.includes("-webkit-user-drag: none"),
        "globals.css must disable touch callouts and user drag on iOS WebKit"
      );
    });
  });

  await t.test("Issue 2: Responsive Headings & Text Overflow Elimination", async (st) => {
    await st.test("should ensure Executive Dashboard heading in dashboard-client.tsx wraps cleanly without whitespace-nowrap", () => {
      const dashPath = path.join(rootDir, "src/app/(authenticated)/dashboard/dashboard-client.tsx");
      const content = fs.readFileSync(dashPath, "utf-8");

      assert.ok(
        !content.includes('Executive Dashboard\n            </h1>\n            <div className="flex items-center gap-1.5 shrink-0">') &&
        !content.includes('Executive Dashboard\r\n            </h1>\r\n            <div className="flex items-center gap-1.5 shrink-0">'),
        "Old inflexible layout structure should be replaced"
      );
      assert.ok(
        content.includes("break-words"),
        "Executive Dashboard title must have break-words for responsive wrapping"
      );
      assert.ok(
        content.includes("text-xl sm:text-2xl"),
        "Executive Dashboard title must use responsive font sizing"
      );
      // Ensure the h1 line itself does NOT have whitespace-nowrap
      const h1Match = content.match(/<h1[^>]*>[\s\S]*?Executive Dashboard[\s\S]*?<\/h1>/);
      assert.ok(h1Match, "Should find Executive Dashboard h1");
      assert.ok(
        !h1Match[0].includes("whitespace-nowrap"),
        "Executive Dashboard h1 must NOT contain whitespace-nowrap"
      );
    });

    await st.test("should verify other module headings support break-words and responsive sizes", () => {
      const modulesToCheck = [
        "src/app/(authenticated)/inventory/page.tsx",
        "src/app/(authenticated)/delivery-notes/page.tsx",
        "src/app/(authenticated)/return-notes/page.tsx",
        "src/app/(authenticated)/invoices/page.tsx",
        "src/app/(authenticated)/customers/page.tsx",
        "src/app/(authenticated)/materials/page.tsx",
        "src/app/(authenticated)/rentals/page.tsx",
        "src/app/(authenticated)/fleet/page.tsx",
        "src/app/(authenticated)/labour/page.tsx",
        "src/app/(authenticated)/accounting/page.tsx",
      ];

      for (const relPath of modulesToCheck) {
        const fullPath = path.join(rootDir, relPath);
        assert.ok(fs.existsSync(fullPath), `${relPath} should exist`);
        const fileContent = fs.readFileSync(fullPath, "utf-8");
        assert.ok(
          fileContent.includes("break-words"),
          `${relPath} heading must contain break-words for mobile safety`
        );
      }
    });

    await st.test("should ensure topbar breadcrumbs truncate on narrow screens", () => {
      const topbarPath = path.join(rootDir, "src/components/layout/topbar.tsx");
      const content = fs.readFileSync(topbarPath, "utf-8");
      assert.ok(
        content.includes("truncate") && content.includes("min-w-0"),
        "Topbar breadcrumb title must have truncate and min-w-0"
      );
    });
  });

  await t.test("Issue 3: iOS Standalone PWA Link Containment & Scope", async (st) => {
    await st.test("should verify IosPwaLinkHandler component exists and intercepts standalone navigation", () => {
      const handlerPath = path.join(rootDir, "src/components/pwa/ios-pwa-link-handler.tsx");
      assert.ok(fs.existsSync(handlerPath), "ios-pwa-link-handler.tsx must exist");
      const content = fs.readFileSync(handlerPath, "utf-8");

      assert.ok(content.includes("standalone"), "Must check for iOS standalone mode");
      assert.ok(content.includes("capture: true"), "Must attach click listener on capture phase");
      assert.ok(content.includes("e.preventDefault()"), "Must prevent native WebKit breakout navigation");
      assert.ok(content.includes("router.push"), "Must delegate navigation to Next.js router.push");
      assert.ok(content.includes("inventra-nav-start"), "Must trigger navigation progress event");
    });

    await st.test("should mount IosPwaLinkHandler in root layout.tsx", () => {
      const layoutPath = path.join(rootDir, "src/app/layout.tsx");
      const content = fs.readFileSync(layoutPath, "utf-8");

      assert.ok(
        content.includes("<IosPwaLinkHandler />") || content.includes("<IosPwaLinkHandler/>"),
        "Root layout must mount IosPwaLinkHandler"
      );
      assert.ok(
        content.includes('apple-mobile-web-app-capable": "yes"'),
        "Root layout must include apple-mobile-web-app-capable meta tag"
      );
    });

    await st.test("should verify manifest has root start_url and scope /", () => {
      const manifestPath = path.join(rootDir, "src/app/manifest.ts");
      const content = fs.readFileSync(manifestPath, "utf-8");

      assert.ok(content.includes('start_url: "/"'), "Manifest start_url must be root /");
      assert.ok(content.includes('scope: "/"'), "Manifest scope must be /");
      assert.ok(content.includes('display: "standalone"'), "Manifest display must be standalone");
    });
  });
});
