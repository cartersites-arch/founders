// ─────────────────────────────────────────────────────────────────────────────
// Sharetribe template store — display catalog (client + server).
//
// Prices are mirrored from supabase/functions/_shared/template-catalog.ts, the
// authority template-checkout charges from. tests/template-store.test.ts fails
// if slug, name or price drift between the two.
//
// Each template's live preview is a static build served from
// public/template-previews/<slug>/ (hash-routed, so every page works as a plain
// static file). The paid download is the full source project.
// ─────────────────────────────────────────────────────────────────────────────

export type TemplateFlow =
  | "booking-hourly"
  | "booking-daily"
  | "booking-timeslot"
  | "purchase"
  | "inquiry"
  | "negotiation";

export type StoreTemplate = {
  slug: string;
  name: string;
  tagline: string;
  niche: string;
  description: string;
  flow: TemplateFlow;
  priceCents: number;
  accent: string;
  bestFor: string[];
  highlights: string[];
  /** Standard pages (TEMPLATE_PAGES) this design does not have; see templatePages(). */
  lacks?: ("search-map" | "checkout")[];
};

export const TEMPLATE_FLOW_LABEL: Record<TemplateFlow, string> = {
  "booking-hourly": "Hourly booking",
  "booking-daily": "Daily booking",
  "booking-timeslot": "Time-slot booking",
  purchase: "Product purchase",
  inquiry: "Inquiry",
  negotiation: "Quotes & offers",
};

/** Pages every template ships with, mapped to their Sharetribe Web Template equivalents. */
export const TEMPLATE_PAGES: { name: string; sharetribe: string }[] = [
  { name: "Landing page", sharetribe: "LandingPage" },
  { name: "Search with map", sharetribe: "SearchPage" },
  { name: "Listing page + booking panel", sharetribe: "ListingPage" },
  { name: "Checkout", sharetribe: "CheckoutPage" },
  { name: "Inbox & transaction view", sharetribe: "InboxPage / TransactionPage" },
  { name: "User profile", sharetribe: "ProfilePage" },
  { name: "Create listing wizard", sharetribe: "EditListingPage" },
  { name: "Sign up / Log in", sharetribe: "AuthenticationPage" },
  { name: "Account settings", sharetribe: "ContactDetails / Password / Payouts" },
  { name: "About, Terms, Privacy", sharetribe: "CMS pages" },
];

