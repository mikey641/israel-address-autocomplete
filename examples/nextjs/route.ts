// app/api/address/route.ts — the whole server side for a Next.js App Router project.
import { createAddressHandler } from "israel-address-autocomplete";

export const GET = createAddressHandler({
  // Optional: let Next's data cache keep registry responses for a day.
  israelPost: { init: { next: { revalidate: 86400 } } },
});
