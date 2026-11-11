import logoIndex from "@/data/nigerian-bank-logo-index.json";

const normalizeBankName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const fallbackLogo = "https://cdn.jsdelivr.net/gh/Nigerian-Bank-Logos/ng-bank-logos@c843d5f6b3ca87d94d17807baf1b92e9398a61a5/logos/_default.svg";

export const getBankLogoUrl = (name: string, bankCode?: string | null) =>
  logoIndex.names[normalizeBankName(name) as keyof typeof logoIndex.names] ??
  (bankCode ? logoIndex.codes[bankCode as keyof typeof logoIndex.codes] : undefined) ??
  fallbackLogo;
