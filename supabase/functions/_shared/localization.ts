export type SupportedLanguage = "en" | "fr";
export type SupportedLocale = "en-NG" | "en-US" | "fr-FR";

type TranslationParams = Record<string, string | number>;
type TranslationTree = Record<string, string | TranslationTree>;

const translations: Record<SupportedLanguage, TranslationTree> = {
  en: {
    email: {
      digest: {
        greeting: "Hello {{name}},",
        headingPreview: "{{businessName}} activity digest",
        headingWeekly: "{{businessName}} weekly activity digest",
        introPreview: "Here is a recent summary of activity from your moniger.net workspace.",
        introWeekly: "Here is your scheduled weekly digest from moniger.net.",
        manageSettings: "Manage notification settings",
        noRecent: "No new activity landed in your workspace feed recently.",
        noWeekly: "No new activity landed in your workspace feed this week.",
        subjectPreview: "{{businessName}} activity digest for {{date}}",
        subjectWeekly: "{{businessName}} weekly activity digest for {{date}}",
      },
      invite: {
        actionGranted: "Open moniger.net",
        actionPending: "Accept invitation",
        footer: "If you did not expect this access change, contact your workspace administrator.",
        greeting: "Hello {{email}},",
        headingGranted: "Workspace access granted",
        headingPending: "Finish joining your workspace",
        instructionsGranted: "You can sign in to moniger.net to access the workspace immediately.",
        instructionsPending:
          "Open the invitation link below, then sign in or create your moniger.net account with this same email address to accept the workspace invite.",
        invitedAs: "{{inviterName}} invited you to {{businessName}} as {{roleLabel}}.",
        subjectGranted: "You have been invited to {{businessName}} on moniger.net",
        subjectPending: "Complete your invitation to {{businessName}} on moniger.net",
      },
      invoice: {
        due: "Due",
        greeting: "Hello {{name}},",
        heading: "Invoice {{invoiceNumber}}",
        invoice: "Invoice",
        issued: "Issued",
        openApp: "Open moniger.net",
        total: "Total",
      },
    },
  },
  fr: {
    email: {
      digest: {
        greeting: "Bonjour {{name}},",
        headingPreview: "Digest d'activite de {{businessName}}",
        headingWeekly: "Digest hebdomadaire d'activite de {{businessName}}",
        introPreview: "Voici un resume recent de l'activite de votre espace de travail moniger.net.",
        introWeekly: "Voici votre digest hebdomadaire planifie depuis moniger.net.",
        manageSettings: "Gerer les parametres de notification",
        noRecent: "Aucune nouvelle activite recente n'a ete enregistree dans votre espace de travail.",
        noWeekly: "Aucune nouvelle activite n'a ete enregistree dans votre espace de travail cette semaine.",
        subjectPreview: "Digest d'activite de {{businessName}} pour le {{date}}",
        subjectWeekly: "Digest hebdomadaire de {{businessName}} pour le {{date}}",
      },
      invite: {
        actionGranted: "Ouvrir moniger.net",
        actionPending: "Accepter l'invitation",
        footer: "Si vous ne vous attendiez pas a ce changement d'acces, contactez l'administrateur de votre espace de travail.",
        greeting: "Bonjour {{email}},",
        headingGranted: "Acces a l'espace de travail accorde",
        headingPending: "Finalisez votre adhesion a l'espace de travail",
        instructionsGranted: "Vous pouvez vous connecter a moniger.net pour acceder immediatement a l'espace de travail.",
        instructionsPending:
          "Ouvrez le lien d'invitation ci-dessous, puis connectez-vous ou creez votre compte moniger.net avec cette meme adresse e-mail pour accepter l'invitation.",
        invitedAs: "{{inviterName}} vous a invite a rejoindre {{businessName}} en tant que {{roleLabel}}.",
        subjectGranted: "Vous avez ete invite a rejoindre {{businessName}} sur moniger.net",
        subjectPending: "Finalisez votre invitation a {{businessName}} sur moniger.net",
      },
      invoice: {
        due: "Echeance",
        greeting: "Bonjour {{name}},",
        heading: "Facture {{invoiceNumber}}",
        invoice: "Facture",
        issued: "Date d'emission",
        openApp: "Ouvrir moniger.net",
        total: "Total",
      },
    },
  },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const resolveTranslationNode = (language: SupportedLanguage, key: string): string | undefined => {
  const parts = key.split(".");
  let current: unknown = translations[language];

  for (const part of parts) {
    if (!isRecord(current) || !(part in current)) {
      return undefined;
    }

    current = current[part];
  }

  return typeof current === "string" ? current : undefined;
};

const interpolate = (template: string, params?: TranslationParams) => {
  if (!params) {
    return template;
  }

  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = params[key];
    return value === undefined || value === null ? "" : String(value);
  });
};

export const normalizeTemplateLanguage = (value: string | null | undefined): SupportedLanguage =>
  value?.toLowerCase().startsWith("fr") ? "fr" : "en";

export const normalizeTemplateLocale = (value: string | null | undefined): SupportedLocale => {
  if (value === "en-US" || value === "fr-FR" || value === "en-NG") {
    return value;
  }

  return value?.toLowerCase().startsWith("fr") ? "fr-FR" : "en-NG";
};

export const translateTemplate = (language: string | null | undefined, key: string, params?: TranslationParams) => {
  const normalizedLanguage = normalizeTemplateLanguage(language);
  const message = resolveTranslationNode(normalizedLanguage, key) ?? resolveTranslationNode("en", key) ?? key;
  return interpolate(message, params);
};

export const formatTemplateDate = (value: string | number | Date, locale: string | null | undefined) => {
  const normalizedLocale = normalizeTemplateLocale(locale);
  const normalizedDate = value instanceof Date ? value : new Date(value);

  try {
    return new Intl.DateTimeFormat(normalizedLocale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(normalizedDate);
  } catch {
    return normalizedDate.toISOString();
  }
};

export const formatTemplateCurrency = (
  amount: number | string,
  currency: string,
  locale: string | null | undefined,
) => {
  const normalizedLocale = normalizeTemplateLocale(locale);
  const normalizedAmount = typeof amount === "number" ? amount : Number(amount);

  try {
    return new Intl.NumberFormat(normalizedLocale, {
      currency,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
      style: "currency",
    }).format(Number.isFinite(normalizedAmount) ? normalizedAmount : 0);
  } catch {
    return `${currency} ${Number.isFinite(normalizedAmount) ? normalizedAmount.toFixed(2) : "0.00"}`;
  }
};
