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
      ai_usage: {
        Row: {
          calls: number
          day: string
          idea_calls: number
          updated_at: string
          user_id: string
        }
        Insert: {
          calls?: number
          day: string
          idea_calls?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          calls?: number
          day?: string
          idea_calls?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          created_at: string
          doctor: string
          id: string
          is_demo: boolean
          location: string | null
          notes: string | null
          purpose: string | null
          questions: string[]
          starts_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          doctor: string
          id?: string
          is_demo?: boolean
          location?: string | null
          notes?: string | null
          purpose?: string | null
          questions?: string[]
          starts_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          doctor?: string
          id?: string
          is_demo?: boolean
          location?: string | null
          notes?: string | null
          purpose?: string | null
          questions?: string[]
          starts_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
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
      caregiver_access_log: {
        Row: {
          caregiver_id: string
          categories: string[]
          created_at: string
          grant_id: string | null
          id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          caregiver_id: string
          categories?: string[]
          created_at?: string
          grant_id?: string | null
          id?: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          caregiver_id?: string
          categories?: string[]
          created_at?: string
          grant_id?: string | null
          id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "caregiver_access_log_grant_id_fkey"
            columns: ["grant_id"]
            isOneToOne: false
            referencedRelation: "caregiver_grants"
            referencedColumns: ["id"]
          },
        ]
      }
      caregiver_grants: {
        Row: {
          accepted_at: string | null
          alerts_enabled: boolean
          can_adherence: boolean
          can_appointments: boolean
          can_missed_alerts: boolean
          caregiver_id: string | null
          created_at: string
          id: string
          invite_expires_at: string | null
          invite_hash: string | null
          is_demo: boolean
          label: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          alerts_enabled?: boolean
          can_adherence?: boolean
          can_appointments?: boolean
          can_missed_alerts?: boolean
          caregiver_id?: string | null
          created_at?: string
          id?: string
          invite_expires_at?: string | null
          invite_hash?: string | null
          is_demo?: boolean
          label: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          alerts_enabled?: boolean
          can_adherence?: boolean
          can_appointments?: boolean
          can_missed_alerts?: boolean
          caregiver_id?: string | null
          created_at?: string
          id?: string
          invite_expires_at?: string | null
          invite_hash?: string | null
          is_demo?: boolean
          label?: string
          status?: string
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
      doctor_plan_diet: {
        Row: {
          created_at: string
          diet_rules: string | null
          foods_to_avoid: string | null
          id: string
          special_instructions: string | null
          user_id: string
          version_id: string
        }
        Insert: {
          created_at?: string
          diet_rules?: string | null
          foods_to_avoid?: string | null
          id?: string
          special_instructions?: string | null
          user_id: string
          version_id: string
        }
        Update: {
          created_at?: string
          diet_rules?: string | null
          foods_to_avoid?: string | null
          id?: string
          special_instructions?: string | null
          user_id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_plan_diet_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: true
            referencedRelation: "doctor_plan_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_plan_limits: {
        Row: {
          created_at: string
          id: string
          max_value: number | null
          metric: string
          min_value: number | null
          set_by: string | null
          set_on: string | null
          user_id: string
          version_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_value?: number | null
          metric: string
          min_value?: number | null
          set_by?: string | null
          set_on?: string | null
          user_id: string
          version_id: string
        }
        Update: {
          created_at?: string
          id?: string
          max_value?: number | null
          metric?: string
          min_value?: number | null
          set_by?: string | null
          set_on?: string | null
          user_id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_plan_limits_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "doctor_plan_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_plan_medicines: {
        Row: {
          confirmed: boolean
          confirmed_on: string | null
          created_at: string
          date_advised: string | null
          doctor_name: string | null
          dose: string | null
          id: string
          interval_text: string | null
          max_per_day: string | null
          name: string
          position: number
          user_id: string
          version_id: string
        }
        Insert: {
          confirmed?: boolean
          confirmed_on?: string | null
          created_at?: string
          date_advised?: string | null
          doctor_name?: string | null
          dose?: string | null
          id?: string
          interval_text?: string | null
          max_per_day?: string | null
          name: string
          position?: number
          user_id: string
          version_id: string
        }
        Update: {
          confirmed?: boolean
          confirmed_on?: string | null
          created_at?: string
          date_advised?: string | null
          doctor_name?: string | null
          dose?: string | null
          id?: string
          interval_text?: string | null
          max_per_day?: string | null
          name?: string
          position?: number
          user_id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_plan_medicines_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "doctor_plan_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_plan_versions: {
        Row: {
          attachment_name: string | null
          attachment_path: string | null
          attachment_type: string | null
          created_at: string
          id: string
          is_demo: boolean
          user_id: string
          version_no: number
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_type?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          user_id: string
          version_no: number
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          attachment_type?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          user_id?: string
          version_no?: number
        }
        Relationships: []
      }
      doctor_summaries: {
        Row: {
          created_at: string
          id: string
          kind: string
          questions: string[]
          range_from: string
          range_to: string
          sections: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          questions?: string[]
          range_from: string
          range_to: string
          sections?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          questions?: string[]
          range_from?: string
          range_to?: string
          sections?: string[]
          user_id?: string
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
          stock_deducted: number
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
          stock_deducted?: number
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
          stock_deducted?: number
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
      emergency_card_tokens: {
        Row: {
          created_at: string
          id: string
          revoked_at: string | null
          token_hash: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          revoked_at?: string | null
          token_hash: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          revoked_at?: string | null
          token_hash?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      emergency_directory: {
        Row: {
          created_at: string
          id: string
          key: string
          label: string
          number: string
          sort: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          label: string
          number: string
          sort?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          label?: string
          number?: string
          sort?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      hydration_logs: {
        Row: {
          created_at: string
          day: string
          goal_glasses: number | null
          id: string
          is_demo: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day: string
          goal_glasses?: number | null
          id?: string
          is_demo?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string
          goal_glasses?: number | null
          id?: string
          is_demo?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meals: {
        Row: {
          ai_note: string | null
          ai_note_status: string
          created_at: string
          deleted_at: string | null
          description: string
          eaten_at: string
          id: string
          is_demo: boolean
          meal_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_note?: string | null
          ai_note_status?: string
          created_at?: string
          deleted_at?: string | null
          description: string
          eaten_at?: string
          id?: string
          is_demo?: boolean
          meal_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_note?: string | null
          ai_note_status?: string
          created_at?: string
          deleted_at?: string | null
          description?: string
          eaten_at?: string
          id?: string
          is_demo?: boolean
          meal_type?: string
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
          missed_dose_instruction: string | null
          name: string
          notes: string | null
          prescribed_by: string | null
          start_date: string
          stock_set_at: string | null
          strength: string | null
          tablets_per_dose: number
          tablets_remaining: number | null
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
          missed_dose_instruction?: string | null
          name: string
          notes?: string | null
          prescribed_by?: string | null
          start_date?: string
          stock_set_at?: string | null
          strength?: string | null
          tablets_per_dose?: number
          tablets_remaining?: number | null
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
          missed_dose_instruction?: string | null
          name?: string
          notes?: string | null
          prescribed_by?: string | null
          start_date?: string
          stock_set_at?: string | null
          strength?: string | null
          tablets_per_dose?: number
          tablets_remaining?: number | null
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
          card_prefs: Json
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
          card_prefs?: Json
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
          card_prefs?: Json
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
      share_link_views: {
        Row: {
          id: string
          link_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          link_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          link_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_link_views_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "share_links"
            referencedColumns: ["id"]
          },
        ]
      }
      share_links: {
        Row: {
          created_at: string
          expires_at: string
          first_viewed_at: string | null
          id: string
          last_viewed_at: string | null
          questions: string[]
          range_from: string
          range_to: string
          revoked_at: string | null
          sections: string[]
          token_hash: string
          updated_at: string
          user_id: string
          view_count: number
        }
        Insert: {
          created_at?: string
          expires_at: string
          first_viewed_at?: string | null
          id?: string
          last_viewed_at?: string | null
          questions?: string[]
          range_from: string
          range_to: string
          revoked_at?: string | null
          sections?: string[]
          token_hash: string
          updated_at?: string
          user_id: string
          view_count?: number
        }
        Update: {
          created_at?: string
          expires_at?: string
          first_viewed_at?: string | null
          id?: string
          last_viewed_at?: string | null
          questions?: string[]
          range_from?: string
          range_to?: string
          revoked_at?: string | null
          sections?: string[]
          token_hash?: string
          updated_at?: string
          user_id?: string
          view_count?: number
        }
        Relationships: []
      }
      sick_day_sessions: {
        Row: {
          checkins: Json
          created_at: string
          ended_at: string | null
          id: string
          is_demo: boolean
          started_at: string
          unwell_session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          checkins?: Json
          created_at?: string
          ended_at?: string | null
          id?: string
          is_demo?: boolean
          started_at?: string
          unwell_session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          checkins?: Json
          created_at?: string
          ended_at?: string | null
          id?: string
          is_demo?: boolean
          started_at?: string
          unwell_session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sick_day_sessions_unwell_session_id_fkey"
            columns: ["unwell_session_id"]
            isOneToOne: false
            referencedRelation: "unwell_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sleep_logs: {
        Row: {
          created_at: string
          hours: number
          id: string
          is_demo: boolean
          night: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hours: number
          id?: string
          is_demo?: boolean
          night: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hours?: number
          id?: string
          is_demo?: boolean
          night?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      symptom_entries: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_demo: boolean
          notes: string | null
          occurred_at: string
          result: string | null
          session_id: string | null
          severity: number | null
          source: string
          symptoms: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_demo?: boolean
          notes?: string | null
          occurred_at?: string
          result?: string | null
          session_id?: string | null
          severity?: number | null
          source?: string
          symptoms?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_demo?: boolean
          notes?: string | null
          occurred_at?: string
          result?: string | null
          session_id?: string | null
          severity?: number | null
          source?: string
          symptoms?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "symptom_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "unwell_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      unwell_sessions: {
        Row: {
          answers: Json
          created_at: string
          id: string
          is_demo: boolean
          reasons: string[]
          result: string
          user_id: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          id?: string
          is_demo?: boolean
          reasons?: string[]
          result: string
          user_id: string
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          is_demo?: boolean
          reasons?: string[]
          result?: string
          user_id?: string
        }
        Relationships: []
      }
      vitals: {
        Row: {
          created_at: string
          id: string
          is_demo: boolean
          kind: string
          measured_at: string
          source: string
          unit: string
          updated_at: string
          user_id: string
          value: number
          value2: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_demo?: boolean
          kind: string
          measured_at?: string
          source?: string
          unit: string
          updated_at?: string
          user_id: string
          value: number
          value2?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          is_demo?: boolean
          kind?: string
          measured_at?: string
          source?: string
          unit?: string
          updated_at?: string
          user_id?: string
          value?: number
          value2?: number | null
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
      accept_caregiver_invite: { Args: { _token: string }; Returns: string }
      claim_ai_call: { Args: { _cap: number }; Returns: boolean }
      claim_meal_idea_call: { Args: { _cap: number }; Returns: boolean }
      generate_doses: {
        Args: { _days?: number; _user: string }
        Returns: number
      }
      generate_my_doses: { Args: never; Returns: number }
      get_caregiver_dashboard: { Args: { _grant: string }; Returns: Json }
      get_emergency_card: { Args: { _token: string }; Returns: Json }
      has_consent: { Args: { _uid: string }; Returns: boolean }
      leave_caregiver_grant: { Args: { _grant: string }; Returns: boolean }
      open_share_link: { Args: { _token: string }; Returns: Json }
      save_doctor_plan: { Args: { p: Json }; Returns: string }
      set_caregiver_alerts: {
        Args: { _grant: string; _on: boolean }
        Returns: boolean
      }
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
