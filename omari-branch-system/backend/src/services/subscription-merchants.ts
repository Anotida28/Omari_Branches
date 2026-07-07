export interface SubscriptionMerchant {
  name: string;
  patterns: string[];
}

export const SUBSCRIPTION_MERCHANTS: SubscriptionMerchant[] = [
  { name: 'Netflix',      patterns: ['%NETFLIX%'] },
  { name: 'Spotify',      patterns: ['%SPOTIFY%'] },
  { name: 'Microsoft',    patterns: ['%MICROSOFT%', '%OFFICE 365%', '%XBOX%'] },
  { name: 'Apple',        patterns: ['%APPLE.COM%', '%ITUNES%', '%APPLE ONE%'] },
  { name: 'Google',       patterns: ['%GOOGLE%'] },
  { name: 'Amazon',       patterns: ['%AMAZON%', '%AMZN%'] },
  { name: 'Disney+',      patterns: ['%DISNEY%'] },
  { name: 'DStv',         patterns: ['%DSTV%', '%MULTICHOICE%', '%GOTV%'] },
  { name: 'Showmax',      patterns: ['%SHOWMAX%'] },
  { name: 'YouTube',      patterns: ['%YOUTUBE%'] },
  { name: 'Canva',        patterns: ['%CANVA%'] },
  { name: 'Adobe',        patterns: ['%ADOBE%'] },
  { name: 'OpenAI',       patterns: ['%OPENAI%', '%CHATGPT%'] },
  { name: 'GitHub',       patterns: ['%GITHUB%'] },
  { name: 'Dropbox',      patterns: ['%DROPBOX%'] },
  { name: 'Notion',       patterns: ['%NOTION%'] },
  { name: 'Zoom',         patterns: ['%ZOOM.US%', '%ZOOM.COM%'] },
  { name: 'Slack',        patterns: ['%SLACK%'] },
  { name: 'LinkedIn',     patterns: ['%LINKEDIN%'] },
  { name: 'Grammarly',    patterns: ['%GRAMMARLY%'] },
  { name: 'Duolingo',     patterns: ['%DUOLINGO%'] },
  { name: 'Paramount+',   patterns: ['%PARAMOUNT%'] },
  { name: 'HBO Max',      patterns: ['%HBO%'] },
  { name: 'PlayStation',  patterns: ['%PLAYSTATION%', '%PSN%'] },
  { name: 'Audible',      patterns: ['%AUDIBLE%'] },
  { name: 'Coursera',     patterns: ['%COURSERA%'] },
  { name: 'Udemy',        patterns: ['%UDEMY%'] },
  { name: 'Steam',        patterns: ['%STEAMPOWERED%', '%STEAM GAMES%'] },
  { name: 'NordVPN',      patterns: ['%NORDVPN%'] },
  { name: 'ExpressVPN',   patterns: ['%EXPRESSVPN%'] },
  { name: 'Figma',        patterns: ['%FIGMA%'] },
  { name: 'Shopify',      patterns: ['%SHOPIFY%'] },
  { name: 'Mailchimp',    patterns: ['%MAILCHIMP%'] },
];

// Generates SQL CASE WHEN expression mapping merchant name to service name.
// colExpr: e.g. 't.card_acceptor_name_loc'
export function buildServiceCaseSql(colExpr: string): string {
  const whens = SUBSCRIPTION_MERCHANTS.map(m => {
    const cond = m.patterns
      .map(p => `${colExpr} LIKE '${p}'`)
      .join(' OR ');
    const guard = m.patterns.length > 1 ? `(${cond})` : cond;
    return `WHEN ${guard} THEN '${m.name}'`;
  });
  return `CASE\n          ${whens.join('\n          ')}\n          ELSE NULL\n        END`;
}

// Generates the WHERE filter that limits rows to subscription merchants only.
export function buildMerchantFilterSql(colExpr: string): string {
  const clauses = SUBSCRIPTION_MERCHANTS.flatMap(m =>
    m.patterns.map(p => `${colExpr} LIKE '${p}'`),
  );
  return `(\n      ${clauses.join('\n      OR ')}\n    )`;
}

// Omari Visa fee tiers
export function calculateOmariVisaFee(amount: number): number {
  let fee: number;
  if (amount < 5.00) {
    fee = amount * 0.155 + 1.50;
  } else if (amount <= 90.00) {
    fee = amount * 0.175 + 1.50;
  } else {
    fee = amount * 0.192;
  }
  return Math.round(fee * 10000) / 10000;
}

export function calculateTotalNeeded(subscriptionAmount: number): number {
  return Math.round((subscriptionAmount + calculateOmariVisaFee(subscriptionAmount)) * 10000) / 10000;
}
