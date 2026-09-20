import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type PublicHelpArticle = {
  body: string;
  category: string | null;
  excerpt: string | null;
  id: string;
  slug: string;
  title: string;
};

export type PublicChangelogEntry = {
  body: string;
  changes: Array<{ text?: string; type?: string }>;
  id: string;
  release_date: string | null;
  related_help_slugs: string[];
  tag: string | null;
  title: string;
  version: string | null;
};

const fetchPublicContent = async <T>(contentType: "help_article" | "changelog"): Promise<T[]> => {
  const { data, error } = await supabase.functions.invoke<{ items?: T[] }>("public-content", { body: { contentType } });
  if (error) throw error;
  return data?.items ?? [];
};

export const usePublicHelpArticles = () => useQuery({
  queryKey: ["public-content", "help_article"],
  queryFn: () => fetchPublicContent<PublicHelpArticle>("help_article"),
  staleTime: 5 * 60_000,
  initialData: [],
  retry: 1,
});

export const usePublicChangelog = () => useQuery({
  queryKey: ["public-content", "changelog"],
  queryFn: () => fetchPublicContent<PublicChangelogEntry>("changelog"),
  staleTime: 5 * 60_000,
  initialData: [],
  retry: 1,
});