export const STORE_TEMPLATES: StoreTemplate[] = [
  {
    slug: "poolshare",
    name: "PoolShare",
    tagline: "Rent private pools by the hour",
    niche: "Space rental",
    description:
      "A bright, aqua-toned marketplace for hourly rental of private pools and backyard spaces — the Swimply model, ready for Sharetribe.",
    flow: "booking-hourly",
    priceCents: 24900,
    accent: "#0EA5E9",
    bestFor: ["Pool rentals", "Backyards", "Sports courts", "Hot tubs"],
    highlights: [
      "Hourly time-slot booking panel with price breakdown",
      "Amenity filters: heated, hot tub, restroom, pet friendly",
      "Host earnings call-to-action and popular-cities grid",
    ],
  },
  {
    slug: "gearloop",
    name: "GearLoop",
    tagline: "Peer-to-peer outdoor gear rental",
    niche: "Equipment rental",
    description:
      "A bold, outdoorsy rental marketplace for bikes, kayaks, camping and ski gear with deposits, pickup or delivery, and damage protection.",
    flow: "booking-daily",
    priceCents: 24900,
    accent: "#16A34A",
    bestFor: ["Bikes & e-bikes", "Camping", "Cameras", "Tools"],
    highlights: [
      "Date-range calendar with a security-deposit line item",
      "Pickup or delivery choice at checkout",
      "Specs table, condition badge and a trust & insurance section",
    ],
  },
  {
    slug: "probook",
    name: "ProBook",
    tagline: "Book trusted local pros",
    niche: "Services marketplace",
    description:
      "A clean, professional services marketplace with session packages and weekly availability — trainers, tutors, cleaners, photographers.",
    flow: "booking-timeslot",
    priceCents: 29900,
    accent: "#7C3AED",
    bestFor: ["Coaches & tutors", "Home services", "Wellness", "Photographers"],
    highlights: [
      "30/60/90-minute packages with a time-slot picker",
      "Weekly availability editor for providers",
      "Credentials, portfolio gallery and a review modal",
    ],
  },
  {
    slug: "thrifted",
    name: "Thrifted",
    tagline: "Buy and sell pre-loved goods",
    niche: "Product marketplace",
    description:
      "An editorial resale marketplace for fashion, vintage furniture and collectibles, with stock, shipping and order tracking.",
    flow: "purchase",
    priceCents: 29900,
    accent: "#C2410C",
    bestFor: ["Fashion resale", "Vintage", "Collectibles", "Handmade"],
    highlights: [
      "Stock-aware Buy Now flow with shipping or local pickup",
      "Seller shop profiles, favorites and a cart drawer",
      "Order tracking, 'Mark as received' and disputes",
    ],
  },
  {
    slug: "venuely",
    name: "Venuely",
    tagline: "Book unique spaces for any event",
    niche: "Venue booking",
    description:
      "A premium dark-and-gold venue marketplace for lofts, rooftops and studios, with hourly or full-day pricing and paid add-ons.",
    flow: "booking-hourly",
    priceCents: 29900,
    accent: "#B45309",
    bestFor: ["Event venues", "Photo studios", "Meeting rooms", "Weddings"],
    highlights: [
      "Hourly or full-day pricing with minimum hours",
      "Paid add-ons: cleaning, AV, catering",
      "Capacity, size and event-type filters",
    ],
  },
  {
    slug: "driveshare",
    name: "DriveShare",
    tagline: "Peer-to-peer car rental",
    niche: "Car rental",
    description:
      "A confident, electric-blue car-sharing marketplace in the Turo model: trips by the day, airport delivery, protection plans and check-in photos.",
    flow: "booking-daily",
    priceCents: 29900,
    accent: "#2563EB",
    bestFor: ["Car sharing", "EV rentals", "Vans & trucks", "Airport delivery"],
    highlights: [
      "Trip start/end with pickup or delivery and a protection-plan picker",
      "Driver's license verification step at checkout",
      "Check-in and check-out photos with odometer in the trip view",
    ],
  },
  {
    slug: "staybnb",
    name: "Staybnb",
    tagline: "Vacation rentals by the night",
    niche: "Vacation rentals",
    description:
      "A warm, rounded short-term rental marketplace in the Airbnb model: category bar, photo mosaic, nightly pricing with cleaning fees, and Superhost profiles.",
    flow: "booking-daily",
    priceCents: 29900,
    accent: "#E11D48",
    bestFor: ["Vacation homes", "Cabins", "City apartments", "Unique stays"],
    highlights: [
      "Where/when/who search pill and a category icon bar",
      "Five-photo mosaic, category ratings and a nightly price breakdown",
      "Eight-step host listing wizard with calendar and house rules",
    ],
  },
  {
    slug: "loanable",
    name: "Loanable",
    tagline: "Rent premium digital assets",
    niche: "Digital rentals",
    description:
      "A dark, gradient-lit marketplace for renting creative assets — presets, templates, sample packs, 3D models, fonts and courses — by the week or for life.",
    flow: "purchase",
    priceCents: 24900,
    accent: "#7C3AED",
    bestFor: ["Presets & LUTs", "Templates", "Sample packs", "Fonts & 3D"],
    highlights: [
      "7/30/90-day or lifetime license selector with seats",
      "Library with license keys, expiry countdowns and downloads",
      "Previews by asset type: audio, before/after, type tester, 3D",
    ],
  },
  {
    slug: "trackroom",
    name: "Trackroom",
    tagline: "Book recording studios by the hour",
    niche: "Studio booking",
    description:
      "A moody, magenta-lit marketplace for recording, rehearsal and podcast studios, booked by the hour with an optional engineer and paid add-ons.",
    flow: "booking-hourly",
    priceCents: 24900,
    accent: "#DB2777",
    bestFor: ["Recording studios", "Rehearsal rooms", "Podcast studios", "Engineers"],
    highlights: [
      "Hourly booking with engineer toggle and mixing/mastering add-ons",
      "Grouped gear lists, engineer credits and a waveform player",
      "File delivery for stems in the session view",
    ],
  },
  {
    slug: "flowspace",
    name: "Flowspace",
    tagline: "Book yoga classes and teachers",
    niche: "Yoga & wellness",
    description:
      "A calm, sage-green yoga marketplace where independent teachers list drop-in, private, online and retreat classes, with class packs and waitlists.",
    flow: "booking-timeslot",
    priceCents: 24900,
    accent: "#4D7C5A",
    bestFor: ["Yoga teachers", "Studios", "Online classes", "Retreats"],
    highlights: [
      "Session picker with spots left and 5- or 10-class packs",
      "Recurring schedule builder for teachers",
      "Health-waiver step at checkout and pack credits in the inbox",
    ],
  },
  {
    slug: "bulkly",
    name: "Bulkly",
    tagline: "Wholesale from independent brands",
    niche: "B2B wholesale",
    description:
      "A crisp navy-and-lime B2B marketplace where independent brands sell to retailers and cafés by the case, with tiered pricing, brand order minimums and margin-focused product search.",
    flow: "purchase",
    priceCents: 24900,
    accent: "#143A78",
    bestFor: ["Wholesale B2B", "Food & beverage", "Home & gift", "Indie beauty"],
    highlights: [
      "Tiered case pricing table with retail margin vs MSRP",
      "Multi-brand cart with per-brand minimums and free-shipping goals",
      "Retailer or brand sign-up with EIN and resale-certificate upload",
    ],
    lacks: ["search-map"],
  },
  {
    slug: "campout",
    name: "CampOut",
    tagline: "Book private campsites by the night",
    niche: "Campsite booking",
    description:
      "An earthy forest-green and burnt-orange marketplace for booking private campsites, RV spots, cabins and glamping on farms and ranches by the night, with instant book or request-to-book.",
    flow: "booking-daily",
    priceCents: 24900,
    accent: "#224A31",
    bestFor: ["Private campsites", "RV parking", "Glamping", "Cabin stays"],
    highlights: [
      "Check-in/check-out booking with camper and vehicle counters",
      "Price breakdown with extra-camper, cleaning and service fees",
      "Gate codes and directions unlock in the inbox once booked",
    ],
  },
  {
    slug: "courttime",
    name: "CourtTime",
    tagline: "Book sports courts by the hour",
    niche: "Sports court booking",
    description:
      "A sporty green and volt-yellow marketplace with bold condensed headlines for booking tennis, pickleball, padel and basketball courts by the hour or grabbing seats in open-play sessions.",
    flow: "booking-hourly",
    priceCents: 24900,
    accent: "#0E7C3A",
    bestFor: ["Sports courts", "Pickleball & padel", "Turf fields", "Drop-in sessions"],
    highlights: [
      "7-day availability grid with tap-to-select hourly slots",
      "Private court hire or per-seat open-play sessions",
      "Equipment and coach add-ons priced per booking or per hour",
    ],
  },
  {
    slug: "craftly",
    name: "Craftly",
    tagline: "Buy and sell handmade goods",
    niche: "Handmade goods",
    description:
      "A warm, editorial marketplace in cream and terracotta with elegant serif type, where independent makers sell handmade ceramics, jewelry, candles, textiles, woodwork and prints with shipping or local pickup.",
    flow: "purchase",
    priceCents: 24900,
    accent: "#B5532F",
    bestFor: ["Handmade goods", "Ceramics", "Jewelry", "Art prints"],
    highlights: [
      "Variation picker with in-stock and made-to-order labels",
      "Ship-from-studio or local pickup on product page and checkout",
      "Gift orders with a personal note and hidden-price packing slip",
    ],
    lacks: ["search-map"],
  },
  {
    slug: "deskhop",
    name: "DeskHop",
    tagline: "Book desks and meeting rooms by the hour",
    niche: "Workspace rental",
    description:
      "A clean, modern emerald-green marketplace for booking hot desks, private offices and meeting rooms in coworking spaces by the hour or day, with door-code access and VAT invoices.",
    flow: "booking-hourly",
    priceCents: 24900,
    accent: "#047857",
    bestFor: ["Coworking spaces", "Meeting rooms", "Hot desks", "Private offices"],
    highlights: [
      "Hourly or full-day booking with a seats-left meter per slot",
      "Company VAT invoice toggle at checkout",
      "Door code and Wi-Fi password unlock in the inbox once confirmed",
    ],
  },
  {
    slug: "dressly",
    name: "Dressly",
    tagline: "Rent designer dresses from local closets",
    niche: "Fashion rental",
    description:
      "A refined black, cream and dusty-rose fashion marketplace with high-contrast serif type for renting designer dresses from local closets for 4 or 8 days, with damage protection and shipping or pickup.",
    flow: "booking-daily",
    priceCents: 24900,
    accent: "#111111",
    bestFor: ["Dress rental", "Formalwear", "Designer fashion", "Wedding guest looks"],
    highlights: [
      "4- or 8-day rentals booked from an event-date calendar",
      "Size check comparing your usual size with the dress's fit",
      "Prepaid return label in the renter's inbox",
    ],
    lacks: ["search-map"],
  },
  {
    slug: "gigsy",
    name: "Gigsy",
    tagline: "Get quotes from top freelancers",
    niche: "Freelance services",
    description:
      "A bright, modern indigo-and-mint freelance marketplace where clients request quotes on services, trade offers and counter-offers, then pay, request revisions and approve delivered work.",
    flow: "negotiation",
    priceCents: 24900,
    accent: "#5B35F5",
    bestFor: ["Freelance services", "Design & dev", "Content writing", "Marketing agencies"],
    highlights: [
      "Quote request form with budget range, deadline and attachments",
      "Offers and counter-offers you can accept, counter or decline",
      "Work delivery, revision requests and approve-to-release payment",
    ],
    lacks: ["search-map"],
  },
  {
    slug: "harborly",
    name: "Harborly",
    tagline: "Rent boats with or without a captain",
    niche: "Boat rental",
    description:
      "A nautical navy-and-coral marketplace with elegant serif headings for renting boats and yachts by the half or full day, skippered by the renter or a licensed captain.",
    flow: "booking-timeslot",
    priceCents: 24900,
    accent: "#0B2545",
    bestFor: ["Boat rentals", "Yacht charters", "Fishing charters", "Jet ski rentals"],
    highlights: [
      "Half-day or full-day packages with fixed departure windows",
      "Captain add-on or bareboat mode, with the captain fee itemized",
      "Pre-departure checklist with a progress bar in each trip thread",
    ],
  },
  {
    slug: "harvestly",
    name: "Harvestly",
    tagline: "Buy fresh produce from local farms",
    niche: "Local food",
    description:
      "A warm, kraft-paper and leafy-green marketplace for local farm produce, where shoppers fill one basket from several farms and choose farm pickup or local delivery for each.",
    flow: "purchase",
    priceCents: 24900,
    accent: "#2F6B3A",
    bestFor: ["Farmers markets", "Local produce", "Artisan food", "Flower farms"],
    highlights: [
      "One basket across farms, with pickup slot or delivery zone per farm",
      "Stock meter with low-stock and sold-out states on product pages",
      "Farm profiles with story, growing-practice badges and pickup days",
    ],
  },
  {
    slug: "kitchenhub",
    name: "KitchenHub",
    tagline: "Rent licensed commercial kitchens by the hour",
    niche: "Kitchen rental",
    description:
      "A bold, industrial design in stainless-steel grays and tomato red for booking licensed commercial kitchens by the hour, with storage add-ons, compliance documents and cleaning sign-off.",
    flow: "booking-hourly",
    priceCents: 24900,
    accent: "#D23A22",
    bestFor: ["Commercial kitchens", "Food truck commissaries", "Bakery space", "Pop-up kitchens"],
    highlights: [
      "Hourly booking with start time, minimum hours and storage add-ons",
      "Insurance certificate upload and food-handler cert at checkout",
      "Cleaning checklist that must be completed to sign off a session",
    ],
  },
  {
    slug: "parkspot",
    name: "ParkSpot",
    tagline: "Rent private parking by the hour or day",
    niche: "Parking rental",
    description:
      "A high-contrast navy-and-yellow marketplace for renting private driveways, garages and lot spaces by the hour or day, with instant booking, vehicle-fit checks and access codes in the inbox.",
    flow: "booking-hourly",
    priceCents: 24900,
    accent: "#0F2547",
    bestFor: ["Driveway parking", "Garage rentals", "Event parking", "Airport parking"],
    highlights: [
      "Hourly or daily rates with a 'switch to daily and save' prompt",
      "Vehicle-size filter plus a fit warning at checkout",
      "Access code revealed in the inbox once a booking is confirmed",
    ],
  },
  {
    slug: "petpal-care",
    name: "PetPal Care",
    tagline: "Book pet care while you're away",
    niche: "Pet care",
    description:
      "A warm cream-and-orange pet-care marketplace with rounded type where owners book vetted sitters for boarding, house sitting, drop-ins or walks, chat in the inbox and receive photo updates.",
    flow: "booking-daily",
    priceCents: 24900,
    accent: "#F28F0E",
    bestFor: ["Pet boarding", "Dog walking", "House sitting", "Drop-in visits"],
    highlights: [
      "Pop-out availability calendar inside the booking panel",
      "Quick filter chips: accepts cats, fenced yard, home full-time",
      "Messages and photo-update tabs in every booking thread",
    ],
  },
  {
    slug: "petpal-sitters",
    name: "PetPal Sitters",
    tagline: "Find trusted local pet sitters",
    niche: "Pet sitting",
    description:
      "A friendly cream-and-orange marketplace for booking local pet sitters — boarding, house sitting, drop-ins and walks — with big service tiles, tap-to-pick availability calendars and saved favorites.",
    flow: "booking-daily",
    priceCents: 24900,
    accent: "#F28C0F",
    bestFor: ["Pet sitting", "Cat sitting", "Dog walking", "Pet boarding"],
    highlights: [
      "Hero search with service tiles labeled per night, visit or walk",
      "Listing calendar where tapping dates fills the booking panel",
      "Owner profile with their pets and saved sitters",
    ],
  },
  {
    slug: "roomly",
    name: "Roomly",
    tagline: "Rooms and flatshares for longer stays",
    niche: "Room rental",
    description:
      "A fresh mint-and-navy marketplace for rooms, studios and flatshares on medium and long stays, where renters send inquiries and landlords schedule viewings — no checkout or booking fees.",
    flow: "inquiry",
    priceCents: 24900,
    accent: "#45D9A0",
    bestFor: ["Student housing", "Flatshares", "Intern housing", "Mid-term rentals"],
    highlights: [
      "Inquiry form with move-in date, stay length and intro message",
      "Flatmate profiles plus gender, couples, pets and smoking rules",
      "Landlord lead inbox: schedule viewings, mark agreed or close",
    ],
    lacks: ["checkout"],
  },
  {
    slug: "sitterly",
    name: "Sitterly",
    tagline: "Book trusted babysitters by the hour",
    niche: "Childcare services",
    description:
      "A soft lavender-and-peach marketplace for booking vetted babysitters and nannies by the hour, with background-check badges, certification filters, extra-child rates and a map-based sitter search.",
    flow: "booking-hourly",
    priceCents: 24900,
    accent: "#7856DE",
    bestFor: ["Babysitting", "Nanny services", "Senior care", "Pet sitting"],
    highlights: [
      "Hourly booking panel with extra-child rates and a booking fee",
      "Background-check badge and CPR/first-aid certification cards",
      "Booking timeline and emergency-contact card in the inbox",
    ],
  },
  {
    slug: "stackd",
    name: "Stackd",
    tagline: "Sell digital downloads",
    niche: "Digital downloads",
    description:
      "A bold, neo-brutalist marketplace in black and electric orange for selling digital downloads — e-books, printables, templates, photo packs, audio and courses — with instant delivery and pay-what-you-want pricing.",
    flow: "purchase",
    priceCents: 24900,
    accent: "#FF5A1F",
    bestFor: ["E-books", "Printables & planners", "Design templates", "Photo & audio packs"],
    highlights: [
      "Pay-what-you-want pricing with a minimum and suggested amounts",
      "Instant download screen and a library with per-file re-downloads",
      "Creator sales tab with net earnings, download rate and refunds",
    ],
    lacks: ["search-map"],
  },
  {
    slug: "stashly",
    name: "Stashly",
    tagline: "Rent storage space from neighbors",
    niche: "Storage rental",
    description:
      "A warm sand-and-teal marketplace for renting neighbors' spare garages, basements, attics and closets as storage, with move-in dates, refundable deposits and item inventories.",
    flow: "booking-daily",
    priceCents: 24900,
    accent: "#1F766F",
    bestFor: ["Peer-to-peer storage", "Garage rentals", "Parking spaces", "Vehicle storage"],
    highlights: [
      "Move-in date with ongoing-monthly or fixed end date, plus deposit",
      "Floor-plan size comparison against a mattress, car or boxes",
      "Storage inventory at checkout and an access log in the inbox",
    ],
  },
  {
    slug: "taskpost",
    name: "TaskPost",
    tagline: "Post a job, get offers from local pros",
    niche: "Home services",
    description:
      "A clean, orange-accented reverse marketplace where customers post local jobs with a budget range, nearby pros send offers, either side can counter, and payment is held until the customer confirms completion.",
    flow: "negotiation",
    priceCents: 24900,
    accent: "#C94A0C",
    bestFor: ["Handyman jobs", "Moving help", "House cleaning", "Yard work"],
    highlights: [
      "Pro offer form with the platform fee and a 'You'll earn' payout",
      "Accept, counter or decline offers inside the inbox thread",
      "Payment held until the customer confirms the job is done",
    ],
  },
  {
    slug: "tutorly",
    name: "Tutorly",
    tagline: "Book 1-on-1 online lessons",
    niche: "Online tutoring",
    description:
      "A bright sky-blue and sunny-yellow marketplace for booking 1-on-1 online lessons by the hour, with tutor intro-video blocks, discounted lesson packages and a video-classroom mock-up in the inbox.",
    flow: "booking-hourly",
    priceCents: 24900,
    accent: "#0279BD",
    bestFor: ["Academic tutoring", "Test prep", "Language lessons", "Coding classes"],
    highlights: [
      "14-day date strip with open start times and an hours counter",
      "5- and 10-lesson packages with automatic discounts",
      "Video-classroom mock-up and tutor lesson notes in the inbox",
    ],
    lacks: ["search-map"],
  },
  {
    slug: "vowly",
    name: "Vowly",
    tagline: "Find and contact wedding vendors",
    niche: "Wedding vendors",
    description:
      "An elegant ivory-and-rose wedding vendor marketplace with serif headings where couples filter photographers, venues and florists by date and guest count, send inquiries and chat with vendors — no checkout.",
    flow: "inquiry",
    priceCents: 24900,
    accent: "#8C4352",
    bestFor: ["Wedding vendors", "Event venues", "Photographers", "Event planners"],
    highlights: [
      "Inquiry form with wedding date, guests, budget and clash warning",
      "Inquiry statuses: sent, replied, booked offline, closed",
      "Search filters for wedding-date availability and guest capacity",
    ],
    lacks: ["checkout"],
  },
  {
    slug: "wanderly",
    name: "Wanderly",
    tagline: "Book local tours and experiences",
    niche: "Tours & experiences",
    description:
      "A vibrant, photo-led marketplace in sunset coral and deep teal for booking small-group tours and local experiences by departure time, with seats-left counts, itineraries and private-group pricing.",
    flow: "booking-timeslot",
    priceCents: 24900,
    accent: "#D23F1F",
    bestFor: ["City tours", "Food tours", "Cooking classes", "Outdoor activities"],
    highlights: [
      "Departure-time slots with seats-left and sold-out states",
      "Per-person pricing with an optional flat-rate private group",
      "Itinerary, included/not-included list and meeting-point map",
    ],
  },
];

export function getStoreTemplate(slug: string): StoreTemplate | undefined {
  return STORE_TEMPLATES.find((t) => t.slug === slug);
}

/** A 960×720 screenshot of the template's landing page (catalog cards, og:image). */
/** The pages a template ships with: TEMPLATE_PAGES minus what its design leaves out. */
export function templatePages(t: StoreTemplate): { name: string; sharetribe: string }[] {
  return TEMPLATE_PAGES.flatMap((p) => {
    if (p.sharetribe === "CheckoutPage" && t.lacks?.includes("checkout")) return [];
    if (p.sharetribe === "SearchPage" && t.lacks?.includes("search-map")) {
      return [{ ...p, name: "Search" }];
    }
    return [p];
  });
}

export function templateThumbnailPath(slug: string): string {
  return `/template-thumbnails/${slug}.jpg`;
}

export function templatePreviewPath(slug: string): string {
  return `/template-previews/${slug}/index.html`;
}

export function formatTemplatePrice(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}
