export type VersionedRowDiff<T> = Readonly<{
  rows: readonly T[];
  changed: boolean;
  duplicateVersion: boolean;
  outOfOrderVersion: boolean;
  addedIds: readonly string[];
  changedIds: readonly string[];
  regroupedIds: readonly string[];
  removedIds: readonly string[];
}>;

export function reconcileVersionedRows<T>({
  previous,
  next,
  previousVersion,
  nextVersion,
  getId,
  getVersion,
  getGroup = () => "",
}: {
  previous: readonly T[];
  next: readonly T[];
  previousVersion: number;
  nextVersion: number;
  getId: (row: T) => string;
  getVersion: (row: T) => string | number;
  getGroup?: (row: T) => string;
}): VersionedRowDiff<T> {
  if (nextVersion < previousVersion) {
    return {
      rows: previous,
      changed: false,
      duplicateVersion: false,
      outOfOrderVersion: true,
      addedIds: [],
      changedIds: [],
      regroupedIds: [],
      removedIds: [],
    };
  }
  if (nextVersion === previousVersion) {
    return {
      rows: previous,
      changed: false,
      duplicateVersion: true,
      outOfOrderVersion: false,
      addedIds: [],
      changedIds: [],
      regroupedIds: [],
      removedIds: [],
    };
  }

  const previousById = new Map(previous.map((row) => [getId(row), row]));
  const nextIds = new Set(next.map(getId));
  const addedIds: string[] = [];
  const changedIds: string[] = [];
  const regroupedIds: string[] = [];
  const rows = next.map((row) => {
    const id = getId(row);
    const old = previousById.get(id);
    if (!old) {
      addedIds.push(id);
      return row;
    }
    if (getGroup(old) !== getGroup(row)) regroupedIds.push(id);
    if (getVersion(old) !== getVersion(row) || getGroup(old) !== getGroup(row)) {
      changedIds.push(id);
      return row;
    }
    return old;
  });
  const removedIds = previous.filter((row) => !nextIds.has(getId(row))).map(getId);
  const changed = addedIds.length + changedIds.length + removedIds.length > 0;
  return {
    rows: changed ? rows : previous,
    changed,
    duplicateVersion: false,
    outOfOrderVersion: false,
    addedIds,
    changedIds,
    regroupedIds,
    removedIds,
  };
}

