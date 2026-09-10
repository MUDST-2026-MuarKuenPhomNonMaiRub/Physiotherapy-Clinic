import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  /**
   * Prerendered pages are served with `s-maxage` and no `max-age`, which browsers
   * are free to treat with heuristic freshness — so a document can be reused
   * from disk without asking the server. That is fine for a site that never
   * changes underneath its visitors, and wrong for this one: every deploy gives
   * the JS chunks new names, and a reused document still points at the old ones.
   * The chunks are gone, nothing mounts, and the tab shows a blank page while a
   * freshly opened one works.
   *
   * Documents are therefore always revalidated. Hashed assets under
   * /_next/static keep their immutable year, so this costs one conditional
   * request per navigation, not the payload.
   */
  async headers() {
    return [
      {
        // Everything but the hashed assets, which keep the year Next gives them.
        source: "/((?!_next/static/).*)",
        headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
