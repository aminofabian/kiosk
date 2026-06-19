export interface POProductLineInput {
  qty: string;
  cost: string;
}

export interface NewPODraft {
  department: string;
  supplierId: string;
  notes: string;
  showNotes: boolean;
  lineInputs: Record<string, POProductLineInput>;
  savedAt: number;
}

function draftKey(userId: string): string {
  return `dept-po-new-draft:${userId}`;
}

export function loadNewPODraft(userId: string): NewPODraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(draftKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NewPODraft;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveNewPODraft(userId: string, draft: Omit<NewPODraft, "savedAt">): void {
  if (typeof window === "undefined") return;
  try {
    const payload: NewPODraft = { ...draft, savedAt: Date.now() };
    localStorage.setItem(draftKey(userId), JSON.stringify(payload));
  } catch {
    // Ignore quota / private mode errors
  }
}

export function clearNewPODraft(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(draftKey(userId));
  } catch {
    // Ignore
  }
}

export function draftHasProgress(draft: NewPODraft): boolean {
  if (draft.supplierId || draft.notes.trim()) return true;
  return Object.values(draft.lineInputs).some(
    (line) => line.qty.trim() !== "" || line.cost.trim() !== "",
  );
}
