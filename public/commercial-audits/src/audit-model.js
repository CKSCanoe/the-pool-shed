(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PoolAuditModel = api;
})(typeof window !== 'undefined' ? window : null, function () {
  const BACKUP_KIND = 'pool-bros-commercial-audit';

  function createAudit(id, now) {
    if (!id) throw new Error('An audit ID is required.');
    return {
      id, createdAt: now, updatedAt: now, status: 'draft',
      metadata: {}, responses: {}, assets: [], upgrades: [], actions: {}, assetDraft: null
    };
  }

  function normalise(audit) {
    if (!audit || typeof audit !== 'object' || Array.isArray(audit) || typeof audit.id !== 'string' || !audit.id) {
      throw new Error('This is not a valid audit record.');
    }
    return {
      ...audit,
      metadata: audit.metadata && typeof audit.metadata === 'object' && !Array.isArray(audit.metadata) ? audit.metadata : {},
      responses: audit.responses && typeof audit.responses === 'object' && !Array.isArray(audit.responses) ? audit.responses : {},
      assets: Array.isArray(audit.assets) ? audit.assets : [],
      upgrades: Array.isArray(audit.upgrades) ? audit.upgrades : [],
      actions: audit.actions && typeof audit.actions === 'object' && !Array.isArray(audit.actions) ? audit.actions : {},
      assetDraft: audit.assetDraft && typeof audit.assetDraft === 'object' && !Array.isArray(audit.assetDraft) ? audit.assetDraft : null,
      status: audit.status || 'draft'
    };
  }

  function assessmentItems(checklist) {
    return (checklist.sections || []).filter(section => section.id !== 'site-metadata')
      .flatMap(section => (section.items || []).map(item => ({ section, item })));
  }

  function actions(audit, checklist) {
    const current = normalise(audit);
    return assessmentItems(checklist).flatMap(({ section, item }) => {
      const response = current.responses[item.id] || {};
      if (response.status !== 'red' && response.status !== 'amber') return [];
      const saved = current.actions[item.id] || {};
      return [{
        itemId: item.id, sectionTitle: section.title, label: item.label,
        severity: response.status, finding: response.note || 'No finding note recorded.',
        recommendation: saved.recommendation || '', owner: saved.owner || '',
        dueDate: saved.dueDate || '', followUp: saved.followUp || 'Open',
        evidence: saved.evidence || ''
      }];
    });
  }

  function stats(audit, checklist) {
    const current = normalise(audit);
    const result = { total: 0, green: 0, amber: 0, red: 0, na: 0, ni: 0, assessed: 0, actionCount: 0 };
    for (const { item } of assessmentItems(checklist)) {
      result.total++;
      const selected = current.responses[item.id]?.status;
      result[Object.hasOwn(result, selected) && selected !== 'total' && selected !== 'assessed' && selected !== 'actionCount' ? selected : 'ni']++;
    }
    result.assessed = result.green + result.amber + result.red;
    result.actionCount = result.amber + result.red;
    return result;
  }

  function makeBackup(audit, now) {
    return JSON.stringify({ kind: BACKUP_KIND, version: 1, exportedAt: now, audit: normalise(audit) }, null, 2);
  }

  function restoreBackup(text, newId, now) {
    let parsed;
    try { parsed = JSON.parse(text); } catch { throw new Error('The backup file is not valid JSON.'); }
    if (parsed?.kind !== BACKUP_KIND || parsed.version !== 1 || !parsed.audit) {
      throw new Error('This is not a supported Pool Bros audit backup.');
    }
    const original = normalise(parsed.audit);
    return { ...original, id: newId, importedFrom: original.id, createdAt: now, updatedAt: now, status: 'draft' };
  }

  return { createAudit, normalise, actions, stats, makeBackup, restoreBackup };
});
