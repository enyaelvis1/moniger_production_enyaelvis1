import { supabase as rawSupabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database as GeneratedDatabase } from "@/integrations/supabase/types";

type NormalizeTableLike<TTableLike> = TTableLike extends {
  Row: infer Row;
  Insert: infer Insert;
  Update: infer Update;
  Relationships?: infer Relationships;
}
  ? {
      Row: Row;
      Insert: Insert;
      Update: Update;
      Relationships: Relationships extends unknown[] ? Relationships : [];
    }
  : TTableLike extends {
        Row: infer Row;
        Relationships?: infer Relationships;
      }
    ? {
        Row: Row;
        Relationships: Relationships extends unknown[] ? Relationships : [];
      }
    : TTableLike;

type NormalizeSchema<TSchema> = TSchema extends {
  Tables: infer Tables;
  Views: infer Views;
  Functions: infer Functions;
  Enums: infer Enums;
  CompositeTypes: infer CompositeTypes;
}
  ? {
      Tables: {
        [TableName in keyof Tables]: NormalizeTableLike<Tables[TableName]>;
      };
      Views: {
        [ViewName in keyof Views]: NormalizeTableLike<Views[ViewName]>;
      };
      Functions: Functions;
      Enums: Enums;
      CompositeTypes: CompositeTypes;
    }
  : TSchema;

type Database = {
  __InternalSupabase: GeneratedDatabase["__InternalSupabase"];
} & {
  [SchemaName in Exclude<keyof GeneratedDatabase, "__InternalSupabase">]: NormalizeSchema<
    GeneratedDatabase[SchemaName]
  >;
};

export const supabase = rawSupabase as unknown as SupabaseClient<Database>;
