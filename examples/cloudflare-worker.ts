// A standalone Cloudflare Worker that serves the lookups for a static site on another origin.
import { createAddressHandler } from "israel-address-autocomplete";

const handler = createAddressHandler({ allowOrigin: "https://www.example.co.il" });

export default { fetch: handler };
