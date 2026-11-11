import { useState } from "react";
import { Landmark } from "lucide-react";
import { getBankLogoUrl } from "@/lib/bank-logos";
import { cn } from "@/lib/utils";

type BankOptionLogoProps = {
  bankCode?: string | null;
  className?: string;
  name: string;
};

export const BankOptionLogo = ({ bankCode, className, name }: BankOptionLogoProps) => {
  const [failed, setFailed] = useState(false);
  const logoUrl = getBankLogoUrl(name, bankCode);

  return (
    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-white p-0.5", className)} aria-hidden="true">
      {failed ? (
        <Landmark className="h-4 w-4 text-muted-foreground" />
      ) : (
        <img src={logoUrl} alt="" className="h-full w-full object-contain" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      )}
    </span>
  );
};
