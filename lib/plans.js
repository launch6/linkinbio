// lib/plans.js

export const PLANS = {
  // Public tiers (shown on Pricing)
  free: {
    NAME: 'Free',
    MAX_PRODUCTS: 1,
    MAX_IMAGES: 3,
    MAX_LINKS: 5,
    EMAIL_CAPTURE: false,     // No Klaviyo on Free
    BRANDING: 'required',     // Show "Built with Launch6"
  },

  starter: {
    NAME: 'Starter',
    MAX_PRODUCTS: 3,
    MAX_IMAGES: 3,
    MAX_LINKS: 15,
    EMAIL_CAPTURE: true,      // Klaviyo enabled
    BRANDING: 'small',
    THEMES: 0,
  },

  pro: {
    NAME: 'Pro',
    MAX_PRODUCTS: 8,
    MAX_IMAGES: 5,
    MAX_LINKS: 999,           // effectively unlimited
    EMAIL_CAPTURE: true,
    BRANDING: 'optional',
    FEATURED: true,
    THEMES: 5,
  },

  business: {
    NAME: 'Business',
    MAX_PRODUCTS: 20,
    MAX_IMAGES: 10,
    MAX_LINKS: 999,
    EMAIL_CAPTURE: true,
    BRANDING: 'removable',
    ANALYTICS: true,
    CUSTOM_DOMAIN: true,
    THEMES: 8,
  },


  // Hidden tier for course/referral users (NOT on Pricing page).
  // For first 6 months they get these caps; after expiry the app auto-downgrades to 'starter'.
  // Billing continues via Starter Monthly ($9.95) because checkout uses Starter prices with a 6-month promo.
  starter_plus: {
    NAME: 'Starter+',
    MAX_PRODUCTS: 5,
    MAX_IMAGES: 3,            // keep images per product simple
    MAX_LINKS: 20,
    EMAIL_CAPTURE: true,
    BRANDING: 'small',
    THEMES: 2,
    HIDDEN: true,
  },
};

export const DEFAULT_PLAN = 'free';