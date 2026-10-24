(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PoolReportEvidence = api;
})(typeof window !== 'undefined' ? window : null, function () {
  function collect(checklist, survey) {
    const responses = survey?.responses || {};
    const result = [];
    for (const section of checklist.sections || []) {
      for (const item of section.items || []) {
        const response = responses[item.id] || {};
        const photos = [];
        if (typeof response.image === 'string' && response.image) {
          photos.push({ image: response.image, caption: response.imageCaption || '' });
        }
        if (Array.isArray(response.photos)) photos.push(...response.photos);
        for (const photo of photos) {
          if (!photo || typeof photo.image !== 'string' || !photo.image) continue;
          result.push({
            figure: result.length + 1,
            sectionId: section.id,
            sectionTitle: section.title,
            itemId: item.id,
            itemLabel: item.label,
            image: photo.image,
            caption: typeof photo.caption === 'string' ? photo.caption.trim() : '',
            status: response.status || 'ni'
          });
        }
      }
    }
    return result;
  }

  function figuresForItem(photos, itemId) {
    return photos.filter(photo => photo.itemId === itemId).map(photo => photo.figure);
  }

  return { collect, figuresForItem };
});
