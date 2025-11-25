import { useEffect, useMemo, useRef, useState } from "react";

const defaultGetOptionLabel = (opt) => opt?.name || "";

function TypeaheadSelect({
  options = [],
  value,
  onChange,
  placeholder = "",
  getOptionLabel = defaultGetOptionLabel,
  renderOption,
  maxItems = 15,
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const selected = options.find((o) => o.id === value);
    if (selected) {
      setQuery(getOptionLabel(selected));
    } else {
      setQuery("");
    }
  }, [value, options, getOptionLabel]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, maxItems);
    return options
      .filter((opt) => getOptionLabel(opt).toLowerCase().includes(q))
      .slice(0, maxItems);
  }, [options, query, maxItems, getOptionLabel]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (opt) => {
    onChange(opt.id);
    setQuery(getOptionLabel(opt));
    setOpen(false);
  };

  return (
    <div className="typeahead" ref={containerRef}>
      <input
        className="typeahead-input"
        type="text"
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (!e.target.value) onChange("");
        }}
      />
      {open && filtered.length > 0 && (
        <ul className="typeahead-list">
          {filtered.map((opt) => (
            <li key={opt.id} className="typeahead-item" onMouseDown={(e) => e.preventDefault()} onClick={() => handleSelect(opt)}>
              {renderOption ? renderOption(opt) : getOptionLabel(opt)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default TypeaheadSelect;
