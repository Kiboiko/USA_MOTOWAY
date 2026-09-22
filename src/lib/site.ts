export const site = {
  name: "Carviondealer",
  domain: "carviondealer.com",
  url: "https://carviondealer.com",
  email: "sales@carviondealer.com",
  hours: "Mon - Fri, 9:00 AM - 5:00 PM",
  description:
    "Carviondealer sources late-model luxury and performance vehicles and offers them directly to buyers — clean cars, honest details, fair prices.",
  // The address is for appointments and structured data, not a walk-in storefront.
  address: {
    street: "1213 4th Ave N",
    city: "Kent",
    region: "WA",
    postalCode: "98032",
    full: "1213 4th Ave N, Kent, WA 98032, USA",
    // Google Business listing id. Pins the map on the verified place itself,
    // so a text search can never drift to a neighbouring address.
    googlePlaceCid: "2743669156424832479",
    // Coordinates of the verified listing, read from Google itself.
    lat: 47.3954747,
    lng: -122.2381649
  },
  country: "United States",
  countryCode: "US",
  // Phone for click-to-call buttons. Use international format (e.g. "+12185551234").
  // Empty hides every call-now button and the phone lines in the header/footer.
  phone: "+13608612517" as string,
  // Pretty-printed phone for display (e.g. "(218) 555-1234"). Optional.
  phoneDisplay: "(360) 861-2517" as string
};

export const navItems = [
  { href: "/", label: "Home" },
  { href: "/inventory", label: "Inventory" },
  { href: "/sold", label: "Sold" },
  { href: "/why-liquidation", label: "Why Liquidation" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" }
];
