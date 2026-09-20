import { useQuery } from "@tanstack/react-query";
import { mergeSubscriptionCatalog, type SubscriptionCatalog } from "@/lib/subscriptions";
import { supabase } from "@/lib/supabase";

type PublicSiteConfigResponse = {
  billingCatalog?: unknown;
  billing_catalog?: unknown;
};

const fetchPublicPricingCatalog = async (): Promise<SubscriptionCatalog> => {
  const { data, error } = await supabase.functions.invoke("public-site-config");

  if (error) {
    throw error;
  }

  const payload = (data ?? {}) as PublicSiteConfigResponse;
  const catalogValue = payload.billingCatalog ?? payload.billing_catalog;

  return mergeSubscriptionCatalog(catalogValue);
};

export const usePublicPricingCatalog = () =>
  useQuery({
    queryFn: fetchPublicPricingCatalog,
    queryKey: ["public-site-config", "billing-catalog"],
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    initialData: mergeSubscriptionCatalog(null),
    retry: 1,
  });

