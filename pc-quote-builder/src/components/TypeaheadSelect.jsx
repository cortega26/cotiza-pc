import { useEffect, useMemo, useRef, useState } from "react";

const defaultGetOptionLabel = (opt) => opt?.name || "";

function TypeaheadSelect({
  options = [],
  value,
  onChange,
  placeholder = "",
  getOptionLabel = defaultGetOptionLabel,
  renderOption,
  maxItems = 50,
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
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
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (opt) => {
    onChange(opt.id);
    setQuery(getOptionLabel(opt));
    setOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (event) => {
    if (!["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(event.key)) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlightedIndex((prev) => {
        const next = prev + 1;
        return next >= filtered.length ? 0 : next;
      });
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setHighlightedIndex((prev) => {
        if (prev === -1) return filtered.length - 1;
        const next = prev - 1;
        return next < 0 ? filtered.length - 1 : next;
      });
    } else if (event.key === "Enter") {
      if (open && highlightedIndex >= 0 && filtered[highlightedIndex]) {
        event.preventDefault();
        handleSelect(filtered[highlightedIndex]);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
      setHighlightedIndex(-1);
    }
  };

  useEffect(() => {
    if (!open) {
      setHighlightedIndex(-1);
      return;
    }
    setHighlightedIndex((idx) => (idx >= filtered.length ? filtered.length - 1 : idx));
  }, [filtered.length, open]);

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
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open && filtered.length > 0 && (
        <ul className="typeahead-list" role="listbox">
          {filtered.map((opt, idx) => (
            <li
              key={opt.id}
              className={"typeahead-item" + (idx === highlightedIndex ? " active" : "")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(opt)}
              onMouseEnter={() => setHighlightedIndex(idx)}
              role="option"
              aria-selected={idx === highlightedIndex}
            >
              {renderOption ? renderOption(opt) : getOptionLabel(opt)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default TypeaheadSelect;
