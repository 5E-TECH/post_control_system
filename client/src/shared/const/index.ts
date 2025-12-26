const meta = import.meta.env;

export const IMAGE_URL = meta.VITE_IMAGE_URL;
export const BASE_URL = meta.VITE_BASE_URL;
export const BASE_ADMIN_URL = import.meta.env.BASE_URL;

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
