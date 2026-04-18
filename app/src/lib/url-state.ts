import { useSearchParams } from "react-router-dom";
import { useCallback, useMemo } from "react";

export interface FilterState {
  q: string;
  challenge: string[];
  offers: string[];
  seeking: string[];
  partnerType: string[];
  orgType: string[];
  orgSize: string[];
  affiliation: string[];
  favoritesOnly: boolean;
  view: "cards" | "table";
  sort: "relevance" | "name" | "affiliation" | "richness";
}

const ARRAY_KEYS = [
  "challenge",
  "offers",
  "seeking",
  "partnerType",
  "orgType",
  "orgSize",
  "affiliation",
] as const;

export function useFilterState(): [FilterState, (updater: Partial<FilterState>) => void] {
  const [params, setParams] = useSearchParams();

  const state = useMemo<FilterState>(() => {
    const get = (k: string) => params.get(k) ?? "";
    const getArr = (k: string) =>
      params.getAll(k).flatMap((v) => v.split(",")).filter(Boolean);
    return {
      q: get("q"),
      challenge: getArr("challenge"),
      offers: getArr("offers"),
      seeking: getArr("seeking"),
      partnerType: getArr("partnerType"),
      orgType: getArr("orgType"),
      orgSize: getArr("orgSize"),
      affiliation: getArr("affiliation"),
      favoritesOnly: params.get("fav") === "1",
      view: (params.get("view") as "cards" | "table") ?? "cards",
      sort:
        (params.get("sort") as FilterState["sort"]) ?? "relevance",
    };
  }, [params]);

  const update = useCallback(
    (updater: Partial<FilterState>) => {
      const next = new URLSearchParams(params);
      for (const [k, v] of Object.entries(updater)) {
        if (k === "view" || k === "sort" || k === "q") {
          if (v && String(v).length > 0) next.set(k, String(v));
          else next.delete(k);
        } else if (k === "favoritesOnly") {
          if (v) next.set("fav", "1");
          else next.delete("fav");
        } else if ((ARRAY_KEYS as readonly string[]).includes(k)) {
          next.delete(k);
          for (const item of v as string[]) next.append(k, item);
        }
      }
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  return [state, update];
}
