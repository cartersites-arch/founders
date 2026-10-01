// ─────────────────────────────────────────────────────────────────────────────
// Sharetribe template catalog — shared client/server.
//
// Each template is designed in Magic Patterns on top of the Sharetribe Web
// Template's page structure and transaction flows, so every screen maps 1:1 to
// a real Sharetribe page (SearchPage, ListingPage, CheckoutPage, InboxPage,
// EditListingPage, ProfilePage, AuthenticationPage...).
//
// To start selling: create a Stripe Payment Link per template and paste it into
// `checkoutUrl`. Until then the buy button falls back to a contact email.
// ─────────────────────────────────────────────────────────────────────────────

export type TransactionProcess =
  | "booking-hourly"
  | "booking-daily"
  | "booking-timeslot"
  | "purchase";

export type MarketplaceTemplate = {
  slug: string;
  name: string;
  tagline: string;
  niche: string;
  description: string;
  process: TransactionProcess;
  priceUsd: number;
  /** Live, clickable preview hosted by Magic Patterns. */
  previewUrl: string;
  /** Magic Patterns editor — handed to the buyer after purchase. */
  editorUrl: string;
  /** Stripe Payment Link. Empty until the product is created in Stripe. */
  checkoutUrl: string;
  accent: string;
  bestFor: string[];
  highlights: string[];
};

export const TEMPLATE_PROCESS_LABEL: Record<TransactionProcess, string> = {
  "booking-hourly": "Hourly booking",
  "booking-daily": "Daily booking",
  "booking-timeslot": "Time-slot booking",
  purchase: "Product purchase",
};

/** Pages every template ships with, mapped to their Sharetribe Web Template equivalents. */
export const TEMPLATE_PAGES: { name: string; sharetribe: string }[] = [
  { name: "Landing page", sharetribe: "LandingPage" },
  { name: "Search with map", sharetribe: "SearchPage (grid + map)" },
  { name: "Listing page + booking panel", sharetribe: "ListingPage" },
  { name: "Checkout", sharetribe: "CheckoutPage" },
  { name: "Inbox & transaction view", sharetribe: "InboxPage / TransactionPage" },
  { name: "User profile", sharetribe: "ProfilePage" },
  { name: "Create listing wizard", sharetribe: "EditListingPage" },
  { name: "Sign up / Log in", sharetribe: "AuthenticationPage" },
  { name: "Account settings", sharetribe: "ContactDetails / Password / Payouts" },
  { name: "About, Terms, Privacy", sharetribe: "CMS pages" },
];

export const TEMPLATE_CONTACT_EMAIL = "hello@founders.click";

export const MARKETPLACE_TEMPLATES: MarketplaceTemplate[] = [
  {
    slug: "poolshare",
    name: "PoolShare",
    tagline: "Rent private pools by the hour",
    niche: "Space rental",
    description:
      "A bright, aqua-toned marketplace for hourly rental of private pools and backyard spaces — the Swimply model, ready for Sharetribe.",
    process: "booking-hourly",
    priceUsd: 249,
    previewUrl: "https://project-brilliant-mango-105.magicpatterns.app",
    editorUrl: "https://www.magicpatterns.com/c/nutacczofe7ear6bsbrwe6",
    checkoutUrl: "",
    accent: "#0EA5E9",
    bestFor: ["Pool rentals", "Backyards", "Sports courts", "Hot tubs"],
    highlights: [
      "Hourly time-slot booking panel with price breakdown",
      "Amenity filters: heated, hot tub, restroom, pet friendly",
      "Host earnings CTA and popular-cities grid",
    ],
  },
  {
    slug: "gearloop",
    name: "GearLoop",
    tagline: "Peer-to-peer outdoor gear rental",
    niche: "Equipment rental",
    description:
      "A bold, outdoorsy rental marketplace for bikes, kayaks, camping and ski gear with deposits, pickup/delivery and damage protection.",
    process: "booking-daily",
    priceUsd: 249,
    previewUrl: "https://project-gifted-kiwi-467.magicpatterns.app",
    editorUrl: "https://www.magicpatterns.com/c/ooqvmanqpefa327zhthj1b",
    checkoutUrl: "",
    accent: "#16A34A",
    bestFor: ["Bikes & e-bikes", "Camping", "Cameras", "Tools"],
    highlights: [
      "Date-range calendar with security deposit line item",
      "Pickup vs delivery choice at checkout",
      "Specs table, condition badge and trust/insurance section",
    ],
  },
  {
    slug: "probook",
    name: "ProBook",
    tagline: "Book trusted local pros",
    niche: "Services marketplace",
    description:
      "A clean, professional services marketplace with session packages and weekly availability — trainers, tutors, cleaners, photographers.",
    process: "booking-timeslot",
    priceUsd: 299,
    previewUrl: "https://project-honest-swamp-720.magicpatterns.app",
    editorUrl: "https://www.magicpatterns.com/c/6wjeuyqegaa54dwgcbxjn8",
    checkoutUrl: "",
    accent: "#7C3AED",
    bestFor: ["Coaches & tutors", "Home services", "Wellness", "Photographers"],
    highlights: [
      "30/60/90-minute packages with time-slot picker",
      "Weekly availability schedule editor for providers",
      "Credentials, portfolio and review modal",
    ],
  },
  {
    slug: "thrifted",
    name: "Thrifted",
    tagline: "Buy & sell pre-loved goods",
    niche: "Product marketplace",
    description:
      "An editorial, serif-led resale marketplace for fashion, vintage furniture and collectibles with stock, shipping and order tracking.",
    process: "purchase",
    priceUsd: 299,
    previewUrl: "https://project-marvelous-jelly-786.magicpatterns.app",
    editorUrl: "https://www.magicpatterns.com/c/fsusfd6jbejjq6zjmv5alk",
    checkoutUrl: "",
    accent: "#C2410C",
    bestFor: ["Fashion resale", "Vintage", "Collectibles", "Handmade"],
    highlights: [
      "Stock-aware Buy Now flow with shipping or pickup",
      "Seller shop profiles and favorites",
      "Order tracking, 'Mark as received' and disputes",
    ],
  },
  {
    slug: "venuely",
    name: "Venuely",
    tagline: "Book unique spaces for any event",
    niche: "Venue booking",
    description:
      "A premium, dark-and-gold venue marketplace for lofts, rooftops and studios, with hourly or full-day pricing and paid add-ons.",
    process: "booking-hourly",
    priceUsd: 299,
    previewUrl: "https://project-cosmic-chard-166.magicpatterns.app",
    editorUrl: "https://www.magicpatterns.com/c/ge9p94qejrzpvecslk6btj",
    checkoutUrl: "",
    accent: "#B45309",
    bestFor: ["Event venues", "Photo studios", "Meeting rooms", "Weddings"],
    highlights: [
      "Hourly vs full-day toggle with minimum hours",
      "Paid add-ons: cleaning, AV, catering",
      "Capacity, size and event-type filters",
    ],
  },
];

export function getTemplate(slug: string): MarketplaceTemplate | undefined {
  return MARKETPLACE_TEMPLATES.find((t) => t.slug === slug);
}

export function templateBuyHref(t: MarketplaceTemplate): string {
  if (t.checkoutUrl) return t.checkoutUrl;
  const subject = encodeURIComponent(`I want the ${t.name} Sharetribe template`);
  return `mailto:${TEMPLATE_CONTACT_EMAIL}?subject=${subject}`;
}
