
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "draw_cards": {
                  Row: {
                    "card_no": number,"game_id": string,"role_id": string,"shown_role_id": string
                  }
                  Insert: {
                    "card_no": number,"game_id": string,"role_id": string,"shown_role_id": string
                  }
                  Update: {
                    "card_no"?: number,"game_id"?: string,"role_id"?: string,"shown_role_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "draw_cards_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    }
                  ]
                },"draw_slots": {
                  Row: {
                    "card_no": number,"game_id": string,"taken_by_seat": number | null
                  }
                  Insert: {
                    "card_no": number,"game_id": string,"taken_by_seat"?: number | null
                  }
                  Update: {
                    "card_no"?: number,"game_id"?: string,"taken_by_seat"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "draw_slots_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    }
                  ]
                },"game_composition": {
                  Row: {
                    "game_id": string,"role_id": string,"shown_role_id": string
                  }
                  Insert: {
                    "game_id": string,"role_id": string,"shown_role_id": string
                  }
                  Update: {
                    "game_id"?: string,"role_id"?: string,"shown_role_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "game_composition_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "game_composition_game_id_role_id_fkey"
      columns: ["game_id","role_id"]
isOneToOne: true
      referencedRelation: "game_roles"
      referencedColumns: ["game_id","role_id"]
    },{
      foreignKeyName: "game_composition_game_id_shown_role_id_fkey"
      columns: ["game_id","shown_role_id"]
isOneToOne: false
      referencedRelation: "game_roles"
      referencedColumns: ["game_id","role_id"]
    }
                  ]
                },"game_roles": {
                  Row: {
                    "ability": string,"game_id": string,"glyph": string,"name": string,"reminders": (string)[],"role_id": string,"team": Database["public"]['Enums']["team"]
                  }
                  Insert: {
                    "ability": string,"game_id": string,"glyph": string,"name": string,"reminders"?: (string)[],"role_id": string,"team": Database["public"]['Enums']["team"]
                  }
                  Update: {
                    "ability"?: string,"game_id"?: string,"glyph"?: string,"name"?: string,"reminders"?: (string)[],"role_id"?: string,"team"?: Database["public"]['Enums']["team"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "game_roles_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    }
                  ]
                },"game_seats": {
                  Row: {
                    "alive": boolean,"game_id": string,"seat": number,"user_id": string | null
                  }
                  Insert: {
                    "alive"?: boolean,"game_id": string,"seat": number,"user_id"?: string | null
                  }
                  Update: {
                    "alive"?: boolean,"game_id"?: string,"seat"?: number,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "game_seats_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "game_seats_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"games": {
                  Row: {
                    "assignment_mode": Database["public"]['Enums']["assignment_mode"] | null,"created_at": string,"dm_id": string | null,"ended_at": string | null,"id": string,"phase_kind": string | null,"phase_number": number | null,"room_id": string,"script_id": string | null,"seat_count": number | null,"started_at": string | null,"status": Database["public"]['Enums']["game_status"]
                  }
                  Insert: {
                    "assignment_mode"?: Database["public"]['Enums']["assignment_mode"] | null,"created_at"?: string,"dm_id"?: string | null,"ended_at"?: string | null,"id"?: string,"phase_kind"?: string | null,"phase_number"?: number | null,"room_id": string,"script_id"?: string | null,"seat_count"?: number | null,"started_at"?: string | null,"status"?: Database["public"]['Enums']["game_status"]
                  }
                  Update: {
                    "assignment_mode"?: Database["public"]['Enums']["assignment_mode"] | null,"created_at"?: string,"dm_id"?: string | null,"ended_at"?: string | null,"id"?: string,"phase_kind"?: string | null,"phase_number"?: number | null,"room_id"?: string,"script_id"?: string | null,"seat_count"?: number | null,"started_at"?: string | null,"status"?: Database["public"]['Enums']["game_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "games_dm_id_fkey"
      columns: ["dm_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "games_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "rooms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "games_script_id_fkey"
      columns: ["script_id"]
isOneToOne: false
      referencedRelation: "scripts"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"id": string,"is_guest": boolean,"nickname": string | null,"permission": Database["public"]['Enums']["permission_level"]
                  }
                  Insert: {
                    "created_at"?: string,"id": string,"is_guest"?: boolean,"nickname"?: string | null,"permission"?: Database["public"]['Enums']["permission_level"]
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_guest"?: boolean,"nickname"?: string | null,"permission"?: Database["public"]['Enums']["permission_level"]
                  }
                  Relationships: [
                    
                  ]
                },"roles": {
                  Row: {
                    "ability": string,"created_at": string,"created_by": string | null,"edition": string | null,"glyph": string | null,"id": string,"is_official": boolean,"name": string,"reminders": (string)[],"team": Database["public"]['Enums']["team"]
                  }
                  Insert: {
                    "ability": string,"created_at"?: string,"created_by"?: string | null,"edition"?: string | null,"glyph"?: string | null,"id": string,"is_official"?: boolean,"name": string,"reminders"?: (string)[],"team": Database["public"]['Enums']["team"]
                  }
                  Update: {
                    "ability"?: string,"created_at"?: string,"created_by"?: string | null,"edition"?: string | null,"glyph"?: string | null,"id"?: string,"is_official"?: boolean,"name"?: string,"reminders"?: (string)[],"team"?: Database["public"]['Enums']["team"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "roles_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"room_members": {
                  Row: {
                    "joined_at": string,"room_id": string,"seat": number | null,"user_id": string
                  }
                  Insert: {
                    "joined_at"?: string,"room_id": string,"seat"?: number | null,"user_id": string
                  }
                  Update: {
                    "joined_at"?: string,"room_id"?: string,"seat"?: number | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "room_members_room_id_fkey"
      columns: ["room_id"]
isOneToOne: false
      referencedRelation: "rooms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "room_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"rooms": {
                  Row: {
                    "closed_at": string | null,"code": string,"created_at": string,"created_by": string | null,"dm_id": string | null,"id": string,"last_activity_at": string,"seat_count": number,"status": string
                  }
                  Insert: {
                    "closed_at"?: string | null,"code": string,"created_at"?: string,"created_by"?: string | null,"dm_id"?: string | null,"id"?: string,"last_activity_at"?: string,"seat_count"?: number,"status"?: string
                  }
                  Update: {
                    "closed_at"?: string | null,"code"?: string,"created_at"?: string,"created_by"?: string | null,"dm_id"?: string | null,"id"?: string,"last_activity_at"?: string,"seat_count"?: number,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rooms_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rooms_dm_id_fkey"
      columns: ["dm_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"script_roles": {
                  Row: {
                    "position": number,"role_id": string,"script_id": string
                  }
                  Insert: {
                    "position": number,"role_id": string,"script_id": string
                  }
                  Update: {
                    "position"?: number,"role_id"?: string,"script_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "script_roles_role_id_fkey"
      columns: ["role_id"]
isOneToOne: false
      referencedRelation: "roles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "script_roles_script_id_fkey"
      columns: ["script_id"]
isOneToOne: false
      referencedRelation: "scripts"
      referencedColumns: ["id"]
    }
                  ]
                },"scripts": {
                  Row: {
                    "author": string | null,"created_at": string,"created_by": string | null,"id": string,"name": string,"updated_at": string
                  }
                  Insert: {
                    "author"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "author"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "scripts_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"seat_roles": {
                  Row: {
                    "actual_role_id": string,"alignment": Database["public"]['Enums']["alignment"],"game_id": string,"seat": number,"shown_role_id": string
                  }
                  Insert: {
                    "actual_role_id": string,"alignment": Database["public"]['Enums']["alignment"],"game_id": string,"seat": number,"shown_role_id": string
                  }
                  Update: {
                    "actual_role_id"?: string,"alignment"?: Database["public"]['Enums']["alignment"],"game_id"?: string,"seat"?: number,"shown_role_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "seat_roles_game_id_actual_role_id_fkey"
      columns: ["game_id","actual_role_id"]
isOneToOne: true
      referencedRelation: "game_roles"
      referencedColumns: ["game_id","role_id"]
    },{
      foreignKeyName: "seat_roles_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seat_roles_game_id_shown_role_id_fkey"
      columns: ["game_id","shown_role_id"]
isOneToOne: false
      referencedRelation: "game_roles"
      referencedColumns: ["game_id","role_id"]
    }
                  ]
                },"seat_shown_roles": {
                  Row: {
                    "game_id": string,"seat": number,"shown_role_id": string,"user_id": string
                  }
                  Insert: {
                    "game_id": string,"seat": number,"shown_role_id": string,"user_id": string
                  }
                  Update: {
                    "game_id"?: string,"seat"?: number,"shown_role_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "seat_shown_roles_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seat_shown_roles_game_id_shown_role_id_fkey"
      columns: ["game_id","shown_role_id"]
isOneToOne: false
      referencedRelation: "game_roles"
      referencedColumns: ["game_id","role_id"]
    },{
      foreignKeyName: "seat_shown_roles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_assign_dm":
{ Args: { "p_room": string,"p_user": string }; Returns: undefined
                           },
"assign_seat":
{ Args: { "p_game": string,"p_role": string,"p_seat": number }; Returns: undefined
                           },
"cancel_setup":
{ Args: { "p_game": string }; Returns: undefined
                           },
"close_room":
{ Args: { "p_room": string }; Returns: undefined
                           },
"create_custom_role":
{ Args: { "p_ability": string,"p_glyph"?: string,"p_name": string,"p_reminders"?: (string)[],"p_team": Database["public"]['Enums']["team"] }; Returns: string
                           },
"create_room":
{ Args: { "p_seat_count"?: number }; Returns: string
                           },
"dm_kick":
{ Args: { "p_room": string,"p_user": string }; Returns: undefined
                           },
"dm_move_player":
{ Args: { "p_room": string,"p_seat": number,"p_user": string }; Returns: undefined
                           },
"dm_unseat":
{ Args: { "p_room": string,"p_user": string }; Returns: undefined
                           },
"draw_card":
{ Args: { "p_card": number,"p_game": string }; Returns: undefined
                           },
"join_room":
{ Args: { "p_code": string }; Returns: string
                           },
"leave_dm_seat":
{ Args: { "p_room": string }; Returns: undefined
                           },
"leave_room":
{ Args: { "p_room": string }; Returns: undefined
                           },
"leave_seat":
{ Args: { "p_room": string }; Returns: undefined
                           },
"save_script":
{ Args: { "p_author": string,"p_name": string,"p_roles": (string)[],"p_script": string }; Returns: string
                           },
"set_composition":
{ Args: { "p_game": string,"p_roles": Json }; Returns: undefined
                           },
"set_nickname":
{ Args: { "p_nickname": string }; Returns: undefined
                           },
"set_permission":
{ Args: { "p_level": Database["public"]['Enums']["permission_level"],"p_user": string }; Returns: undefined
                           },
"set_seat_count":
{ Args: { "p_count": number,"p_room": string }; Returns: undefined
                           },
"shuffle_cards":
{ Args: { "p_game": string }; Returns: undefined
                           },
"start_game":
{ Args: { "p_game": string }; Returns: undefined
                           },
"start_setup":
{ Args: { "p_mode": Database["public"]['Enums']["assignment_mode"],"p_room": string,"p_script": string }; Returns: string
                           },
"take_dm_seat":
{ Args: { "p_room": string }; Returns: undefined
                           },
"take_seat":
{ Args: { "p_room": string,"p_seat": number }; Returns: undefined
                           },
"unassign_seat":
{ Args: { "p_game": string,"p_seat": number }; Returns: undefined
                           }
          }
          Enums: {
            "alignment": "good"|"evil","assignment_mode": "manual"|"draw","game_status": "setup"|"in_progress"|"ended","permission_level": "player"|"dm_eligible"|"admin","team": "townsfolk"|"outsider"|"minion"|"demon"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "alignment": ["good", "evil"],"assignment_mode": ["manual", "draw"],"game_status": ["setup", "in_progress", "ended"],"permission_level": ["player", "dm_eligible", "admin"],"team": ["townsfolk", "outsider", "minion", "demon"]
          }
        }
} as const

