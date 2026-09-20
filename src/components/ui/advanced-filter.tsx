import { useEffect, useMemo, useRef, useState } from "react";
import { BookmarkPlus, Check, History, SlidersHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getActiveAdvancedFilterCount,
  getMultiSelectFilterValue,
  getStringFilterValue,
  isDateRangeFilterValue,
  isEmptyAdvancedFilterValue,
  isNumberRangeFilterValue,
  sanitizeAdvancedFilterState,
  serializeAdvancedFilterState,
  summarizeAdvancedFilterState,
  type AdvancedFilterDefinition,
  type AdvancedFilterState,
  type AdvancedFilterValue,
} from "@/lib/advanced-filters";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type AdvancedFilterProps = {
  buttonLabel?: string;
  definitions: AdvancedFilterDefinition[];
  onChange: (nextState: AdvancedFilterState) => void;
  state: AdvancedFilterState;
  storageKey?: string;
  title?: string;
};

type SavedFilterPreset = {
  createdAt: string;
  id: string;
  lastUsedAt: string;
  name: string;
  state: AdvancedFilterState;
  summary: string;
};

type FilterHistoryEntry = {
  id: string;
  recordedAt: string;
  state: AdvancedFilterState;
  summary: string;
};

const EMPTY_SELECT_VALUE = "__all__";
const STORAGE_PREFIX = "moniger:advanced-filters";
const MAX_HISTORY_ITEMS = 6;
const MAX_PRESET_ITEMS = 8;

const createStoredId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const getStorageEntryKey = (storageKey: string, type: "history" | "presets") => `${STORAGE_PREFIX}:${storageKey}:${type}`;

const formatStoredDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(date);
};

const readStoredArray = (storageKey: string, type: "history" | "presets") => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(getStorageEntryKey(storageKey, type));
    const parsedValue = rawValue ? JSON.parse(rawValue) : [];
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
};

const writeStoredArray = (storageKey: string, type: "history" | "presets", value: unknown[]) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getStorageEntryKey(storageKey, type), JSON.stringify(value));
};

const normalizeSavedPreset = (
  value: unknown,
  definitions: AdvancedFilterDefinition[],
): SavedFilterPreset | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<SavedFilterPreset>;
  const sanitizedState = sanitizeAdvancedFilterState(
    definitions,
    candidate.state && typeof candidate.state === "object" && !Array.isArray(candidate.state) ? candidate.state : {},
  );

  if (Object.keys(sanitizedState).length === 0 || typeof candidate.name !== "string" || !candidate.name.trim()) {
    return null;
  }

  return {
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : new Date().toISOString(),
    id: typeof candidate.id === "string" ? candidate.id : createStoredId(),
    lastUsedAt: typeof candidate.lastUsedAt === "string" ? candidate.lastUsedAt : new Date().toISOString(),
    name: candidate.name.trim(),
    state: sanitizedState,
    summary:
      typeof candidate.summary === "string" && candidate.summary.trim()
        ? candidate.summary
        : summarizeAdvancedFilterState(definitions, sanitizedState),
  };
};

const normalizeHistoryEntry = (
  value: unknown,
  definitions: AdvancedFilterDefinition[],
): FilterHistoryEntry | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<FilterHistoryEntry>;
  const sanitizedState = sanitizeAdvancedFilterState(
    definitions,
    candidate.state && typeof candidate.state === "object" && !Array.isArray(candidate.state) ? candidate.state : {},
  );

  if (Object.keys(sanitizedState).length === 0) {
    return null;
  }

  return {
    id: typeof candidate.id === "string" ? candidate.id : createStoredId(),
    recordedAt: typeof candidate.recordedAt === "string" ? candidate.recordedAt : new Date().toISOString(),
    state: sanitizedState,
    summary:
      typeof candidate.summary === "string" && candidate.summary.trim()
        ? candidate.summary
        : summarizeAdvancedFilterState(definitions, sanitizedState),
  };
};

