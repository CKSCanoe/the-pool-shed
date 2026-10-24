(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PoolAssetReport = api;
})(typeof window !== 'undefined' ? window : null, function () {
  function formatDate(value) {
    if (!value) return 'Not recorded';
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value);
  }

  function formatAssetDate(asset, field) {
    const state = asset.dateStates?.[field];
    if (state === 'unknown') return 'Date unavailable';
    if (state === 'not-applicable') return 'Not applicable';
    return formatDate(asset[field]);
  }

  function withDateState(asset, field, state) {
    return {
      ...asset,
      [field]: state === 'date' ? asset[field] || '' : '',
      dateStates: { ...(asset.dateStates || {}), [field]: state }
    };
  }

  function photosForAsset(asset) {
    const photos = [];
    if (asset.image) photos.push({ image: asset.image, caption: asset.imageCaption || '' });
    if (Array.isArray(asset.photos)) photos.push(...asset.photos);
    return photos.filter(photo => photo && typeof photo.image === 'string' && photo.image);
  }

  function linkedFinding(itemId, checklist) {
    if (!itemId) return 'Not linked';
    for (const section of checklist.sections || []) {
      const item = (section.items || []).find(candidate => candidate.id === itemId);
      if (item) return `${section.title} / ${item.label}`;
    }
    return 'Finding no longer available';
  }

  function reportRows(assets, checklist) {
    return (assets || []).map(asset => ({
      id: asset.id,
      name: asset.name || 'Unnamed asset',
      type: asset.type || 'Not recorded',
      identity: [asset.brand, asset.model, asset.serialNumber && `Serial ${asset.serialNumber}`].filter(Boolean).join(' / ') || 'Not recorded',
      location: asset.location || 'Not recorded',
      linkedFinding: linkedFinding(asset.linkedItemId, checklist),
      installed: formatAssetDate(asset, 'installDate'),
      inspected: formatAssetDate(asset, 'lastInspected'),
      inspectionDue: formatAssetDate(asset, 'nextInspectionDue'),
      serviced: formatAssetDate(asset, 'lastService'),
      serviceDue: formatAssetDate(asset, 'nextServiceDue'),
      mediaType: asset.mediaType || 'Not recorded',
      mediaChanged: formatAssetDate(asset, 'lastMediaChange'),
      mediaDue: formatAssetDate(asset, 'nextMediaChangeDue'),
      condition: asset.condition || 'Not assessed',
      note: asset.note || 'No asset observation recorded.',
      photoCount: photosForAsset(asset).length
    }));
  }

  function forFinding(assets, itemId) {
    return (assets || []).filter(asset => asset.linkedItemId === itemId);
  }

  return { formatDate, formatAssetDate, withDateState, photosForAsset, reportRows, forFinding };
});
