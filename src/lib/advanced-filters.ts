export type FilterOption = {
  label: string;
  value: string;
};

export type DateRangeFilterValue = {
  from: string;
  to: string;
};

export type NumberRangeFilterValue = {
  max: string;
  min: string;
};

export type AdvancedFilterValue = string | string[] | DateRangeFilterValue | NumberRangeFilterValue;
export type AdvancedFilterState = Record<string, AdvancedFilterValue | undefined>;

type BaseFilterDefinition = {
  description?: string;
  id: string;
  label: string;
};

type SelectFilterDefinition = BaseFilterDefinition & {
  emptyLabel?: string;
  options: FilterOption[];
  type: "select";
};

type MultiSelectFilterDefinition = BaseFilterDefinition & {
  options: FilterOption[];
  type: "multi-select";
};

type DateRangeFilterDefinition = BaseFilterDefinition & {
  fromLabel?: string;
  toLabel?: string;
  type: "date-range";
};

type NumberRangeFilterDefinition = BaseFilterDefinition & {
  maxLabel?: string;
  maxPlaceholder?: string;
  minLabel?: string;
  minPlaceholder?: string;
  step?: string;
  type: "number-range";
};

export type AdvancedFilterDefinition =
  | SelectFilterDefinition
  | MultiSelectFilterDefinition
  | DateRangeFilterDefinition
  | NumberRangeFilterDefinition;

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isEmptyAdvancedFilterValue = (value: AdvancedFilterValue | undefined) => {
  if (typeof value === "undefined") {
    return true;
  }

  if (typeof value === "string") {
    return value.trim().length === 0;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (isDateRangeFilterValue(value)) {
    return !value.from && !value.to;
  }

  if (isNumberRangeFilterValue(value)) {
    return !value.min && !value.max;
  }

  return true;
};

export const cloneAdvancedFilterValue = (value: AdvancedFilterValue): AdvancedFilterValue => {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return [...value];
  }

  if (isDateRangeFilterValue(value)) {
    return { from: value.from, to: value.to };
  }

  if (isNumberRangeFilterValue(value)) {
    return { max: value.max, min: value.min };
  }

  return value;
};

export const getStringFilterValue = (value: AdvancedFilterValue | undefined) => (typeof value === "string" ? value : "");

export const getMultiSelectFilterValue = (value: AdvancedFilterValue | undefined) => (Array.isArray(value) ? value : []);

export const isDateRangeFilterValue = (value: AdvancedFilterValue | undefined): value is DateRangeFilterValue =>
  isObjectRecord(value) && "from" in value && "to" in value;

export const isNumberRangeFilterValue = (value: AdvancedFilterValue | undefined): value is NumberRangeFilterValue =>
  isObjectRecord(value) && "min" in value && "max" in value;

export const matchesDateRange = (value: string | null | undefined, range: DateRangeFilterValue | undefined) => {
  if (!range || (!range.from && !range.to)) {
    return true;
  }

  if (!value) {
    return false;
  }

  const normalizedValue = value.slice(0, 10);
  if (range.from && normalizedValue < range.from) {
    return false;
  }

  if (range.to && normalizedValue > range.to) {
    return false;
  }

  return true;
};

export const matchesNumberRange = (value: number, range: NumberRangeFilterValue | undefined) => {
  if (!range || (!range.min && !range.max)) {
    return true;
  }

  if (range.min && value < Number(range.min)) {
    return false;
  }

  if (range.max && value > Number(range.max)) {
    return false;
  }

  return true;
};

export const sanitizeAdvancedFilterState = (
  definitions: AdvancedFilterDefinition[],
  state: AdvancedFilterState,
): AdvancedFilterState =>
  definitions.reduce<AdvancedFilterState>((nextState, definition) => {
    const value = state[definition.id];
    if (!isEmptyAdvancedFilterValue(value)) {
      nextState[definition.id] = cloneAdvancedFilterValue(value);
    }
    return nextState;
  }, {});

const formatRangeValue = (start: string, end: string, emptyLabel: string) => {
  if (start && end) {
    return `${start} to ${end}`;
  }

  if (start) {
    return `${start}+`;
  }

  if (end) {
    return `Up to ${end}`;
  }

  return emptyLabel;
};

export const summarizeAdvancedFilterState = (
  definitions: AdvancedFilterDefinition[],
  state: AdvancedFilterState,
  maxItems = 2,
) => {
  const summaryParts = definitions.flatMap((definition) => {
    const value = state[definition.id];
    if (isEmptyAdvancedFilterValue(value)) {
      return [];
    }

    if (definition.type === "select") {
      const optionLabel = definition.options.find((option) => option.value === value)?.label ?? String(value);
      return [`${definition.label}: ${optionLabel}`];
    }

    if (definition.type === "multi-select") {
      const selectedValues = getMultiSelectFilterValue(value);
      const selectedLabels = selectedValues.map(
        (selectedValue) => definition.options.find((option) => option.value === selectedValue)?.label ?? selectedValue,
      );
      const summary =
        selectedLabels.length <= 2
          ? selectedLabels.join(", ")
          : `${selectedLabels.slice(0, 2).join(", ")} +${selectedLabels.length - 2}`;
      return [`${definition.label}: ${summary}`];
    }

    if (definition.type === "date-range" && isDateRangeFilterValue(value)) {
      return [`${definition.label}: ${formatRangeValue(value.from, value.to, "Any date")}`];
    }

    if (definition.type === "number-range" && isNumberRangeFilterValue(value)) {
      return [`${definition.label}: ${formatRangeValue(value.min, value.max, "Any amount")}`];
    }

    return [];
  });

  if (summaryParts.length === 0) {
    return "No filters";
  }

  if (summaryParts.length <= maxItems) {
    return summaryParts.join(" • ");
  }

  return `${summaryParts.slice(0, maxItems).join(" • ")} +${summaryParts.length - maxItems} more`;
};

export const serializeAdvancedFilterState = (definitions: AdvancedFilterDefinition[], state: AdvancedFilterState) =>
  JSON.stringify(
    definitions.reduce<Record<string, AdvancedFilterValue>>((serializedState, definition) => {
      const value = state[definition.id];
      if (!isEmptyAdvancedFilterValue(value)) {
        serializedState[definition.id] = cloneAdvancedFilterValue(value);
      }
      return serializedState;
    }, {}),
  );

export const getActiveAdvancedFilterCount = (definitions: AdvancedFilterDefinition[], state: AdvancedFilterState) =>
  definitions.reduce((count, definition) => (isEmptyAdvancedFilterValue(state[definition.id]) ? count : count + 1), 0);
