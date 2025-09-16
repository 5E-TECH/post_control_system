import { useSearchParams } from "react-router-dom";

interface Params {
  [key: string]: string | number;
}

export const useParamsHook = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const setParam = (key: string, value: string | number) => {
    if (
      typeof key === "string" &&
      (typeof value === "string" || typeof value === "number")
    ) {
      searchParams.set(key, value.toString());
      setSearchParams(searchParams);
    }
  };

  const getParam = (key: string): string | null => {
    if (typeof key === "string") {
      return searchParams.get(key);
    }
    return null;
  };

  const setParams = (params: Params) => {
    if (typeof params === "object" && !Array.isArray(params)) {
      Object.keys(params).forEach((key) => {
        if (
          typeof key === "string" &&
          (typeof params[key] === "string" || typeof params[key] === "number")
        ) {
          searchParams.set(key, params[key].toString());
        }
      });
      setSearchParams(searchParams);
    }
  };

  const getParams = (): Params => {
    const params: Params = {};
    for (let [key, value] of searchParams.entries()) {
      params[key] = value;
    }
    return params;
  };

  const removeParam = (key: string) => {
    if (typeof key === "string") {
      searchParams.delete(key);
      setSearchParams(searchParams);
    }
  };

  const removeParams = (keys: string[]) => {
    if (Array.isArray(keys) && keys.every((key) => typeof key === "string")) {
      keys.forEach((key) => searchParams.delete(key));
      setSearchParams(searchParams);
    }
  };

  const clearParams = () => {
    setSearchParams({});
  };

  return {
    setParam,
    getParam,
    setParams,
    getParams,
    removeParam,
    removeParams,
    clearParams,
  };
};
