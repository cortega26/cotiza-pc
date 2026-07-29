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
  const [isEditing, setIsEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);

  const selected = options.find((option) => option.id === value);
  const selectedLabel = selected ? getOptionLabel(selected) : "";
  const inputValue = isEditing ? query : selectedLabel;

  const filtered = useMemo(() => {
    const q = inputValue.trim().toLowerCase();
    if (!q) return options.slice(0, maxItems);
    const tokens = q.split(/\s+/).filter(Boolean);
    return options
      .filter((opt) => {
        const label = getOptionLabel(opt).toLowerCase();
        return tokens.every((token) => label.includes(token));
      })
      .slice(0, maxItems);
  }, [options, inputValue, maxItems, getOptionLabel]);

  const activeIndex = open && highlightedIndex >= 0 && highlightedIndex < filtered.length ? highlightedIndex : -1;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setIsEditing(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (opt) => {
    onChange(opt.id);
    setQuery(getOptionLabel(opt));
    setIsEditing(false);
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
      if (open && activeIndex >= 0 && filtered[activeIndex]) {
        event.preventDefault();
        handleSelect(filtered[activeIndex]);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
      setIsEditing(false);
      setHighlightedIndex(-1);
    }
  };

  return (
    <div className="typeahead" ref={containerRef}>
      <input
        className="typeahead-input"
        type="text"
        value={inputValue}
        placeholder={placeholder}
        onFocus={() => {
          setQuery(selectedLabel);
          setIsEditing(true);
          setOpen(true);
          setHighlightedIndex(-1);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsEditing(true);
          setOpen(true);
          setHighlightedIndex(-1);
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
              className={"typeahead-item" + (idx === activeIndex ? " active" : "")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(opt)}
              onMouseEnter={() => setHighlightedIndex(idx)}
              role="option"
              aria-selected={idx === activeIndex}
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
