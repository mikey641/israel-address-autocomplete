import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { formatAddress, splitAddress } from "./format.js";

// Doar-style structured address input: pick the CITY from the official registry first, then a
// STREET that exists in that city, then house number + entrance. The zip fills in by itself and
// coordinates are stamped best-effort from GovMap once street + number are set.
//
// The component talks to a route served by `createAddressHandler()` (default `/api/address`).
// It is unstyled: pass `classNames` (Tailwind or your own CSS) or rely on the minimal inline
// defaults. Inside a <form>, hidden inputs submit the structured fields under `names`.

export interface AddressValue {
  city: string;
  street: string;
  houseNumber: string;
  entrance: string;
  zip: string;
  /** "הרצל 10 כניסה א" */
  address: string;
  lat: number | null;
  lng: number | null;
}

export interface AddressAutocompleteLabels {
  city: string;
  street: string;
  houseNumber: string;
  entrance: string;
  zip: string;
  cityPlaceholder: string;
  pickCityFirst: string;
}

export interface AddressAutocompleteClassNames {
  root?: string;
  field?: string;
  label?: string;
  input?: string;
  menu?: string;
  option?: string;
  optionActive?: string;
  row?: string;
}

export interface AddressAutocompleteProps {
  /** URL of the `createAddressHandler()` route. Default `/api/address`. */
  endpoint?: string;
  defaultValue?: Partial<Pick<AddressValue, "city" | "street" | "houseNumber" | "entrance" | "zip">> & {
    /** Legacy single-line address; split into street + number when `street` is absent. */
    address?: string;
  };
  onChange?: (value: AddressValue) => void;
  /** Hidden-input names for form submission; pass `false` to render none. */
  names?: Partial<Record<keyof AddressValue, string>> | false;
  labels?: Partial<AddressAutocompleteLabels>;
  classNames?: AddressAutocompleteClassNames;
  /** Debounce for registry lookups, in ms (default 250). */
  debounceMs?: number;
  /** Skip the GovMap coordinate lookup. */
  disableGeocode?: boolean;
  disabled?: boolean;
  /** Text direction of the whole control (default "rtl"). */
  dir?: "rtl" | "ltr";
}

const HEBREW_LABELS: AddressAutocompleteLabels = {
  city: "עיר",
  street: "רחוב",
  houseNumber: "מספר בית",
  entrance: "כניסה",
  zip: "מיקוד",
  cityPlaceholder: "הקלידו שם עיר",
  pickCityFirst: "בחרו עיר קודם",
};

const DEFAULT_NAMES: Record<keyof AddressValue, string> = {
  city: "city",
  street: "street",
  houseNumber: "house_number",
  entrance: "entrance",
  zip: "zip",
  address: "address",
  lat: "latitude",
  lng: "longitude",
};

const S: Record<string, CSSProperties> = {
  root: { display: "grid", gap: 12 },
  field: { position: "relative", display: "grid", gap: 4 },
  input: {
    boxSizing: "border-box", width: "100%", minWidth: 0, padding: "8px 12px", border: "1px solid #d2d2d7",
    borderRadius: 12, font: "inherit",
  },
  menu: {
    position: "absolute", insetInline: 0, top: "100%", zIndex: 20, marginTop: 4, maxHeight: 224, overflow: "auto",
    background: "#fff", border: "1px solid #d2d2d7", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,.08)",
  },
  option: {
    display: "block", width: "100%", padding: "8px 14px", textAlign: "start", border: 0, background: "transparent",
    font: "inherit", cursor: "pointer",
  },
  optionActive: { background: "#f5f5f7" },
  row: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 },
};

function useJson<T>(url: string | null, debounceMs: number, pick: (j: any) => T, empty: T): T {
  const [value, setValue] = useState<T>(empty);
  useEffect(() => {
    if (!url) {
      setValue(empty);
      return;
    }
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      try {
        const r = await fetch(url, { signal: ctrl.signal });
        setValue(pick(await r.json()));
      } catch {
        /* keep the previous value on a network error or abort */
      }
    }, debounceMs);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, debounceMs]);
  return value;
}

