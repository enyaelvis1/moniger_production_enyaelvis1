/**
 * Enterprise-Level Error Handling System
 * Implements proper error boundaries, recovery mechanisms, and user feedback
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { captureMonitoringException } from "@/lib/monitoring";
import { isValidPhoneNumber } from "@/lib/phone";

// ============================================================
// 1. ERROR TYPES
// ============================================================

export type ErrorSeverity = "info" | "warning" | "error" | "critical";
export type AppErrorType =
  | "validation"
  | "network"
  | "auth"
  | "permission"
  | "server"
  | "unknown";
export type ErrorContextData = Record<string, unknown>;

export interface AppError {
  id: string;
  type: AppErrorType;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  timestamp: Date;
  context?: ErrorContextData;
  recoveryAction?: () => void;
  recoveryLabel?: string;
  retryable?: boolean;
}

interface ErrorResponseLike {
  status?: number;
}

interface ErrorConfigLike {
  url?: string;
}

interface ErrorLike {
  message?: string;
  response?: ErrorResponseLike;
  config?: ErrorConfigLike;
}

export interface ValidationRule<T = unknown> {
  validate: (value: T) => boolean;
  message: string;
}

export interface FormValidationSchema {
  [field: string]: ValidationRule<unknown>[];
}

export interface FormDataShape {
  [field: string]: unknown;
}

export interface QueuedRequest {
  id: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  url: string;
  data?: unknown;
  timestamp: Date;
  retries: number;
}

interface ErrorContextType {
  errors: AppError[];
  addError: (error: AppError) => void;
  removeError: (id: string) => void;
  clearErrors: () => void;
}

export type ErrorProviderProps = PropsWithChildren;

// ============================================================
// 2. ERROR FACTORY
// ============================================================

export const createError = (
  type: AppError["type"],
  message: string,
  userMessage: string,
  options: Partial<AppError> = {}
): AppError => ({
  id: `${type}-${Date.now()}-${Math.random()}`,
  type,
  severity: options.severity || "error",
  message,
  userMessage,
  timestamp: new Date(),
  retryable: options.retryable ?? true,
  ...options,
});

export const ErrorFactory = {
  validation: (field: string, message: string) =>
    createError("validation", `Validation failed for ${field}`, message, {
      severity: "warning",
    }),

  network: (endpoint: string) =>
    createError(
      "network",
      `Network request failed to ${endpoint}`,
      "Network error. Please check your connection and try again.",
      { severity: "error", retryable: true }
    ),

  auth: (reason: string) =>
    createError(
      "auth",
      `Authentication failed: ${reason}`,
      "Your session has expired. Please log in again.",
      { severity: "warning" }
    ),

  permission: (resource: string) =>
    createError(
      "permission",
      `Permission denied for ${resource}`,
      "You don't have permission to access this resource.",
      { severity: "warning" }
    ),

  notFound: (resource: string) =>
    createError(
      "server",
      `Resource not found: ${resource}`,
      `${resource} not found. It may have been deleted.`,
      { severity: "info" }
    ),

  server: (statusCode: number) =>
    createError(
      "server",
      `Server error: ${statusCode}`,
      statusCode === 500
        ? "Server error. We're investigating. Please try again later."
        : `Server error (${statusCode}). Please try again.`,
      { severity: "error", retryable: statusCode !== 500 }
    ),

  unknown: (message: string) =>
    createError("unknown", message, "Something unexpected happened. Please try again.", {
      severity: "error",
    }),
};

// ============================================================
// 3. ERROR CONTEXT & PROVIDER
// ============================================================

export const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export const useErrorState = (): ErrorContextType => {
  const [errors, setErrors] = useState<AppError[]>([]);
  const timeoutIdsRef = useRef<Map<string, number>>(new Map());

  const removeError = (id: string) => {
    const timeoutId = timeoutIdsRef.current.get(id);
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      timeoutIdsRef.current.delete(id);
    }

    setErrors((prev) => prev.filter((error) => error.id !== id));
  };

  const addError = (error: AppError) => {
    setErrors((prev) => [...prev, error]);

    if (error.severity !== "critical") {
      const timeoutId = window.setTimeout(() => {
        removeError(error.id);
      }, 6000);

      timeoutIdsRef.current.set(error.id, timeoutId);
    }
  };

  const clearErrors = () => {
    timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutIdsRef.current.clear();
    setErrors([]);
  };

  useEffect(() => () => {
    timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutIdsRef.current.clear();
  }, []);

  return { errors, addError, removeError, clearErrors };
};

export const useError = () => {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error("useError must be used within ErrorProvider");
  }

  return context;
};

// ============================================================
// 4. ASYNC ERROR HANDLING
// ============================================================

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getErrorLike = (value: unknown): ErrorLike => {
  if (!isObject(value)) {
    return {};
  }

  const response = isObject(value.response) ? value.response : undefined;
  const config = isObject(value.config) ? value.config : undefined;

  return {
    message: typeof value.message === "string" ? value.message : undefined,
    response: response
      ? { status: typeof response.status === "number" ? response.status : undefined }
      : undefined,
    config: config ? { url: typeof config.url === "string" ? config.url : undefined } : undefined,
  };
};

const isNetworkFetchFailure = (message: string) => {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("failed to fetch") ||
    normalizedMessage.includes("fetch failed") ||
    normalizedMessage.includes("failed to send a request to the edge function") ||
    normalizedMessage.includes("edge function unavailable") ||
    normalizedMessage.includes("edge function is not available") ||
    normalizedMessage.includes("networkerror") ||
    normalizedMessage.includes("supabase.co")
  );
};

export const getFriendlyErrorMessage = (value: unknown, fallbackMessage = "Please try again."): string => {
  const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;

  if (value instanceof Error) {
    if (isOffline || isNetworkFetchFailure(value.message)) {
      return "You're offline right now. Check your connection and try again.";
    }

    if (isNetworkFetchFailure(value.message)) {
      return "We couldn't reach the service right now. Please try again in a moment.";
    }

    return value.message;
  }

  const errorLike = getErrorLike(value);
  if (errorLike.message) {
    if (isOffline || isNetworkFetchFailure(errorLike.message)) {
      return "You're offline right now. Check your connection and try again.";
    }

    if (isNetworkFetchFailure(errorLike.message)) {
      return "We couldn't reach the service right now. Please try again in a moment.";
    }

    return errorLike.message;
  }

  return fallbackMessage;
};

export const handleAsyncError = async <T,>(
  fn: () => Promise<T>,
  options: {
    onError?: (error: AppError) => void;
    errorContext?: ErrorContextData;
  } = {}
): Promise<T | null> => {
  try {
    return await fn();
  } catch (error: unknown) {
    const errorLike = getErrorLike(error);
    let appError: AppError;

    if (errorLike.response?.status === 401) {
      appError = ErrorFactory.auth("Token expired");
    } else if (errorLike.response?.status === 403) {
      appError = ErrorFactory.permission("Resource");
    } else if (errorLike.response?.status === 404) {
      appError = ErrorFactory.notFound("Resource");
    } else if ((errorLike.response?.status ?? 0) >= 500) {
      appError = ErrorFactory.server(errorLike.response?.status ?? 500);
    } else if (errorLike.message?.includes("Network")) {
      appError = ErrorFactory.network(errorLike.config?.url || "unknown");
    } else {
      appError = ErrorFactory.unknown(getFriendlyErrorMessage(error));
    }

    appError.context = options.errorContext;

    if (options.onError) {
      options.onError(appError);
    } else {
      console.error(appError);
    }

    return null;
  }
};

// ============================================================
// 5. FORM VALIDATION ERROR HANDLING
// ============================================================

export interface FormFieldError {
  field: string;
  message: string;
}

export const validateFormField = <T,>(
  value: T,
  rules: ValidationRule<T>[]
): string | null => {
  for (const rule of rules) {
    if (!rule.validate(value)) {
      return rule.message;
    }
  }

  return null;
};

export const createFormValidator = (schema: FormValidationSchema) => {
  return (formData: FormDataShape): Record<string, string> => {
    const errors: Record<string, string> = {};

    for (const [field, rules] of Object.entries(schema)) {
      const error = validateFormField(formData[field], rules);
      if (error) {
        errors[field] = error;
      }
    }

    return errors;
  };
};

export const ValidationRules = {
  required: (): ValidationRule<unknown> => ({
    validate: (value) => value !== "" && value !== null && value !== undefined,
    message: "This field is required",
  }),

  trimmedRequired: (): ValidationRule<string> => ({
    validate: (value) => value.trim().length > 0,
    message: "This field is required",
  }),

  minLength: (length: number): ValidationRule<string> => ({
    validate: (value) => value.length >= length,
    message: `Minimum ${length} characters required`,
  }),

  maxLength: (length: number): ValidationRule<string> => ({
    validate: (value) => value.length <= length,
    message: `Maximum ${length} characters allowed`,
  }),

  email: (): ValidationRule<string> => ({
    validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message: "Please enter a valid email address",
  }),

  phone: (): ValidationRule<string> => ({
    validate: (value) => isValidPhoneNumber(value),
    message: "Please enter a valid phone number",
  }),

  optional: <T,>(rule: ValidationRule<T>): ValidationRule<T | "" | null | undefined> => ({
    validate: (value) => value === "" || value === null || value === undefined || rule.validate(value as T),
    message: rule.message,
  }),

  currency: (minAmount: number = 0, maxAmount?: number): ValidationRule<number> => ({
    validate: (value) => {
      if (value < minAmount) {
        return false;
      }
      if (maxAmount !== undefined && value > maxAmount) {
        return false;
      }
      return true;
    },
    message:
      maxAmount !== undefined
        ? `Amount must be between NGN ${minAmount} and NGN ${maxAmount}`
        : `Amount must be at least NGN ${minAmount}`,
  }),

  minNumber: (minimum: number, message = `Value must be at least ${minimum}`): ValidationRule<number> => ({
    validate: (value) => Number(value) >= minimum,
    message,
  }),

  accountNumber: (): ValidationRule<string> => ({
    validate: (value) => /^\d{10,12}$/.test(value),
    message: "Account number must be 10-12 digits",
  }),
};

// ============================================================
// 6. RETRY MECHANISM
// ============================================================

export const retryWithExponentialBackoff = async <T,>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 1000
): Promise<T> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(getFriendlyErrorMessage(error));

      if (attempt < maxRetries) {
        const delayMs = initialDelayMs * Math.pow(2, attempt);
        console.warn(
          `Attempt ${attempt + 1} failed. Retrying in ${delayMs}ms...`,
          lastError.message
        );
        await new Promise((resolve) => window.setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError || new Error("Max retries exceeded");
};

// ============================================================
// 7. REQUEST QUEUE FOR OFFLINE SUPPORT
// ============================================================

export class RequestQueue {
  private queue: QueuedRequest[] = [];
  private isProcessing = false;

  add(request: Omit<QueuedRequest, "id" | "timestamp" | "retries">) {
    const queued: QueuedRequest = {
      ...request,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      retries: 0,
    };

    this.queue.push(queued);
    void this.processQueue();
    return queued;
  }

  private async processQueue() {
    if (this.isProcessing || !navigator.onLine) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const request = this.queue[0];

      try {
        const response = await fetch(request.url, {
          method: request.method,
          headers: { "Content-Type": "application/json" },
          body: request.data !== undefined ? JSON.stringify(request.data) : undefined,
        });

        if (response.ok) {
          this.queue.shift();
        } else {
          request.retries += 1;
          if (request.retries > 3) {
            this.queue.shift();
            console.error("Request failed after retries:", request);
          }
        }
      } catch {
        request.retries += 1;
        if (request.retries > 3) {
          this.queue.shift();
        }
        break;
      }
    }

    this.isProcessing = false;
  }

  getQueue() {
    return [...this.queue];
  }

  clearQueue() {
    this.queue = [];
  }
}

export const requestQueue = new RequestQueue();

// ============================================================
// 8. MONITORING & LOGGING (Sentry Setup)
// ============================================================

let errorMonitoringInitialized = false;

export const initializeErrorMonitoring = () => {
  if (errorMonitoringInitialized) {
    return;
  }

  errorMonitoringInitialized = true;

  window.addEventListener("unhandledrejection", (event) => {
    const reason = isObject(event.reason) && typeof event.reason.message === "string"
      ? event.reason.message
      : "Unhandled rejection";
    const error = ErrorFactory.unknown(reason);
    console.error("Unhandled rejection:", error);
    captureMonitoringException(event.reason, {
      source: "unhandledrejection",
    });
  });

  window.addEventListener("error", (event) => {
    captureMonitoringException(event.error ?? event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      source: "window.error",
    });
  });
};
