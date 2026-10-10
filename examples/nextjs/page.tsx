// app/property/new/page.tsx — a server component that renders the client component in a form.
import { AddressAutocomplete } from "israel-address-autocomplete/react";

async function save(form: FormData) {
  "use server";
  // city, street, house_number, entrance, zip, address, latitude, longitude
  console.log(Object.fromEntries(form));
}

export default function Page() {
  return (
    <form action={save} className="grid gap-4">
      <AddressAutocomplete
        classNames={{
          root: "grid gap-3",
          field: "relative grid gap-1",
          label: "text-sm text-gray-600",
          input: "w-full min-w-0 rounded-xl border border-gray-300 px-3 py-2",
          menu: "absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-xl border bg-white shadow-lg",
          option: "block w-full px-3.5 py-2 text-start",
          optionActive: "bg-gray-100",
          row: "grid grid-cols-3 gap-3",
        }}
      />
      <button type="submit">Save</button>
    </form>
  );
}