const NO_RESULTS: string[] = [];

function Combo(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onPick: (v: string) => void;
  options: string[];
  disabled?: boolean;
  placeholder?: string;
  classNames: AddressAutocompleteClassNames;
}) {
  const { label, value, onChange, onPick, options, disabled, placeholder, classNames: cn } = props;
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const dirty = useRef(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (o: string) => {
    dirty.current = false;
    onPick(o);
    setOpen(false);
  };
  const shown = dirty.current && open && options.length > 0 && !disabled;

  return (
    <div ref={boxRef} className={cn.field} style={cn.field ? undefined : S.field}>
      <label htmlFor={`${id}-input`} className={cn.label}>
        {label}
      </label>
      {/* autocomplete="one-time-code" keeps Chrome's address-profile autofill from covering the menu. */}
      <input
        id={`${id}-input`}
        role="combobox"
        aria-expanded={shown}
        aria-controls={`${id}-menu`}
        aria-autocomplete="list"
        aria-activedescendant={shown && hi >= 0 ? `${id}-opt-${hi}` : undefined}
        value={value}
        disabled={disabled}
        autoComplete="one-time-code"
        placeholder={placeholder}
        onChange={(e) => {
          dirty.current = true;
          onChange(e.target.value);
          setOpen(true);
          setHi(-1);
        }}
        onFocus={() => options.length > 0 && dirty.current && setOpen(true)}
        onKeyDown={(e) => {
          if (!shown) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHi((h) => (h + 1) % options.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHi((h) => (h <= 0 ? options.length - 1 : h - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(options[hi >= 0 ? hi : 0] ?? value);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className={cn.input}
        style={cn.input ? undefined : S.input}
      />
      {shown && (
        <div id={`${id}-menu`} role="listbox" className={cn.menu} style={cn.menu ? undefined : S.menu}>
          {options.map((o, i) => (
            <button
              type="button"
              role="option"
              id={`${id}-opt-${i}`}
              aria-selected={i === hi}
              key={o}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
              onMouseEnter={() => setHi(i)}
              className={[cn.option, i === hi ? cn.optionActive : ""].filter(Boolean).join(" ") || undefined}
              style={cn.option ? undefined : { ...S.option, ...(i === hi ? S.optionActive : {}) }}
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AddressAutocomplete(props: AddressAutocompleteProps): ReactNode {
  const {
    endpoint = "/api/address",
    defaultValue = {},
    onChange,
    names = DEFAULT_NAMES,
    classNames = {},
    debounceMs = 250,
    disableGeocode = false,
    disabled = false,
    dir = "rtl",
  } = props;
  const labels = { ...HEBREW_LABELS, ...props.labels };
  const legacy = defaultValue.street ? null : splitAddress(defaultValue.address ?? "");

  const [city, setCity] = useState(defaultValue.city ?? "");
  const [street, setStreet] = useState(defaultValue.street ?? legacy?.street ?? "");
  const [houseNumber, setHouseNumber] = useState(defaultValue.houseNumber ?? legacy?.houseNumber ?? "");
  const [entrance, setEntrance] = useState(defaultValue.entrance ?? "");
  const touched = useRef(false);

  const url = (params: Record<string, string>) => {
    const sep = endpoint.includes("?") ? "&" : "?";
    return `${endpoint}${sep}${new URLSearchParams(params)}`;
  };
  const c = city.trim();
  const s = street.trim();
  const n = houseNumber.trim();
  const e = entrance.trim();

  const cityOptions = useJson(
    c.length >= 2 ? url({ type: "cities", q: c }) : null,
    debounceMs,
    (j) => (Array.isArray(j?.results) ? (j.results as string[]) : NO_RESULTS),
    NO_RESULTS,
  );
  const streetOptions = useJson(
    c && s ? url({ type: "streets", city: c, q: s }) : null,
    debounceMs,
    (j) => (Array.isArray(j?.results) ? (j.results as string[]) : NO_RESULTS),
    NO_RESULTS,
  );
  // Until the user edits anything, keep the stored zip instead of re-deriving it.
  const fetchedZip = useJson<string | null>(
    touched.current && c && s ? url({ type: "zip", city: c, street: s, house: n, entrance: e }) : null,
    debounceMs + 150,
    (j) => (typeof j?.zip === "string" ? j.zip : null),
    null,
  );
  const zip = touched.current ? (fetchedZip ?? "") : (defaultValue.zip ?? "");
  const coords = useJson<{ lat: number; lng: number } | null>(
    !disableGeocode && c && s && n ? url({ type: "geocode", q: `${s} ${n} ${c}` }) : null,
    debounceMs + 150,
    (j) => {
      const hit = Array.isArray(j?.results) ? j.results[0] : null;
      return hit?.lat != null && hit?.lng != null ? { lat: hit.lat, lng: hit.lng } : null;
    },
    null,
  );

  const value: AddressValue = {
    city: c,
    street: s,
    houseNumber: n,
    entrance: e,
    zip,
    address: formatAddress({ street: s, houseNumber: n, entrance: e }),
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
  };

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const key = JSON.stringify(value);
  useEffect(() => {
    onChangeRef.current?.(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const edit = (fn: () => void) => {
    touched.current = true;
    fn();
  };
  const resetFromCity = (v: string) =>
    edit(() => {
      setCity(v);
      setStreet("");
      setHouseNumber("");
    });
  const inputStyle = classNames.input ? undefined : S.input;
  const fieldStyle = classNames.field ? undefined : S.field;
  const hiddenNames = names === false ? null : { ...DEFAULT_NAMES, ...names };

  return (
    <div dir={dir} className={classNames.root} style={classNames.root ? undefined : S.root}>
      <Combo
        label={labels.city}
        value={city}
        onChange={resetFromCity}
        onPick={resetFromCity}
        options={cityOptions}
        disabled={disabled}
        placeholder={labels.cityPlaceholder}
        classNames={classNames}
      />
      <Combo
        label={labels.street}
        value={street}
        onChange={(v) => edit(() => setStreet(v))}
        onPick={(v) => edit(() => setStreet(v))}
        options={streetOptions}
        disabled={disabled || !c}
        placeholder={c ? "" : labels.pickCityFirst}
        classNames={classNames}
      />
      <div className={classNames.row} style={classNames.row ? undefined : S.row}>
        <label className={classNames.field} style={fieldStyle}>
          <span className={classNames.label}>{labels.houseNumber}</span>
          <input
            value={houseNumber}
            inputMode="numeric"
            autoComplete="one-time-code"
            disabled={disabled || !s}
            onChange={(ev) => edit(() => setHouseNumber(ev.target.value))}
            className={classNames.input}
            style={inputStyle}
          />
        </label>
        <label className={classNames.field} style={fieldStyle}>
          <span className={classNames.label}>{labels.entrance}</span>
          <input
            value={entrance}
            autoComplete="one-time-code"
            disabled={disabled}
            onChange={(ev) => edit(() => setEntrance(ev.target.value))}
            className={classNames.input}
            style={inputStyle}
          />
        </label>
        <label className={classNames.field} style={fieldStyle}>
          <span className={classNames.label}>{labels.zip}</span>
          <input
            value={zip}
            readOnly
            tabIndex={-1}
            autoComplete="one-time-code"
            className={classNames.input}
            style={{ ...inputStyle, opacity: 0.7 }}
          />
        </label>
      </div>
      {hiddenNames &&
        (Object.keys(hiddenNames) as (keyof AddressValue)[]).map((k) =>
          value[k] == null ? null : <input key={k} type="hidden" name={hiddenNames[k]} value={String(value[k])} />,
        )}
    </div>
  );
}

export default AddressAutocomplete;
