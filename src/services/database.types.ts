
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "games": {
                  Row: {
                    "created_at": string,"dm_id": string | null,"ended_at": string | null,"id": string,"room_id": string,"status": Database["public"]['Enums']["game_status"]
                  }
                  Insert: {
                    "created_at"?: string,"dm_id"?: string | null,"ended_at"?: string | null,"id"?: string,"room_id": string,"status"?: Database["public"]['Enums']["game_status"]
                  }
                  Update: {
                    "created_at"?: string,"dm_id"?: string | null,"ended_at"?: string | null,"id"?: string,"room_id"?: string,"status"?: Database["public"]['Enums']["game_status"]
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
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_assign_dm":
{ Args: { "p_room": string,"p_user": string }; Returns: undefined
                           },
"close_room":
{ Args: { "p_room": string }; Returns: undefined
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
"set_nickname":
{ Args: { "p_nickname": string }; Returns: undefined
                           },
"set_permission":
{ Args: { "p_level": Database["public"]['Enums']["permission_level"],"p_user": string }; Returns: undefined
                           },
"set_seat_count":
{ Args: { "p_count": number,"p_room": string }; Returns: undefined
                           },
"take_dm_seat":
{ Args: { "p_room": string }; Returns: undefined
                           },
"take_seat":
{ Args: { "p_room": string,"p_seat": number }; Returns: undefined
                           }
          }
          Enums: {
            "game_status": "setup"|"in_progress"|"ended","permission_level": "player"|"dm_eligible"|"admin"
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
            "game_status": ["setup", "in_progress", "ended"],"permission_level": ["player", "dm_eligible", "admin"]
          }
        }
} as const

