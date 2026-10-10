// Server-side lookups without any UI: `npx tsx examples/node.ts`
import { geocode, lookupZip, searchCities, searchStreets } from "israel-address-autocomplete";

const [city] = await searchCities("ראשון");
console.log(city); // { id: "1252", symbol: "8300", name: "ראשון לציון", synonym: 'ראשל"צ' }

const streets = await searchStreets(city!, "הרצ");
console.log(streets.map((s) => s.name)); // ["דרך חיים הרצוג", "הרב הרצוג", "הרץ גוסטב", "הרצל"]

console.log(await lookupZip({ city: "ראשון לציון", street: "הרצל", house: "10" })); // "7528705"

// GovMap may block datacenter / some residential IPs — then this is [].
console.log(await geocode("הרצל 10 ראשון לציון"));