export function AdvancedFilter({
  buttonLabel = "Advanced Filters",
  definitions,
  onChange,
  state,
  storageKey,
  title = "Advanced Filters",
}: AdvancedFilterProps) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<FilterHistoryEntry[]>([]);
  const [presetName, setPresetName] = useState("");
  const [presets, setPresets] = useState<SavedFilterPreset[]>([]);
  const [showPresetForm, setShowPresetForm] = useState(false);
  const openedStateSignatureRef = useRef("");

  const activeFilterCount = useMemo(() => getActiveAdvancedFilterCount(definitions, state), [definitions, state]);
  const sanitizedState = useMemo(() => sanitizeAdvancedFilterState(definitions, state), [definitions, state]);
  const stateSignature = useMemo(
    () => serializeAdvancedFilterState(definitions, sanitizedState),
    [definitions, sanitizedState],
  );
  const stateSummary = useMemo(
    () => summarizeAdvancedFilterState(definitions, sanitizedState),
    [definitions, sanitizedState],
  );

  useEffect(() => {
    if (!storageKey) {
      setPresets([]);
      setHistory([]);
      return;
    }

    const nextPresets = readStoredArray(storageKey, "presets")
      .map((entry) => normalizeSavedPreset(entry, definitions))
      .filter((entry): entry is SavedFilterPreset => Boolean(entry));
    const nextHistory = readStoredArray(storageKey, "history")
      .map((entry) => normalizeHistoryEntry(entry, definitions))
      .filter((entry): entry is FilterHistoryEntry => Boolean(entry));

    setPresets(nextPresets);
    setHistory(nextHistory);
  }, [definitions, storageKey]);

  const updateState = (filterId: string, nextValue: AdvancedFilterValue | undefined) => {
    const nextState = { ...state };

    if (isEmptyAdvancedFilterValue(nextValue)) {
      delete nextState[filterId];
    } else {
      nextState[filterId] = nextValue;
    }

    onChange(nextState);
  };

  const persistPresets = (nextPresets: SavedFilterPreset[]) => {
    setPresets(nextPresets);
    if (storageKey) {
      writeStoredArray(storageKey, "presets", nextPresets);
    }
  };

  const persistHistory = (nextHistory: FilterHistoryEntry[]) => {
    setHistory(nextHistory);
    if (storageKey) {
      writeStoredArray(storageKey, "history", nextHistory);
    }
  };

  const recordHistory = (nextState: AdvancedFilterState) => {
    if (!storageKey) {
      return;
    }

    const sanitizedNextState = sanitizeAdvancedFilterState(definitions, nextState);
    if (Object.keys(sanitizedNextState).length === 0) {
      return;
    }

    const nextSignature = serializeAdvancedFilterState(definitions, sanitizedNextState);
    const nextEntry: FilterHistoryEntry = {
      id: createStoredId(),
      recordedAt: new Date().toISOString(),
      state: sanitizedNextState,
      summary: summarizeAdvancedFilterState(definitions, sanitizedNextState),
    };

    const nextHistory = [
      nextEntry,
      ...history.filter(
        (entry) => serializeAdvancedFilterState(definitions, entry.state) !== nextSignature,
      ),
    ].slice(0, MAX_HISTORY_ITEMS);

    persistHistory(nextHistory);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      openedStateSignatureRef.current = stateSignature;
      setOpen(true);
      return;
    }

    if (stateSignature && stateSignature !== openedStateSignatureRef.current) {
      recordHistory(sanitizedState);
    }

    setOpen(false);
    setPresetName("");
    setShowPresetForm(false);
  };

  const handleSavePreset = () => {
    const normalizedName = presetName.trim().replace(/\s+/g, " ");
    if (!storageKey || !normalizedName || activeFilterCount === 0) {
      return;
    }

    const now = new Date().toISOString();
    const existingPreset = presets.find((preset) => preset.name.toLowerCase() === normalizedName.toLowerCase());
    const nextPreset: SavedFilterPreset = {
      createdAt: existingPreset?.createdAt ?? now,
      id: existingPreset?.id ?? createStoredId(),
      lastUsedAt: now,
      name: normalizedName,
      state: sanitizedState,
      summary: stateSummary,
    };

    const nextPresets = [
      nextPreset,
      ...presets.filter((preset) => preset.id !== existingPreset?.id),
    ].slice(0, MAX_PRESET_ITEMS);

    persistPresets(nextPresets);
    setPresetName("");
    setShowPresetForm(false);
  };

  const applyStoredState = (nextState: AdvancedFilterState) => {
    onChange(sanitizeAdvancedFilterState(definitions, nextState));
  };

  const handleApplyPreset = (preset: SavedFilterPreset) => {
    applyStoredState(preset.state);

    const now = new Date().toISOString();
    const nextPresets = [
      { ...preset, lastUsedAt: now },
      ...presets.filter((entry) => entry.id !== preset.id),
    ];
    persistPresets(nextPresets);
  };

  const handleDeletePreset = (presetId: string) => {
    persistPresets(presets.filter((preset) => preset.id !== presetId));
  };

  const handleClearHistory = () => {
    persistHistory([]);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full gap-2 rounded-lg sm:w-auto">
          <SlidersHorizontal size={16} aria-hidden="true" />
          {buttonLabel}
          {activeFilterCount > 0 ? (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
              {activeFilterCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        collisionPadding={16}
        className="w-[calc(100vw-1rem)] max-h-[min(78vh,40rem)] max-w-[420px] space-y-4 overflow-y-auto p-4 sm:w-[420px]"
      >
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <span className="text-xs text-muted-foreground">
              {activeFilterCount > 0 ? `${activeFilterCount} active` : "No active filters"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Refine the records shown in this view.</p>
        </div>

        {storageKey ? (
          <div className="space-y-3 rounded-lg border border-border bg-muted/10 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Saved Views</p>
                <p className="text-xs text-muted-foreground">Store repeatable filters and quickly restore recent ones.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-2"
                onClick={() => setShowPresetForm((currentValue) => !currentValue)}
                disabled={activeFilterCount === 0}
              >
                <BookmarkPlus size={14} aria-hidden="true" />
                Save Current
              </Button>
            </div>

            {showPresetForm ? (
              <div className="space-y-2 rounded-md border border-border bg-background p-3">
                <Label className="text-xs text-muted-foreground">Preset Name</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={presetName}
                    onChange={(event) => setPresetName(event.target.value)}
                    placeholder="Overdue this month"
                    className="h-9 rounded-lg"
                  />
                  <Button size="sm" className="h-9" onClick={handleSavePreset} disabled={!presetName.trim()}>
                    Save
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{stateSummary}</p>
              </div>
            ) : null}

            {presets.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Presets</div>
                  <span className="text-[11px] text-muted-foreground">{presets.length} saved</span>
                </div>
                <div className="space-y-2">
                  {presets.map((preset) => (
                    <div key={preset.id} className="rounded-md border border-border bg-background p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{preset.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{preset.summary}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Updated {formatStoredDate(preset.lastUsedAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => handleApplyPreset(preset)}>
                            Apply
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground"
                            onClick={() => handleDeletePreset(preset.id)}
                            aria-label={`Delete ${preset.name} preset`}
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {history.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <History size={12} aria-hidden="true" />
                    Recent Filters
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleClearHistory}>
                    Clear
                  </Button>
                </div>
                <div className="space-y-2">
                  {history.map((entry) => (
                    <div key={entry.id} className="rounded-md border border-border bg-background p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-foreground">{entry.summary}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Used {formatStoredDate(entry.recordedAt)}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => applyStoredState(entry.state)}>
                          Apply
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-4">
          {definitions.map((definition) => (
            <div key={definition.id} className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
              <div className="space-y-1">
                <Label className="text-sm font-medium text-foreground">{definition.label}</Label>
                {definition.description ? <p className="text-xs text-muted-foreground">{definition.description}</p> : null}
              </div>

              {definition.type === "select" ? (
                <Select
                  value={getStringFilterValue(state[definition.id]) || EMPTY_SELECT_VALUE}
                  onValueChange={(nextValue) =>
                    updateState(definition.id, nextValue === EMPTY_SELECT_VALUE ? undefined : nextValue)
                  }
                >
                  <SelectTrigger className="rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={EMPTY_SELECT_VALUE}>{definition.emptyLabel ?? "All"}</SelectItem>
                    {definition.options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              {definition.type === "multi-select" ? (
                <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                  {definition.options.length > 0 ? (
                    definition.options.map((option) => {
                      const selectedValues = getMultiSelectFilterValue(state[definition.id]);
                      const checked = selectedValues.includes(option.value);

                      return (
                        <label
                          key={option.value}
                          className="flex cursor-pointer items-center gap-3 rounded-md border border-transparent px-2 py-1.5 transition-colors hover:border-border hover:bg-background"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(nextChecked) => {
                              const nextValues = nextChecked
                                ? [...selectedValues, option.value]
                                : selectedValues.filter((value) => value !== option.value);
                              updateState(definition.id, nextValues);
                            }}
                          />
                          <span className="text-sm text-foreground">{option.label}</span>
                        </label>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">No options available yet.</p>
                  )}
                </div>
              ) : null}

              {definition.type === "date-range" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{definition.fromLabel ?? "From"}</Label>
                    <Input
                      type="date"
                      value={isDateRangeFilterValue(state[definition.id]) ? state[definition.id].from : ""}
                      onChange={(event) =>
                        updateState(definition.id, {
                          from: event.target.value,
                          to: isDateRangeFilterValue(state[definition.id]) ? state[definition.id].to : "",
                        })
                      }
                      className="rounded-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{definition.toLabel ?? "To"}</Label>
                    <Input
                      type="date"
                      value={isDateRangeFilterValue(state[definition.id]) ? state[definition.id].to : ""}
                      onChange={(event) =>
                        updateState(definition.id, {
                          from: isDateRangeFilterValue(state[definition.id]) ? state[definition.id].from : "",
                          to: event.target.value,
                        })
                      }
                      className="rounded-lg"
                    />
                  </div>
                </div>
              ) : null}

              {definition.type === "number-range" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{definition.minLabel ?? "Minimum"}</Label>
                    <Input
                      type="number"
                      step={definition.step ?? "0.01"}
                      value={isNumberRangeFilterValue(state[definition.id]) ? state[definition.id].min : ""}
                      onChange={(event) =>
                        updateState(definition.id, {
                          max: isNumberRangeFilterValue(state[definition.id]) ? state[definition.id].max : "",
                          min: event.target.value,
                        })
                      }
                      placeholder={definition.minPlaceholder ?? "0"}
                      className="rounded-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{definition.maxLabel ?? "Maximum"}</Label>
                    <Input
                      type="number"
                      step={definition.step ?? "0.01"}
                      value={isNumberRangeFilterValue(state[definition.id]) ? state[definition.id].max : ""}
                      onChange={(event) =>
                        updateState(definition.id, {
                          max: event.target.value,
                          min: isNumberRangeFilterValue(state[definition.id]) ? state[definition.id].min : "",
                        })
                      }
                      placeholder={definition.maxPlaceholder ?? "1000000"}
                      className="rounded-lg"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
          <Button variant="ghost" size="sm" onClick={() => onChange({})} disabled={activeFilterCount === 0}>
            Clear All
          </Button>
          <Button size="sm" className="gap-2" onClick={() => handleOpenChange(false)}>
            <Check size={14} aria-hidden="true" />
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
