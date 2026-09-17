// Audit writes must not turn an otherwise successful user action into an error.
export async function recordAudit(db, event) {
  try {
    await db.audit.record(event);
  } catch (error) {
    console.warn('[audit] 기록 실패:', error?.message || error);
  }
}
