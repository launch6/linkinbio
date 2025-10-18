export const PLANS = {
  // Public tiers
  free:         { NAME: 'Free',        MAX_PRODUCTS: 1,  MAX_IMAGES: 3,  MAX_LINKS: 5,   EMAIL_CAPTURE: false, BRANDING: 'required' },
  starter:      { NAME: 'Starter',     MAX_PRODUCTS: 3,  MAX_IMAGES: 3,  MAX_LINKS: 15,  EMAIL_CAPTURE: true,  BRANDING: 'small' },
  pro:          { NAME: 'Pro',         MAX_PRODUCTS: 8,  MAX_IMAGES: 5,  MAX_LINKS: 999, EMAIL_CAPTURE: true,  BRANDING: 'optional', FEATURED: true, THEMES: 5 },
  business:     { NAME: 'Business',    MAX_PRODUCTS: 20, MAX_IMAGES: 10, MAX_LINKS: 999, EMAIL_CAPTURE: true,  BRANDING: 'removable', ANALYTICS: true, CUSTOM_DOMAIN: true },

  // Hidden tier for course/referral: expires to 'starter' but bills $9/mo from day 1 (after 6 months free via promo)
  starter_plus: { NAME: 'Starter+',    MAX_PRODUCTS: 6,  MAX_IMAGES: 4,  MAX_LINKS: 30,  EMAIL_CAPTURE: true,  BRANDING: 'small', HIDDEN: true }
};

export const DEFAULT_PLAN = 'free';
