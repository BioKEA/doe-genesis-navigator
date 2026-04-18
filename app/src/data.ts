import type { NetworkData, Profile } from "./types";

interface SearchBundle {
  docs: Array<{
    slug: string;
    name: string;
    introduction: string;
    offerings: string;
    seeking: string;
    projectIdea: string;
  }>;
  index: unknown;
}

interface Bundle {
  profiles: Profile[];
  network: NetworkData;
  search: SearchBundle;
}

let cache: Promise<Bundle> | null = null;

export function loadData(): Promise<Bundle> {
  if (!cache) {
    cache = (async () => {
      const [profiles, network, search] = await Promise.all([
        fetch("/data/profiles.json").then((r) => r.json() as Promise<Profile[]>),
        fetch("/data/network.json").then((r) => r.json() as Promise<NetworkData>),
        fetch("/data/search.json").then((r) => r.json() as Promise<SearchBundle>),
      ]);
      return { profiles, network, search };
    })();
  }
  return cache;
}
