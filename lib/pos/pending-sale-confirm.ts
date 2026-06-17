/** Browser confirm before discarding a server-linked pending sale. */
export function confirmDiscardLinkedPendingSale(
  isDepartment: boolean,
  reason: string,
): boolean {
  if (typeof window === "undefined") return true;
  const kind = isDepartment ? "department order" : "saved cart";
  return window.confirm(
    `${reason}\n\nThis will discard the linked ${kind} on the server. Continue?`,
  );
}
