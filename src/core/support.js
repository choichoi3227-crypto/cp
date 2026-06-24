export function createTicket({ owner, subject, message, priority = 'normal' }) {
  const cleanSubject = String(subject || '').trim();
  const cleanMessage = String(message || '').trim();
  if (cleanSubject.length < 3 || cleanSubject.length > 120) throw new Error('문의 제목은 3~120자여야 합니다.');
  if (cleanMessage.length < 10 || cleanMessage.length > 4000) throw new Error('문의 내용은 10~4000자여야 합니다.');
  const allowedPriority = new Set(['low', 'normal', 'high', 'urgent']);
  const normalizedPriority = allowedPriority.has(priority) ? priority : 'normal';
  return { id: crypto.randomUUID(), owner, subject: cleanSubject, message: cleanMessage, priority: normalizedPriority, status: 'open', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}
