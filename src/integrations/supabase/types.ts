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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      consents: {
        Row: {
          accepted_at: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          version: string
        }
        Update: {
          accepted_at?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      dose_logs: {
        Row: {
          created_at: string
          id: string
          is_demo: boolean
          logged_at: string | null
          medicine_id: string
          scheduled_at: string
          snoozed_until: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_demo?: boolean
          logged_at?: string | null
          medicine_id: string
          scheduled_at: string
          snoozed_until?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_demo?: boolean
          logged_at?: string | null
          medicine_id?: string
          scheduled_at?: string
          snoozed_until?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dose_logs_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_contacts: {
        Row: {
          created_at: string
          id: string
          is_demo: boolean
          name: string
          phone: string
          relationship: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_demo?: boolean
          name: string
          phone: string
          relationship?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_demo?: boolean
          name?: string
          phone?: string
          relationship?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      medicines: {
        Row: {
          archived_at: string | null
          created_at: string
          dose_amount: string | null
          end_date: string | null
          food: string
          form: string | null
          generic_name: string | null
          id: string
          is_demo: boolean
          name: string
          notes: string | null
          prescribed_by: string | null
          start_date: string
          strength: string | null
          times: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          dose_amount?: string | null
          end_date?: string | null
          food?: string
          form?: string | null
          generic_name?: string | null
          id?: string
          is_demo?: boolean
          name: string
          notes?: string | null
          prescribed_by?: string | null
          start_date?: string
          strength?: string | null
          times?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          dose_amount?: string | null
          end_date?: string | null
          food?: string
          form?: string | null
          generic_name?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          notes?: string | null
          prescribed_by?: string | null
          start_date?: string
          strength?: string | null
          times?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age_group: string | null
          allergies: string | null
          conditions: string | null
          created_at: string
          diet: string | null
          doctor_name: string | null
          doctor_phone: string | null
          full_name: string | null
          is_demo: boolean
          onboarding_done: boolean
          onboarding_step: number
          pharmacist_name: string | null
          pharmacist_phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          age_group?: string | null
          allergies?: string | null
          conditions?: string | null
          created_at?: string
          diet?: string | null
          doctor_name?: string | null
          doctor_phone?: string | null
          full_name?: string | null
          is_demo?: boolean
          onboarding_done?: boolean
          onboarding_step?: number
          pharmacist_name?: string | null
          pharmacist_phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          age_group?: string | null
          allergies?: string | null
          conditions?: string | null
          created_at?: string
          diet?: string | null
          doctor_name?: string | null
          doctor_phone?: string | null
          full_name?: string | null
          is_demo?: boolean
          onboarding_done?: boolean
          onboarding_step?: number
          pharmacist_name?: string | null
          pharmacist_phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reminder_log: {
        Row: {
          created_at: string
          dedupe_key: string
          detail: string | null
          dose_id: string | null
          id: string
          kind: string
          scheduled_for: string | null
          sent_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dedupe_key: string
          detail?: string | null
          dose_id?: string | null
          id?: string
          kind: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dedupe_key?: string
          detail?: string | null
          dose_id?: string | null
          id?: string
          kind?: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_log_dose_id_fkey"
            columns: ["dose_id"]
            isOneToOne: false
            referencedRelation: "dose_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_settings: {
        Row: {
          created_at: string
          enabled: boolean
          last_test_received_at: string | null
          last_test_sent_at: string | null
          quiet_end: string | null
          quiet_start: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          last_test_received_at?: string | null
          last_test_sent_at?: string | null
          quiet_end?: string | null
          quiet_start?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          last_test_received_at?: string | null
          last_test_sent_at?: string | null
          quiet_end?: string | null
          quiet_start?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      water_logs: {
        Row: {
          created_at: string
          id: string
          is_demo: boolean
          logged_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_demo?: boolean
          logged_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_demo?: boolean
          logged_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_doses: {
        Args: { _days?: number; _user: string }
        Returns: number
      }
      generate_my_doses: { Args: never; Returns: number }
      has_consent: { Args: { _uid: string }; Returns: boolean }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
