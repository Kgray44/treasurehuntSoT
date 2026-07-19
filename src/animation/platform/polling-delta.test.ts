import { describe, expect, it } from "vitest";
import { reconcileVersionedRows } from "./polling-delta";

type Row = { id: string; version: number; group: string };
const row = (id: string, version = 1, group = "active"): Row => ({ id, version, group });
const reconcile = (previous: Row[], next: Row[], previousVersion = 1, nextVersion = 2) =>
  reconcileVersionedRows({
    previous,
    next,
    previousVersion,
    nextVersion,
    getId: (item) => item.id,
    getVersion: (item) => item.version,
    getGroup: (item) => item.group,
  });

describe("polling delta reconciliation", () => {
  it("retains row and collection identity for an unchanged payload", () => {
    const existing = [row("one")];
    const result = reconcile(existing, [row("one")]);
    expect(result.changed).toBe(false);
    expect(result.rows).toBe(existing);
    expect(result.rows[0]).toBe(existing[0]);
  });

  it("reports one changed row without replaying unchanged neighbors", () => {
    const existing = [row("one"), row("two")];
    const result = reconcile(existing, [row("one"), row("two", 2)]);
    expect(result.changedIds).toEqual(["two"]);
    expect(result.rows[0]).toBe(existing[0]);
    expect(result.rows[1]).not.toBe(existing[1]);
  });

  it("distinguishes regrouped, removed, and added rows", () => {
    const result = reconcile(
      [row("move"), row("remove")],
      [row("move", 1, "complete"), row("add")],
    );
    expect(result.regroupedIds).toEqual(["move"]);
    expect(result.removedIds).toEqual(["remove"]);
    expect(result.addedIds).toEqual(["add"]);
  });

  it("ignores duplicate and out-of-order payload versions", () => {
    const existing = [row("one")];
    expect(reconcile(existing, [row("two")], 4, 4)).toMatchObject({
      rows: existing,
      duplicateVersion: true,
      changed: false,
    });
    expect(reconcile(existing, [row("two")], 4, 3)).toMatchObject({
      rows: existing,
      outOfOrderVersion: true,
      changed: false,
    });
  });
});

