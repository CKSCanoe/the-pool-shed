// Pool Shed v1.57 — customer emails from fulfilment (picked, packed, shipped, collected).
// The wording comes from Settings (customer notification rules); the recipient is always the order's customer email,
// looked up by the database (ps_customer_email_context), never an address typed in the screen.

const LINKS = [
  [/royal\s*mail/i, r => 'https://www.royalmail.com/track-your-item#/tracking-results/' + r],
  [/parcel\s*force/i, r => 'https://www.parcelforce.com/track-trace?trackNumber=' + r],
  [/dpd/i, r => 'https://track.dpd.co.uk/parcels/' + r],
  [/\bups\b/i, r => 'https://www.ups.com/track?tracknum=' + r],
  [/dhl/i, r => 'https://www.dhl.com/gb-en/home/tracking/tracking-express.html?tracking-id=' + r],
  [/fedex/i, r => 'https://www.fedex.com/fedextrack/?trknbr=' + r],
  [/evri|hermes/i, r => 'https://www.evri.com/track/parcel/' + r],
  [/yodel/i, r => 'https://www.yodel.co.uk/tracking/' + r],
  [/\bdx\b/i, r => 'https://www.dxdelivery.com/consumer/my-tracking/' + r]
];
export function trackingLink(courier, ref) {
  const r = String(ref || '').trim();
  if (!r || /pending|^n\/?a$/i.test(r)) return '';
  const hit = LINKS.find(([re]) => re.test(String(courier || '')));
  return hit ? hit[1](encodeURIComponent(r)) : '';
}

const fill = (t, v) => String(t || '').replace(/\{(customer|order|goodsNote|courier|tracking|trackingLink)\}/g, (_, k) => v[k] || '');

const DEFAULTS = {
  Pick: ['Your Pool Bros order {order} is being prepared', 'Hi {customer},\n\nWe are preparing your order {order} in our warehouse now.\n\nThanks,\nPool Bros'],
  Pack: ['Your Pool Bros order {order} is packed', 'Hi {customer},\n\nYour order {order} is packed and ready to go.\n\nThanks,\nPool Bros'],
  Ship: ['Your Pool Bros order {order} is on its way', 'Hi {customer},\n\nYour order {order} has shipped with {courier}. Tracking: {tracking}.\n\nThanks,\nPool Bros'],
  'Part Ship': ['Part of your Pool Bros order {order} is on its way', 'Hi {customer},\n\nPart of your order {order} has shipped with {courier}. Tracking: {tracking}. We will let you know when the rest follows.\n\nThanks,\nPool Bros'],
  Collection: ['Your Pool Bros order {order} has been collected', 'Hi {customer},\n\nYour order {order} has been collected. Thank you.\n\nThanks,\nPool Bros']
};

// ctx: from ps_customer_email_context; info: { courier, tracking, goodsNote } from the screen (wording only).
export function customerEmail(ctx, info = {}) {
  const trig = ctx.trigger;
  const rule = ctx.rule || {};
  const useRule = trig !== 'Part Ship' && trig !== 'Collection' && rule.subject && rule.body;
  const [subj, body] = useRule ? [rule.subject, rule.body] : DEFAULTS[trig] || DEFAULTS.Ship;
  const link = trackingLink(info.courier, info.tracking);
  const v = { customer: (ctx.customer && ctx.customer.name) || 'there', order: ctx.order_id, goodsNote: info.goodsNote || '',
              courier: info.courier || 'our courier', tracking: info.tracking || 'to follow', trackingLink: link };
  let text = fill(body, v);
  if ((trig === 'Ship' || trig === 'Part Ship') && link && !text.includes(link)) text = text.replace(/\n\n(Thanks|Kind regards|Regards)/i, '\n\nTrack your parcel: ' + link + '\n\n$1');
  if ((trig === 'Ship' || trig === 'Part Ship') && link && !text.includes(link)) text += '\n\nTrack your parcel: ' + link;
  const co = ctx.company || {};
  if (co.phone || co.email) text += '\n\n' + [co.name, co.phone, co.email].filter(Boolean).join(' · ');
  return { subject: fill(subj, v).slice(0, 200), text, link };
}
