import { useState } from "react";
import { createRoot } from "react-dom/client";
import { AddressAutocomplete, type AddressValue } from "israel-address-autocomplete/react";

function Demo() {
  const [value, setValue] = useState<AddressValue | null>(null);
  return (
    <main style={{ maxWidth: 520, margin: "48px auto", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22 }}>israel-address-autocomplete</h1>
      <AddressAutocomplete endpoint="/api/address" onChange={setValue} />
      <pre dir="ltr" style={{ marginTop: 24, background: "#f5f5f7", padding: 12, borderRadius: 12 }}>
        {JSON.stringify(value, null, 2)}
      </pre>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Demo />);
