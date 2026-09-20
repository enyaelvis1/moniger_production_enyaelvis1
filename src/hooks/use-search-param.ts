import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

export const useSearchParamState = (paramName = "search") => {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramValue = searchParams.get(paramName) ?? "";
  const [value, setValue] = useState(paramValue);

  useEffect(() => {
    setValue(paramValue);
  }, [paramValue]);

  const updateValue = useCallback(
    (nextValue: string) => {
      setValue(nextValue);

      const nextParams = new URLSearchParams(searchParams);
      if (nextValue.trim()) {
        nextParams.set(paramName, nextValue);
      } else {
        nextParams.delete(paramName);
      }

      setSearchParams(nextParams, { replace: true });
    },
    [paramName, searchParams, setSearchParams],
  );

  return [value, updateValue] as const;
};
