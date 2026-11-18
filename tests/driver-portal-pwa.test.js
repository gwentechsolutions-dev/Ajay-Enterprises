import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("INVENTRA – Driver Delivery Portal Mobile Redesign, Tablet Layout & PWA Test Suite", async (t) => {
  const rootDir = process.cwd();

  await t.test("PWA Assets & Manifest Specification", async (st) => {
    await st.test("should have all required PWA icons generated with correct sizes", () => {
      const iconFiles = [
        "public/icons/icon-192x192.png",
        "public/icons/icon-512x512.png",
        "public/icons/icon-maskable-192x192.png",
        "public/icons/icon-maskable-512x512.png",
        "public/icons/apple-touch-icon.png",
        "public/icons/badge-72x72.png",
      ];

      for (const relPath of iconFiles) {
        const fullPath = path.join(rootDir, relPath);
        assert.ok(fs.existsSync(fullPath), `Expected icon file ${relPath} to exist`);
        const stats = fs.statSync(fullPath);
        assert.ok(stats.size > 500, `Expected icon file ${relPath} to be non-empty (was ${stats.size} bytes)`);

        // Verify PNG magic header: 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A
        const fd = fs.openSync(fullPath, "r");
        const buffer = Buffer.alloc(8);
        fs.readSync(fd, buffer, 0, 8, 0);
        fs.closeSync(fd);
        assert.strictEqual(buffer[0], 0x89, `${relPath} should have valid PNG magic byte 0x89`);
        assert.strictEqual(buffer.toString("ascii", 1, 4), "PNG", `${relPath} should have PNG signature`);
      }
    });

    await st.test("should define valid Next.js PWA manifest route configuration", () => {
      const manifestPath = path.join(rootDir, "src/app/manifest.ts");
      assert.ok(fs.existsSync(manifestPath), "manifest.ts should exist");
      const content = fs.readFileSync(manifestPath, "utf-8");

      assert.ok(content.includes("INVENTRA Driver Portal"), "Should have application name");
      assert.ok(content.includes('short_name: "INVENTRA"'), "Should have short name INVENTRA");
      assert.ok(content.includes('start_url: "/delivery-portal"'), "Should start at /delivery-portal for drivers");
      assert.ok(content.includes('display: "standalone"'), "Should be standalone PWA display mode");
      assert.ok(content.includes('background_color: "#0B1E36"'), "Should have INVENTRA Navy background color");
      assert.ok(content.includes('theme_color: "#0B1E36"'), "Should have INVENTRA Navy theme color");
      assert.ok(content.includes("/icons/icon-192x192.png"), "Should reference 192x192 icon");
      assert.ok(content.includes("/icons/icon-512x512.png"), "Should reference 512x512 icon");
      assert.ok(content.includes('purpose: "maskable"'), "Should reference maskable icon purpose");
      assert.ok(content.includes('url: "/delivery-portal?tab=deliveries"'), "Should have Deliveries shortcut");
      assert.ok(content.includes('url: "/delivery-portal?tab=pickups"'), "Should have Pickups shortcut");
    });

    await st.test("should verify PWA service worker with offline caching strategy", () => {
      const swPath = path.join(rootDir, "public/sw.js");
      assert.ok(fs.existsSync(swPath), "public/sw.js should exist");
      const content = fs.readFileSync(swPath, "utf-8");

      assert.ok(content.includes("self.addEventListener(\"install\""), "SW should handle install event");
      assert.ok(content.includes("self.addEventListener(\"activate\""), "SW should handle activate event");
      assert.ok(content.includes("self.addEventListener(\"fetch\""), "SW should handle fetch event");
      assert.ok(content.includes("self.skipWaiting()"), "SW should skip waiting for instant updates");
      assert.ok(content.includes("clients.claim()"), "SW should claim clients on activation");

      // Verify sensitive routes are excluded from caching
      assert.ok(content.includes("api\\/v1\\/auth") || content.includes("/api/v1/auth/"), "SW should explicitly bypass auth from caching");
      assert.ok(content.includes("storage\\/download") || content.includes("/api/v1/storage/download"), "SW should explicitly bypass signed storage URLs from caching");
    });

    await st.test("should verify app layout includes viewport and manifest metadata", () => {
      const layoutPath = path.join(rootDir, "src/app/layout.tsx");
      const content = fs.readFileSync(layoutPath, "utf-8");

      assert.ok(content.includes('themeColor: "#0B1E36"'), "Layout viewport should define INVENTRA themeColor");
      assert.ok(content.includes('viewportFit: "cover"'), "Layout viewport should define viewportFit cover for notch support");
      assert.ok(content.includes('manifest: "/manifest.webmanifest"'), "Layout metadata should link to webmanifest");
      assert.ok(content.includes("appleWebApp:"), "Layout metadata should configure appleWebApp");
    });
  });

  await t.test("Responsive Layout & Presentation Modes", async (st) => {
    await st.test("should adapt AppShell on mobile for /delivery-portal", () => {
      const shellPath = path.join(rootDir, "src/components/layout/app-shell.tsx");
      const content = fs.readFileSync(shellPath, "utf-8");

      assert.ok(content.includes('const isDeliveryPortal = pathname === "/delivery-portal"'), "AppShell should detect /delivery-portal");
      assert.ok(content.includes('isDeliveryPortal && "max-md:ml-0"'), "Should remove sidebar margin on mobile");
      assert.ok(content.includes('isDeliveryPortal && "max-md:hidden"'), "Should hide desktop topbar on mobile for delivery portal");
      assert.ok(content.includes('max-md:pb-24'), "Should provide bottom padding for mobile navigation bar");
    });

    await st.test("should define 5 dedicated navigation tabs in DriverBottomNav", () => {
      const navPath = path.join(rootDir, "src/components/driver-portal/DriverBottomNav.tsx");
      assert.ok(fs.existsSync(navPath), "DriverBottomNav.tsx should exist");
      const content = fs.readFileSync(navPath, "utf-8");

      assert.ok(content.includes('"HOME"'), "Should define HOME tab");
      assert.ok(content.includes('"DELIVERIES"'), "Should define DELIVERIES tab");
      assert.ok(content.includes('"PICKUPS"'), "Should define PICKUPS tab");
      assert.ok(content.includes('"TRIPS"'), "Should define TRIPS tab");
      assert.ok(content.includes('"PROFILE"'), "Should define PROFILE tab");

      // Verify touch target >= 48px and haptic feedback
      assert.ok(content.includes("min-h-[50px]"), "Bottom nav items should meet touch target standards (>= 48px)");
      assert.ok(content.includes("navigator.vibrate"), "Should trigger haptic feedback on tab selection");
    });

    await st.test("should implement long-press FAB with 600ms hold duration and RBAC gating", () => {
      const fabPath = path.join(rootDir, "src/components/driver-portal/DriverQuickActions.tsx");
      assert.ok(fs.existsSync(fabPath), "DriverQuickActions.tsx should exist");
      const content = fs.readFileSync(fabPath, "utf-8");

      assert.ok(content.includes("HOLD_DURATION = 600"), "Should enforce 600ms long-press hold duration");
      assert.ok(content.includes("requestAnimationFrame"), "Should animate circular progress bar smoothly");
      assert.ok(content.includes("navigator.vibrate(40)"), "Should trigger haptic vibration upon long-press completion");
      assert.ok(content.includes("canCreateDN"), "Should support canCreateDN permission prop");
      assert.ok(content.includes("canCreateMRN"), "Should support canCreateMRN permission prop");
      assert.ok(content.includes("canCreateInvoice"), "Should support canCreateInvoice permission prop");
      assert.ok(content.includes("quickActionInvoiceRestricted"), "Should explain restriction for drivers on invoices");
    });

    await st.test("should support tablet 2-column layout and desktop ERP preservation", () => {
      const portalPath = path.join(rootDir, "src/app/(authenticated)/delivery-portal/page.tsx");
      const content = fs.readFileSync(portalPath, "utf-8");

      assert.ok(content.includes("md:grid md:grid-cols-12 md:gap-6"), "Should use 12-column grid for tablet and desktop");
      assert.ok(content.includes("md:col-span-7 lg:col-span-8"), "Main task column should span 7-8 columns on md+");
      assert.ok(content.includes("hidden md:block md:col-span-5 lg:col-span-4"), "Sidebar column should span 4-5 columns on md+");
      assert.ok(content.includes("<DriverBottomNav"), "Should render DriverBottomNav");
      assert.ok(content.includes("<DriverQuickActions"), "Should render DriverQuickActions");
      assert.ok(content.includes("<IosInstallDialog"), "Should render IosInstallDialog");
      assert.ok(content.includes("<PwaProvider>"), "Should wrap page in PwaProvider");
    });
  });

  await t.test("Offline Queue & User Isolation", async (st) => {
    await st.test("should support user-scoped offline drafts and separate capturedAt timestamp", () => {
      const draftsPath = path.join(rootDir, "src/lib/offline/drafts.ts");
      const content = fs.readFileSync(draftsPath, "utf-8");

      assert.ok(content.includes("userId?: string"), "Drafts should support optional userId scoping");
      assert.ok(content.includes("capturedAt?: string"), "Drafts should preserve capturedAt distinctly from createdAt");
      assert.ok(content.includes("queueOfflineDraft"), "Should export queueOfflineDraft function");
      assert.ok(content.includes("syncPendingDrafts"), "Should export syncPendingDrafts function");
      assert.ok(content.includes("getOfflineQueue"), "Should export getOfflineQueue function");
    });
  });
});
