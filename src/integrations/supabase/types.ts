export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ayamakna_action_edges: {
        Row: {
          action_root: string
          actor_type: string
          english_meaning: string | null
          id: string
          polarity: string
          root_frequency: number | null
          semantic_cluster: string | null
          target_type: string | null
          tense: string
          verb_text: string
          verse_id: string
        }
        Insert: {
          action_root: string
          actor_type: string
          english_meaning?: string | null
          id: string
          polarity: string
          root_frequency?: number | null
          semantic_cluster?: string | null
          target_type?: string | null
          tense: string
          verb_text: string
          verse_id: string
        }
        Update: {
          action_root?: string
          actor_type?: string
          english_meaning?: string | null
          id?: string
          polarity?: string
          root_frequency?: number | null
          semantic_cluster?: string | null
          target_type?: string | null
          tense?: string
          verb_text?: string
          verse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ayamakna_action_edges_verse_id_fkey"
            columns: ["verse_id"]
            isOneToOne: false
            referencedRelation: "ayamakna_verses"
            referencedColumns: ["id"]
          },
        ]
      }
      ayamakna_action_families: {
        Row: {
          color_hue: number
          display_order: number
          id: string
          name: string
          name_id: string | null
        }
        Insert: {
          color_hue: number
          display_order: number
          id: string
          name: string
          name_id?: string | null
        }
        Update: {
          color_hue?: number
          display_order?: number
          id?: string
          name?: string
          name_id?: string | null
        }
        Relationships: []
      }
      ayamakna_action_verse_links: {
        Row: {
          id: number
          primary_action_family: string | null
          shared_actions_count: number
          similarity_score: number
          verse_a_id: string
          verse_b_id: string
        }
        Insert: {
          id?: number
          primary_action_family?: string | null
          shared_actions_count?: number
          similarity_score: number
          verse_a_id: string
          verse_b_id: string
        }
        Update: {
          id?: number
          primary_action_family?: string | null
          shared_actions_count?: number
          similarity_score?: number
          verse_a_id?: string
          verse_b_id?: string
        }
        Relationships: []
      }
      ayamakna_concept_domains: {
        Row: {
          color_hue: number
          description: string | null
          display_order: number
          id: string
          name: string
          name_id: string | null
        }
        Insert: {
          color_hue?: number
          description?: string | null
          display_order?: number
          id: string
          name: string
          name_id?: string | null
        }
        Update: {
          color_hue?: number
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          name_id?: string | null
        }
        Relationships: []
      }
      ayamakna_concept_graph_edges: {
        Row: {
          concept_a: string
          concept_b: string
          shared_verse_count: number
          strength: number
        }
        Insert: {
          concept_a: string
          concept_b: string
          shared_verse_count?: number
          strength?: number
        }
        Update: {
          concept_a?: string
          concept_b?: string
          shared_verse_count?: number
          strength?: number
        }
        Relationships: [
          {
            foreignKeyName: "ayamakna_concept_graph_edges_concept_a_fkey"
            columns: ["concept_a"]
            isOneToOne: false
            referencedRelation: "ayamakna_concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ayamakna_concept_graph_edges_concept_b_fkey"
            columns: ["concept_b"]
            isOneToOne: false
            referencedRelation: "ayamakna_concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      ayamakna_concept_verse_links: {
        Row: {
          domain_id: string | null
          id: number
          primary_concept_id: string | null
          shared_concepts_count: number
          similarity_score: number
          verse_a_id: string
          verse_b_id: string
        }
        Insert: {
          domain_id?: string | null
          id?: number
          primary_concept_id?: string | null
          shared_concepts_count?: number
          similarity_score?: number
          verse_a_id: string
          verse_b_id: string
        }
        Update: {
          domain_id?: string | null
          id?: number
          primary_concept_id?: string | null
          shared_concepts_count?: number
          similarity_score?: number
          verse_a_id?: string
          verse_b_id?: string
        }
        Relationships: []
      }
      ayamakna_concepts: {
        Row: {
          description: string
          domain_id: string | null
          domain_order: number | null
          id: string
          name: string
          name_ar: string | null
        }
        Insert: {
          description: string
          domain_id?: string | null
          domain_order?: number | null
          id: string
          name: string
          name_ar?: string | null
        }
        Update: {
          description?: string
          domain_id?: string | null
          domain_order?: number | null
          id?: string
          name?: string
          name_ar?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ayamakna_concepts_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "ayamakna_concept_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      ayamakna_contrast_verse_links: {
        Row: {
          category: string
          contrast_strength: number
          id: number
          pair_id: string
          verse_a_id: string
          verse_b_id: string
        }
        Insert: {
          category: string
          contrast_strength?: number
          id?: number
          pair_id: string
          verse_a_id: string
          verse_b_id: string
        }
        Update: {
          category?: string
          contrast_strength?: number
          id?: number
          pair_id?: string
          verse_a_id?: string
          verse_b_id?: string
        }
        Relationships: []
      }
      ayamakna_root_concepts: {
        Row: {
          concept_id: string
          root: string
          verse_count: number
          weight: number
        }
        Insert: {
          concept_id: string
          root: string
          verse_count?: number
          weight?: number
        }
        Update: {
          concept_id?: string
          root?: string
          verse_count?: number
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "ayamakna_root_concepts_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "ayamakna_concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      ayamakna_root_lookups: {
        Row: {
          root: string
          word: string
        }
        Insert: {
          root: string
          word: string
        }
        Update: {
          root?: string
          word?: string
        }
        Relationships: []
      }
      ayamakna_root_translations: {
        Row: {
          root: string
          translation: string
        }
        Insert: {
          root: string
          translation: string
        }
        Update: {
          root?: string
          translation?: string
        }
        Relationships: []
      }
      ayamakna_root_verse_links: {
        Row: {
          hop_count: number
          id: number
          semantic_cluster: string
          shared_roots_count: number
          similarity_score: number
          verse_a_id: string
          verse_b_id: string
        }
        Insert: {
          hop_count?: number
          id?: number
          semantic_cluster: string
          shared_roots_count: number
          similarity_score: number
          verse_a_id: string
          verse_b_id: string
        }
        Update: {
          hop_count?: number
          id?: number
          semantic_cluster?: string
          shared_roots_count?: number
          similarity_score?: number
          verse_a_id?: string
          verse_b_id?: string
        }
        Relationships: []
      }
      ayamakna_stats: {
        Row: {
          id: string
          visitor_count: number
        }
        Insert: {
          id?: string
          visitor_count?: number
        }
        Update: {
          id?: string
          visitor_count?: number
        }
        Relationships: []
      }
      ayamakna_surahs: {
        Row: {
          name: string
          name_ar: string
          number: number
          total_ayah: number
        }
        Insert: {
          name: string
          name_ar: string
          number: number
          total_ayah: number
        }
        Update: {
          name?: string
          name_ar?: string
          number?: number
          total_ayah?: number
        }
        Relationships: []
      }
      ayamakna_verse_concepts: {
        Row: {
          concept_id: string
          id: number
          verse_id: string
          weight: number
        }
        Insert: {
          concept_id: string
          id?: number
          verse_id: string
          weight?: number
        }
        Update: {
          concept_id?: string
          id?: number
          verse_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "ayamakna_verse_concepts_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "ayamakna_concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ayamakna_verse_concepts_verse_id_fkey"
            columns: ["verse_id"]
            isOneToOne: false
            referencedRelation: "ayamakna_verses"
            referencedColumns: ["id"]
          },
        ]
      }
      ayamakna_verse_tokens: {
        Row: {
          id: string
          lemma: string
          pos: string | null
          position: number
          root: string | null
          surface: string
          verse_id: string
        }
        Insert: {
          id: string
          lemma: string
          pos?: string | null
          position: number
          root?: string | null
          surface: string
          verse_id: string
        }
        Update: {
          id?: string
          lemma?: string
          pos?: string | null
          position?: number
          root?: string | null
          surface?: string
          verse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ayamakna_verse_tokens_verse_id_fkey"
            columns: ["verse_id"]
            isOneToOne: false
            referencedRelation: "ayamakna_verses"
            referencedColumns: ["id"]
          },
        ]
      }
      ayamakna_verses: {
        Row: {
          ayah_number: number
          id: string
          surah_id: number
          text_arabic: string
          text_translation: string
          text_translation_id: string | null
        }
        Insert: {
          ayah_number: number
          id: string
          surah_id: number
          text_arabic: string
          text_translation: string
          text_translation_id?: string | null
        }
        Update: {
          ayah_number?: number
          id?: string
          surah_id?: number
          text_arabic?: string
          text_translation?: string
          text_translation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ayamakna_verses_surah_id_fkey"
            columns: ["surah_id"]
            isOneToOne: false
            referencedRelation: "ayamakna_surahs"
            referencedColumns: ["number"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_visitor_count: { Args: never; Returns: number }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
