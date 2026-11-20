import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "INVENTRA Driver Portal & Centering ERP",
    short_name: "INVENTRA",
    description: "AJAY ENTERPRISES Logistics, Centering Delivery & Material Returns ERP",
    // Base root start_url for universal portal routing (/ redirects to /delivery-portal for drivers, /dashboard for execs)
    // start_url: "/delivery-portal" is also supported for driver direct shortcut
    start_url: "/",
    scope: "/",
    id: "/",
    display: "standalone",
    background_color: "#0B1E36",
    theme_color: "#0B1E36",
    orientation: "portrait",
    categories: ["business", "productivity", "utilities"],
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Driver Delivery Portal",
        short_name: "Deliveries",
        description: "Assigned outward dispatches and customer delivery execution",
        url: "/delivery-portal?tab=deliveries",
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }],
      },
      {
        name: "Material Return Pickups",
        short_name: "Pickups",
        description: "Assigned return collections and site inspections",
        url: "/delivery-portal?tab=pickups",
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }],
      },
      {
        name: "Vehicle Trips",
        short_name: "Trips",
        description: "Assigned vehicle trips and delivery runs",
        url: "/fleet/trips",
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }],
      },
      {
        name: "Executive Dashboard",
        short_name: "Dashboard",
        description: "Real-time management overview and centering operations",
        url: "/dashboard",
        icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }],
      },
    ],
  };
}
