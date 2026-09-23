import { toast } from "@/hooks/use-toast";

export const showDemoToast = () => {
  toast({
    title: "Coming soon",
    description: "This action is not available yet. Contact moniger.net support at admin@moniger.net for access updates.",
    duration: 4000,
  });
};
