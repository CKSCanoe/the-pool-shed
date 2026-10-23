(function (root) {
  'use strict';

  // Source labels are printed in the report. Each URL goes to the issuing body.
  const sources = {
    'HSE-HSG179': { title: 'HSE, Health and safety in swimming pools (HSG179, 2018; updated February 2024)', type: 'HSE guidance', url: 'https://www.hse.gov.uk/pubns/books/hsg179.htm' },
    'HSE-POOL': { title: 'HSE, Swimming pool safety management', type: 'HSE guidance', url: 'https://www.hse.gov.uk/entertainment/leisure/swimming-pool.htm' },
    'PWTAG-COP': { title: 'PWTAG, Code of Practice: The management and treatment of swimming pool water (July 2025 update)', type: 'Industry code of practice', url: 'https://www.pwtag.org/code-of-practice/' },
    'PWTAG-TN68': { title: 'PWTAG, Technical Note 68: Handling, delivery, storage and application of swimming pool chemicals (June 2023)', type: 'Industry technical note', url: 'https://www.pwtag.org/the-handling-delivery-storage-and-application-of-swimming-pool-chemicals-technical-note-68/' },
    COSHH: { title: 'HSE, How to carry out a COSHH risk assessment', type: 'Health and safety guidance', url: 'https://www.hse.gov.uk/coshh/basics/assessment.htm' },
    FIRE: { title: 'Home Office, Fire safety in the workplace: Fire risk assessments (England)', type: 'Government fire safety guidance', url: 'https://www.gov.uk/workplace-fire-safety-your-responsibilities/fire-risk-assessments' },
    'BS-EN-15288-2': { title: 'BSI, BS EN 15288-2:2018: Swimming pools for public use - Safety requirements for operation', type: 'British Standard (scope reference; full text requires access)', url: 'https://knowledge.bsigroup.com/products/swimming-pools-for-public-use-safety-requirements-for-operation' }
  };

  const sections = {
    'mgmt-docs': { text: 'Check the site risk assessment, operating procedures and staff competence against the actual pool operation.', sources: ['HSE-HSG179', 'BS-EN-15288-2'] },
    'facility-access': { text: 'Review access, supervision, rescue and welfare controls against the site-specific assessment of users and activities.', sources: ['HSE-HSG179', 'BS-EN-15288-2'] },
    'fire-safety': { text: 'Compare observations with the responsible person’s current fire risk assessment and emergency plan.', sources: ['FIRE'] },
    'water-chemistry': { text: 'Interpret results against the pool’s disinfectant, treatment design, operating procedures and PWTAG Code.', sources: ['PWTAG-COP'] },
    'chem-handling': { text: 'Review chemical handling controls and product safety information against the site COSHH assessment.', sources: ['COSHH', 'PWTAG-TN68'] },
    'plant-mechanical': { text: 'Review circulation, filtration and plant maintenance against the design, manufacturer instructions and PWTAG Code.', sources: ['PWTAG-COP'] },
    'structural-elec': { text: 'Record visible condition and refer specialist structural or electrical matters for competent inspection.', sources: ['HSE-HSG179', 'BS-EN-15288-2'] },
    'maintenance-records': { text: 'Compare the maintenance and verification records with the site plan and manufacturer instructions.', sources: ['HSE-HSG179', 'PWTAG-COP'] }
  };

  const items = {
    'nop-present': { text: 'The NOP should describe normal daily operation for this pool; check that it reflects current layout, use and staffing.', sources: ['HSE-HSG179'] },
    'eap-present': { text: 'The EAP should give staff actions for reasonably foreseeable emergencies at this site.', sources: ['HSE-HSG179'] },
    'psop-present': { text: 'HSE describes PSOPs as commonly used management arrangements made up of the NOP and EAP. Check the site risk assessment and current documents.', sources: ['HSE-HSG179'] },
    'safeguarding': { text: 'Where children or vulnerable users attend, confirm the operator’s safeguarding arrangements with the responsible management team.', sources: ['HSE-HSG179'] },
    'emergency-comms': { text: 'Test the emergency communication method under the conditions in which staff would need to use it.', sources: ['HSE-HSG179'] },
    'fire-exits': { text: 'The responsible person should confirm exit suitability and arrangements through the premises fire risk assessment.', sources: ['FIRE'] },
    'fire-alarms': { text: 'Confirm warning arrangements and testing records against the fire risk assessment and maintenance plan.', sources: ['FIRE'] },
    'testing-logs': { text: 'PWTAG advises that chemical testing frequency should be determined by the pool risk assessment, with recommended intervals that depend on the control system. Check the site procedure and records.', sources: ['PWTAG-COP'] },
    'ph-level': { text: 'Interpret pH with the disinfectant in use and the current PWTAG Code; do not apply a universal pass range.', sources: ['PWTAG-COP'] },
    'free-chlorine': { text: 'Interpret free chlorine alongside pH, treatment design and microbiological evidence; PWTAG values depend on these conditions.', sources: ['PWTAG-COP'] },
    'combined-chlorine': { text: 'PWTAG advises keeping combined chlorine as low as possible and below half of free chlorine, with an upper limit of 1 mg/l.', sources: ['PWTAG-COP'] },
    'testing-method': { text: 'Check the testing equipment, method, calibration and independent verification appropriate to this pool.', sources: ['PWTAG-COP'] },
    'dosing-automation': { text: 'Check controller verification and manual pool-water tests. Automatic control does not remove the need for independent checks.', sources: ['PWTAG-COP'] },
    'coshh-sds': { text: 'Use current product safety data and the site COSHH assessment to determine controls and staff information.', sources: ['COSHH', 'PWTAG-TN68'] },
    'ppe-available': { text: 'Select and maintain PPE from the assessed chemical tasks and supplier instructions; a specific respirator is not assumed for every plant room.', sources: ['COSHH', 'HSE-HSG179'] },
    bunding: { text: 'Check containment design, chemical compatibility and spill arrangements against the COSHH assessment and PWTAG chemical guidance.', sources: ['COSHH', 'PWTAG-TN68'] },
    segregation: { text: 'Keep incompatible pool chemicals separate and check storage and transfer lines for routes to accidental mixing.', sources: ['COSHH', 'PWTAG-TN68'] },
    'storage-sealed': { text: 'Check container integrity, labels and delivery arrangements against the chemical risk assessment and manufacturer instructions.', sources: ['COSHH', 'PWTAG-TN68'] },
    respirators: { text: 'Where respiratory protection is identified by the COSHH assessment, check that the selected equipment and training are suitable.', sources: ['COSHH', 'HSE-HSG179'] },
    'circulation-flow': { text: 'Verify design flow and turnover using measured data, plant drawings and the current PWTAG Code.', sources: ['PWTAG-COP'] },
    'filtration-backwash': { text: 'Review backwash trigger, duration, flow and records against the filter design, manufacturer instructions and PWTAG Code.', sources: ['PWTAG-COP'] },
    'suction-entrapment': { text: 'HSE identifies suction at sump outlets as a hazard; grille security and the site-specific protective design require competent review.', sources: ['HSE-POOL', 'PWTAG-COP'] },
    'ahu-filters': { text: 'Assess filter condition and change history against the AHU manufacturer’s maintenance schedule and air quality observations.', sources: ['HSE-HSG179', 'PWTAG-COP'] },
    'pressure-gauges': { text: 'Faulty gauges can undermine filter differential-pressure and backwash decisions; verify against the maintenance plan.', sources: ['PWTAG-COP'] },
    calibration: { text: 'Record calibration or verification evidence for instruments used to make water-treatment decisions.', sources: ['PWTAG-COP'] }
  };

  function forItem(sectionId, itemId) {
    const record = items[itemId] || sections[sectionId];
    return record ? { text: record.text, sources: [...record.sources] } : { text: 'Apply the site risk assessment and competent technical judgement.', sources: ['HSE-HSG179'] };
  }

  function status(value) {
    const states = {
      green: { label: 'Acceptable at visit', colour: [33, 133, 97] },
      amber: { label: 'Review planned', colour: [181, 116, 17] },
      red: { label: 'Priority review', colour: [196, 39, 48] },
      na: { label: 'Not applicable', colour: [129, 140, 154] },
      ni: { label: 'Not inspected', colour: [129, 140, 154] }
    };
    return states[value] || states.ni;
  }

  function referenceIndex(pairs) {
    const ids = [];
    pairs.forEach(([sectionId, itemId]) => forItem(sectionId, itemId).sources.forEach(id => {
      if (!ids.includes(id)) ids.push(id);
    }));
    return ids.map(id => ({ id, ...sources[id] }));
  }

  const api = { sources, forItem, status, referenceIndex };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PoolReportGuidance = api;
})(typeof window !== 'undefined' ? window : globalThis);
