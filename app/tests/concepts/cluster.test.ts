import { describe, expect, it } from "vitest";
import { dbscanCluster } from "../../scripts/concepts/lib/cluster";

describe("dbscanCluster", () => {
  it("groups close points and isolates far ones", () => {
    // Two tight clusters + one outlier in 2D
    const phrases = ["a1", "a2", "a3", "b1", "b2", "outlier"];
    const vectors = [
      [0.0, 0.0],
      [0.05, 0.0],
      [0.0, 0.05],
      [10.0, 10.0],
      [10.05, 10.0],
      [50.0, 50.0],
    ];
    const clusters = dbscanCluster(phrases, vectors, { eps: 0.2, minPoints: 2 });
    const byCluster = new Map<number, string[]>();
    for (const c of clusters) byCluster.set(c.clusterId, c.members);

    expect(byCluster.size).toBe(3); // 2 real + 1 noise
    const noise = byCluster.get(-1);
    expect(noise).toEqual(["outlier"]);

    const real = [...byCluster.entries()].filter(([id]) => id !== -1);
    expect(real).toHaveLength(2);
    expect(real.map(([, m]) => m.sort())).toEqual(
      expect.arrayContaining([
        ["a1", "a2", "a3"],
        ["b1", "b2"],
      ]),
    );
  });

  it("returns empty array for empty input", () => {
    expect(dbscanCluster([], [], { eps: 0.2, minPoints: 2 })).toEqual([]);
  });
});
