import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BankOptionLogo } from "@/components/app/BankOptionLogo";
import displayAliases from "@/data/paystack-bank-display-aliases.json";
import { cn } from "@/lib/utils";

export type BankDirectoryOption = {
  bank_code: string | null;
  id: string;
  is_active: boolean;
  name: string;
};

type BankDirectorySelectProps = {
  allowClear?: boolean;
  banks: BankDirectoryOption[];
  disabled?: boolean;
  id?: string;
  onValueChange: (value: string) => void;
  payoutOnly?: boolean;
  placeholder?: string;
  value: string;
};

export const BankDirectorySelect = ({
  allowClear = false,
  banks,
  disabled = false,
  id,
  onValueChange,
  payoutOnly = false,
  placeholder = "Choose a bank",
  value,
}: BankDirectorySelectProps) => {
  const [open, setOpen] = useState(false);
  const activeBanks = useMemo(() => banks.filter((bank) => bank.is_active), [banks]);
  const selectedBank = activeBanks.find((bank) => bank.id === value);
  const unavailablePayoutCount = activeBanks.filter((bank) => !bank.bank_code?.trim()).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          id={id}
          disabled={disabled}
          className="h-12 w-full justify-between rounded-md px-3 font-normal"
        >
          {selectedBank ? (
            <span className="flex min-w-0 items-center gap-2">
              <BankOptionLogo name={selectedBank.name} bankCode={selectedBank.bank_code} />
              <span className="truncate">{selectedBank.name}</span>
            </span>
          ) : <span className="truncate text-muted-foreground">{placeholder}</span>}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder="Search banks…" />
          <CommandList
            className="max-h-[min(65vh,32rem)] min-h-0 overflow-y-scroll overscroll-y-contain [scrollbar-gutter:stable] [touch-action:pan-y] [-webkit-overflow-scrolling:touch]"
            onWheelCapture={(event) => event.stopPropagation()}
          >
            <CommandEmpty>No banks match your search.</CommandEmpty>
            <CommandGroup>
              {allowClear ? (
                <CommandItem value="no bank selected" onSelect={() => { onValueChange(""); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", value ? "opacity-0" : "opacity-100")} />
                  No bank selected
                </CommandItem>
              ) : null}
              {activeBanks.map((bank) => {
                const unavailable = payoutOnly && !bank.bank_code?.trim();
                const aliases = bank.bank_code
                  ? displayAliases[bank.bank_code as keyof typeof displayAliases] ?? []
                  : [];
                return (
                  <div key={bank.id}>
                    <CommandItem
                      value={`${bank.name} ${bank.bank_code ?? ""}`}
                      disabled={unavailable}
                      onSelect={() => { onValueChange(bank.id); setOpen(false); }}
                      className="min-h-12 gap-3 py-2"
                    >
                      <Check className={cn("h-4 w-4 shrink-0", value === bank.id ? "opacity-100" : "opacity-0")} />
                      <BankOptionLogo name={bank.name} bankCode={bank.bank_code} />
                      <span className="min-w-0 flex-1 truncate">{bank.name}</span>
                      {unavailable ? <span className="text-[10px] text-muted-foreground">Unavailable for payouts</span> : null}
                    </CommandItem>
                    {aliases.map((alias) => (
                      <CommandItem
                        key={`${bank.id}-${alias}`}
                        value={`${alias} ${bank.bank_code ?? ""}`}
                        disabled={unavailable}
                        onSelect={() => { onValueChange(bank.id); setOpen(false); }}
                        className="min-h-12 gap-3 py-2 pl-10"
                      >
                        <BankOptionLogo name={alias} bankCode={bank.bank_code} />
                        <span className="min-w-0 flex-1 truncate">{alias}</span>
                        <span className="text-[10px] text-muted-foreground">Same provider code</span>
                      </CommandItem>
                    ))}
                  </div>
                );
              })}
            </CommandGroup>
          </CommandList>
          {payoutOnly && unavailablePayoutCount > 0 ? (
            <p className="border-t px-3 py-2 text-xs text-muted-foreground">
              {unavailablePayoutCount} bank{unavailablePayoutCount === 1 ? " is" : "s are"} missing verified payout codes and can’t be selected.
            </p>
          ) : null}
        </Command>
      </PopoverContent>
    </Popover>
  );
};
