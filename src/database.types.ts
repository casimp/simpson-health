// Types for the Supabase database, in the shape `supabase gen types typescript` produces.
// Written to match supabase/schema.sql; regenerate with `npm run types` after changing the schema.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      members: {
        Row: { id: string; full_name: string; short_name: string; colour: string; user_id: string | null; created_at: string };
        Insert: { id?: string; full_name: string; short_name: string; colour?: string; user_id?: string | null; created_at?: string };
        Update: { id?: string; full_name?: string; short_name?: string; colour?: string; user_id?: string | null; created_at?: string };
        Relationships: [];
      };
      family: {
        Row: { id: boolean; join_code: string };
        Insert: { id?: boolean; join_code: string };
        Update: { id?: boolean; join_code?: string };
        Relationships: [];
      };
      results: {
        Row: {
          id: number; member_id: string; test: string; taken_at: string; value: number;
          ref_low: number; ref_high: number; note: string | null; created_by: string | null; created_at: string;
        };
        Insert: {
          id?: never; member_id: string; test: string; taken_at: string; value: number;
          ref_low: number; ref_high: number; note?: string | null; created_by?: string | null; created_at?: string;
        };
        Update: {
          id?: never; member_id?: string; test?: string; taken_at?: string; value?: number;
          ref_low?: number; ref_high?: number; note?: string | null; created_by?: string | null; created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "results_member_id_fkey"; columns: ["member_id"]; isOneToOne: false; referencedRelation: "members"; referencedColumns: ["id"] },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      my_member_id: { Args: never; Returns: string };
      join_options: { Args: { p_code: string }; Returns: { id: string; full_name: string; taken: boolean }[] };
      join_family: {
        Args: { p_code: string; p_member_id?: string; p_full_name?: string; p_short_name?: string };
        Returns: string;
      };
      new_join_code: { Args: never; Returns: string };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
