const meta = import.meta.env;

export const IMAGE_URL = meta.VITE_IMAGE_URL;
export const BASE_URL = meta.VITE_BASE_URL;
export const BASE_ADMIN_URL = import.meta.env.BASE_URL;

// Default product image - SVG placeholder with product icon
export const DEFAULT_PRODUCT_IMAGE =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNmM2Y0ZjYiLz48cmVjdCB4PSIyNSIgeT0iMjAiIHdpZHRoPSI1MCIgaGVpZ2h0PSI2MCIgcng9IjQiIGZpbGw9IiNkMWQ1ZGIiLz48cmVjdCB4PSIzMCIgeT0iMzUiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcng9IjIiIGZpbGw9IiNlNWU3ZWIiLz48Y2lyY2xlIGN4PSI0MCIgY3k9IjUwIiByPSI1IiBmaWxsPSIjOWNhM2FmIi8+PHBhdGggZD0iTTM1IDY1bDEwLTEwIDUgNSAxNS0xNXYxNUgzNXoiIGZpbGw9IiM5Y2EzYWYiLz48cmVjdCB4PSIzNSIgeT0iMjUiIHdpZHRoPSIzMCIgaGVpZ2h0PSI2IiByeD0iMSIgZmlsbD0iIzljYTNhZiIvPjwvc3ZnPg==";

export const buildAdminPath = (
  path: string = "",
  options?: { absolute?: boolean }
) => {
  const base = BASE_ADMIN_URL.replace(/\/$/, "");
  const normalizedPath = path ? `/${path.replace(/^\//, "")}` : "/";

  if (options?.absolute && base && base !== "/") {
    return normalizedPath === "/" ? `${base}/` : `${base}${normalizedPath}`;
  }

  return normalizedPath;
};
