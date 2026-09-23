const cdnBase = "https://cdn.jsdelivr.net/gh/Nigerian-Bank-Logos/ng-bank-logos@main/logos/ngn/svg";

const bankLogoPaths: Record<string, string> = {
  "ab microfinance bank": "microfinance-banks/AB%20MFB.svg",
  "access bank": "commercial-banks/Access%20Bank%20Nigeria.svg",
  "accion microfinance bank": "microfinance-banks/Accion%20MFB.svg",
  "alat by wema": "mobile-money/ALAT%20by%20WEMA.svg",
  "citibank nigeria": "commercial-banks/Citibank.svg",
  "coronation merchant bank": "merchant-banks/Coronation%20Merchant%20Bank.svg",
  "ecobank nigeria": "commercial-banks/Ecobank.svg",
  "fbn microfinance": "commercial-banks/First%20Bank%20of%20Nigeria.svg",
  "fidelity bank": "commercial-banks/Fidelity%20Bank.svg",
  "first bank of nigeria": "commercial-banks/First%20Bank%20of%20Nigeria.svg",
  "first city monument bank (fcmb)": "commercial-banks/First%20City%20Monument%20Bank.svg",
  "fortis microfinance bank": "microfinance-banks/Fortis%20Microfinance%20Bank.svg",
  "globus bank": "commercial-banks/Globus%20Bank.svg",
  "gtbank microfinance": "commercial-banks/GTBank%20Plc.svg",
  "guaranty trust bank (gtbank)": "commercial-banks/GTBank%20Plc.svg",
  "heritage bank": "commercial-banks/Heritage%20Bank.svg",
  "jaiz bank": "commercial-banks/Jaiz%20Bank.svg",
  "keystone bank": "commercial-banks/Keystone%20Bank.svg",
  "kuda bank": "microfinance-banks/Kuda.svg",
  "lapo microfinance bank": "microfinance-banks/Lapo%20Microfinance%20Bank.svg",
  "lotus bank": "commercial-banks/Lotus%20Bank.svg",
  "mainstreet microfinance bank": "microfinance-banks/Mainstreet%20Microfinance%20Bank.svg",
  "opay": "mobile-money/OPay%20Digital%20Services%20Limited.svg",
  "polaris bank": "commercial-banks/Polaris%20Bank.svg",
  "providus bank": "commercial-banks/Providus%20Bank.svg",
  "rand merchant bank (nigeria)": "merchant-banks/Rand%20Merchant%20Bank.svg",
  "rubies microfinance bank": "microfinance-banks/Rubies%20MFB.svg",
  "stanbic ibtc bank": "commercial-banks/Stanbic%20IBTC%20Bank.svg",
  "standard chartered bank": "commercial-banks/Standard%20Chartered%20Bank.svg",
  "sterling bank": "commercial-banks/Sterling%20Bank.svg",
  "titan trust bank": "commercial-banks/Titan%20Trust%20Bank.svg",
  "united bank for africa (uba)": "commercial-banks/United%20Bank%20for%20Africa.svg",
  "union bank of nigeria": "commercial-banks/Union%20Bank.svg",
  "unity bank": "commercial-banks/Unity%20Bank.svg",
  "vfd microfinance bank": "microfinance-banks/VFD%20Microfinance%20Bank%20Limited.svg",
  "wema bank": "commercial-banks/Wema%20Bank.svg",
  "zenith bank": "commercial-banks/Zenith%20Bank%20Plc.svg",
};

const normalizeBankName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

export const getBankLogoUrl = (name: string) => {
  const path = bankLogoPaths[normalizeBankName(name)];
  return path ? `${cdnBase}/${path}` : null;
};
