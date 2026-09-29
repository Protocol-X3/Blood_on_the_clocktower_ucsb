
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "board_posts": {
                  Row: {
                    "author_id": string | null,"body": string,"created_at": string,"game_id": string,"id": string,"is_dm": boolean,"phase_kind": string,"phase_number": number,"seat": number | null
                  }
                  Insert: {
                    "author_id"?: string | null,"body": string,"created_at"?: string,"game_id": string,"id"?: string,"is_dm"?: boolean,"phase_kind": string,"phase_number": number,"seat"?: number | null
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string,"created_at"?: string,"game_id"?: string,"id"?: string,"is_dm"?: boolean,"phase_kind"?: string,"phase_number"?: number,"seat"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "board_posts_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "board_posts_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    }
                  ]
                },"day_results": {
                  Row: {
                    "created_at": string,"day_number": number,"executed_seat": number | null,"game_id": string
                  }
                  Insert: {
                    "created_at"?: string,"day_number": number,"executed_seat"?: number | null,"game_id": string
                  }
                  Update: {
                    "created_at"?: string,"day_number"?: number,"executed_seat"?: number | null,"game_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "day_results_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    }
                  ]
                },"dm_log_cells": {
                  Row: {
                    "body": string | null,"column_kind": string,"game_id": string,"id": string,"mark": Database["public"]['Enums']["log_mark"] | null,"note_id": string | null,"phase_number": number | null,"seat": number | null,"updated_at": string
                  }
                  Insert: {
                    "body"?: string | null,"column_kind": string,"game_id": string,"id"?: string,"mark"?: Database["public"]['Enums']["log_mark"] | null,"note_id"?: string | null,"phase_number"?: number | null,"seat"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "body"?: string | null,"column_kind"?: string,"game_id"?: string,"id"?: string,"mark"?: Database["public"]['Enums']["log_mark"] | null,"note_id"?: string | null,"phase_number"?: number | null,"seat"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "dm_log_cells_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    },
                    {
      foreignKeyName: "dm_log_cells_note_id_fkey"
      columns: ["note_id"]
isOneToOne: false
      referencedRelation: "dm_log_notes"
      referencedColumns: ["id"]
    },
                  ]
                },"dm_log_notes": {
                  Row: {
                    "created_at": string,"game_id": string,"id": string,"label": string,"position": number
                  }
                  Insert: {
                    "created_at"?: string,"game_id": string,"id"?: string,"label"?: string,"position": number
                  }
                  Update: {
                    "created_at"?: string,"game_id"?: string,"id"?: string,"label"?: string,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "dm_log_notes_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    },
                  ]
                },"dm_log_row_marks": {
                  Row: {
                    "game_id": string,"mark": Database["public"]['Enums']["log_mark"],"seat": number
                  }
                  Insert: {
                    "game_id": string,"mark": Database["public"]['Enums']["log_mark"],"seat": number
                  }
                  Update: {
                    "game_id"?: string,"mark"?: Database["public"]['Enums']["log_mark"],"seat"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "dm_log_row_marks_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    },
                  ]
                },"draw_cards": {
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
                },"game_deaths": {
                  Row: {
                    "cause": Database["public"]['Enums']["death_cause"],"created_at": string,"game_id": string,"id": number,"note": string | null,"phase_kind": string,"phase_number": number,"revived": boolean,"seat": number
                  }
                  Insert: {
                    "cause": Database["public"]['Enums']["death_cause"],"created_at"?: string,"game_id": string,"id"?: never,"note"?: string | null,"phase_kind": string,"phase_number": number,"revived"?: boolean,"seat": number
                  }
                  Update: {
                    "cause"?: Database["public"]['Enums']["death_cause"],"created_at"?: string,"game_id"?: string,"id"?: never,"note"?: string | null,"phase_kind"?: string,"phase_number"?: number,"revived"?: boolean,"seat"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "game_deaths_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
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
                    "alive": boolean,"death_cause": Database["public"]['Enums']["death_cause"] | null,"death_note": string | null,"game_id": string,"ghost_vote_used": boolean,"seat": number,"user_id": string | null
                  }
                  Insert: {
                    "alive"?: boolean,"death_cause"?: Database["public"]['Enums']["death_cause"] | null,"death_note"?: string | null,"game_id": string,"ghost_vote_used"?: boolean,"seat": number,"user_id"?: string | null
                  }
                  Update: {
                    "alive"?: boolean,"death_cause"?: Database["public"]['Enums']["death_cause"] | null,"death_note"?: string | null,"game_id"?: string,"ghost_vote_used"?: boolean,"seat"?: number,"user_id"?: string | null
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
                    "assignment_mode": Database["public"]['Enums']["assignment_mode"] | null,"created_at": string,"dm_id": string | null,"ended_at": string | null,"id": string,"phase_kind": string | null,"phase_number": number | null,"room_id": string,"script_id": string | null,"seat_count": number | null,"started_at": string | null,"status": Database["public"]['Enums']["game_status"],"vote_speed_ms": number,"winner": Database["public"]['Enums']["alignment"] | null
                  }
                  Insert: {
                    "assignment_mode"?: Database["public"]['Enums']["assignment_mode"] | null,"created_at"?: string,"dm_id"?: string | null,"ended_at"?: string | null,"id"?: string,"phase_kind"?: string | null,"phase_number"?: number | null,"room_id": string,"script_id"?: string | null,"seat_count"?: number | null,"started_at"?: string | null,"status"?: Database["public"]['Enums']["game_status"],"vote_speed_ms"?: number,"winner"?: Database["public"]['Enums']["alignment"] | null
                  }
                  Update: {
                    "assignment_mode"?: Database["public"]['Enums']["assignment_mode"] | null,"created_at"?: string,"dm_id"?: string | null,"ended_at"?: string | null,"id"?: string,"phase_kind"?: string | null,"phase_number"?: number | null,"room_id"?: string,"script_id"?: string | null,"seat_count"?: number | null,"started_at"?: string | null,"status"?: Database["public"]['Enums']["game_status"],"vote_speed_ms"?: number,"winner"?: Database["public"]['Enums']["alignment"] | null
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
                },"grimoire_tokens": {
                  Row: {
                    "created_at": string,"game_id": string,"id": string,"kind": Database["public"]['Enums']["token_kind"],"label": string,"seat": number
                  }
                  Insert: {
                    "created_at"?: string,"game_id": string,"id"?: string,"kind": Database["public"]['Enums']["token_kind"],"label": string,"seat": number
                  }
                  Update: {
                    "created_at"?: string,"game_id"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["token_kind"],"label"?: string,"seat"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "grimoire_tokens_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    }
                  ]
                },"nominations": {
                  Row: {
                    "closed_at": string | null,"created_at": string,"day_number": number,"game_id": string,"hand_index": number,"id": string,"nominator_seat": number,"nominee_seat": number,"paused": boolean,"status": Database["public"]['Enums']["nomination_status"],"threshold": number | null,"vote_count": number | null
                  }
                  Insert: {
                    "closed_at"?: string | null,"created_at"?: string,"day_number": number,"game_id": string,"hand_index"?: number,"id"?: string,"nominator_seat": number,"nominee_seat": number,"paused"?: boolean,"status"?: Database["public"]['Enums']["nomination_status"],"threshold"?: number | null,"vote_count"?: number | null
                  }
                  Update: {
                    "closed_at"?: string | null,"created_at"?: string,"day_number"?: number,"game_id"?: string,"hand_index"?: number,"id"?: string,"nominator_seat"?: number,"nominee_seat"?: number,"paused"?: boolean,"status"?: Database["public"]['Enums']["nomination_status"],"threshold"?: number | null,"vote_count"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "nominations_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"id": string,"is_bot": boolean,"is_guest": boolean,"nickname": string | null,"permission": Database["public"]['Enums']["permission_level"]
                  }
                  Insert: {
                    "created_at"?: string,"id": string,"is_bot"?: boolean,"is_guest"?: boolean,"nickname"?: string | null,"permission"?: Database["public"]['Enums']["permission_level"]
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_bot"?: boolean,"is_guest"?: boolean,"nickname"?: string | null,"permission"?: Database["public"]['Enums']["permission_level"]
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
                    "actual_role_id": string,"alignment": Database["public"]['Enums']["alignment"],"game_id": string,"seat": number,"shown_role_id": string,"starting_role_id": string | null
                  }
                  Insert: {
                    "actual_role_id": string,"alignment": Database["public"]['Enums']["alignment"],"game_id": string,"seat": number,"shown_role_id": string,"starting_role_id"?: string | null
                  }
                  Update: {
                    "actual_role_id"?: string,"alignment"?: Database["public"]['Enums']["alignment"],"game_id"?: string,"seat"?: number,"shown_role_id"?: string,"starting_role_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "seat_roles_game_id_actual_role_id_fkey"
      columns: ["game_id","actual_role_id"]
isOneToOne: false
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
                },"votes": {
                  Row: {
                    "game_id": string,"ghost_spent": boolean,"locked": boolean,"nomination_id": string,"raised": boolean,"seat": number
                  }
                  Insert: {
                    "game_id": string,"ghost_spent"?: boolean,"locked"?: boolean,"nomination_id": string,"raised"?: boolean,"seat": number
                  }
                  Update: {
                    "game_id"?: string,"ghost_spent"?: boolean,"locked"?: boolean,"nomination_id"?: string,"raised"?: boolean,"seat"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "votes_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "votes_nomination_id_fkey"
      columns: ["nomination_id"]
isOneToOne: false
      referencedRelation: "nominations"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "add_log_note":
{ Args: { "p_game": string,"p_label": string }; Returns: string
                           },
"add_token":
{ Args: { "p_game": string,"p_kind": Database["public"]['Enums']["token_kind"],"p_seat": number,"p_text"?: string }; Returns: string
                           },
"admin_assign_dm":
{ Args: { "p_room": string,"p_user": string }; Returns: undefined
                           },
"admin_delete_user":
{ Args: { "p_user": string }; Returns: undefined
                           },
"advance_phase":
{ Args: { "p_game": string }; Returns: undefined
                           },
"advance_vote":
{ Args: { "p_expected": number,"p_nomination": string }; Returns: number
                           },
"assign_seat":
{ Args: { "p_game": string,"p_role": string,"p_seat": number }; Returns: undefined
                           },
"cancel_nomination":
{ Args: { "p_nomination": string }; Returns: undefined
                           },
"bot_sandbox_enabled":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"cancel_setup":
{ Args: { "p_game": string }; Returns: undefined
                           },
"close_room":
{ Args: { "p_room": string }; Returns: undefined
                           },
"close_vote":
{ Args: { "p_nomination": string }; Returns: undefined
                           },
"conclude_day":
{ Args: { "p_execute": boolean,"p_game": string }; Returns: number
                           },
"correct_vote":
{ Args: { "p_nomination": string,"p_raised": boolean,"p_seat": number }; Returns: undefined
                           },
"create_custom_role":
{ Args: { "p_ability": string,"p_glyph"?: string,"p_name": string,"p_reminders"?: (string)[],"p_team": Database["public"]['Enums']["team"] }; Returns: string
                           },
"create_room":
{ Args: { "p_seat_count"?: number }; Returns: string
                           },
"delete_log_note":
{ Args: { "p_note": string }; Returns: undefined
                           },
"delete_post":
{ Args: { "p_post": string }; Returns: undefined
                           },
"dev_add_bots":
{ Args: { "p_room": string }; Returns: number
                           },
"dev_bot_draw":
{ Args: { "p_bot": string,"p_card": number,"p_game": string }; Returns: undefined
                           },
"dev_bot_hand":
{ Args: { "p_bot": string,"p_nomination": string,"p_raised": boolean }; Returns: undefined
                           },
"dev_bot_post":
{ Args: { "p_body": string,"p_bot": string,"p_game": string }; Returns: undefined
                           },
"dev_remove_bots":
{ Args: { "p_room": string }; Returns: number
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
"mark_log_cells":
{ Args: { "p_cells": Json,"p_game": string,"p_mark": string }; Returns: undefined
                           },
"rename_log_note":
{ Args: { "p_label": string,"p_note": string }; Returns: undefined
                           },
"set_log_cell":
{ Args: { "p_body": string,"p_column": string,"p_game": string,"p_note": string,"p_phase": number,"p_seat": number }; Returns: undefined
                           },
"end_game":
{ Args: { "p_game": string,"p_winner": Database["public"]['Enums']["alignment"] }; Returns: undefined
                           },
"join_room":
{ Args: { "p_code": string }; Returns: string
                           },
"kill_seat":
{ Args: { "p_cause": Database["public"]['Enums']["death_cause"],"p_game": string,"p_note"?: string,"p_seat": number }; Returns: undefined
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
"open_nomination":
{ Args: { "p_game": string,"p_nominator": number,"p_nominee": number }; Returns: string
                           },
"post_board":
{ Args: { "p_body": string,"p_game": string }; Returns: string
                           },
"profile_history":
{ Args: { "p_user": string }; Returns: {
              "as_dm": boolean,"ended_at": string,"final_alignment": Database["public"]['Enums']["alignment"],"game_id": string,"role_name": string,"script_name": string,"seat": number,"winner": Database["public"]['Enums']["alignment"]
            }[]
                           },
"profile_stat_rows":
{ Args: { "p_user": string }; Returns: {
              "as_dm": boolean,"ended_at": string,"final_alignment": Database["public"]['Enums']["alignment"],"starting_role": string,"winner": Database["public"]['Enums']["alignment"]
            }[]
                           },
"remove_token":
{ Args: { "p_token": string }; Returns: undefined
                           },
"revive_seat":
{ Args: { "p_game": string,"p_seat": number }; Returns: undefined
                           },
"save_script":
{ Args: { "p_author": string,"p_name": string,"p_roles": (string)[],"p_script": string }; Returns: string
                           },
"set_alignment":
{ Args: { "p_alignment": Database["public"]['Enums']["alignment"],"p_game": string,"p_seat": number }; Returns: undefined
                           },
"set_bot_sandbox":
{ Args: { "p_on": boolean }; Returns: undefined
                           },
"set_composition":
{ Args: { "p_game": string,"p_roles": Json }; Returns: undefined
                           },
"set_ghost_vote":
{ Args: { "p_game": string,"p_seat": number,"p_used": boolean }; Returns: undefined
                           },
"set_hand":
{ Args: { "p_nomination": string,"p_raised": boolean }; Returns: undefined
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
"set_seat_role":
{ Args: { "p_actual": string,"p_game": string,"p_seat": number,"p_shown": string }; Returns: undefined
                           },
"set_vote_paused":
{ Args: { "p_nomination": string,"p_paused": boolean }; Returns: undefined
                           },
"set_vote_speed":
{ Args: { "p_game": string,"p_ms": number }; Returns: undefined
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
"start_vote":
{ Args: { "p_nomination": string }; Returns: undefined
                           },
"take_dm_seat":
{ Args: { "p_room": string }; Returns: undefined
                           },
"take_seat":
{ Args: { "p_room": string,"p_seat": number }; Returns: undefined
                           },
"unassign_seat":
{ Args: { "p_game": string,"p_seat": number }; Returns: undefined
                           },
"update_setup":
{ Args: { "p_game": string,"p_mode": Database["public"]['Enums']["assignment_mode"],"p_script": string }; Returns: undefined
                           }
          }
          Enums: {
            "alignment": "good"|"evil","assignment_mode": "manual"|"draw","death_cause": "executed"|"night"|"other","log_mark": "red"|"yellow"|"violet"|"green"|"dead"|"none","game_status": "setup"|"in_progress"|"ended","nomination_status": "open"|"voting"|"counted"|"closed"|"cancelled","permission_level": "player"|"dm_eligible"|"admin","team": "townsfolk"|"outsider"|"minion"|"demon","token_kind": "poisoned"|"drunk"|"reminder"|"custom"
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
            "alignment": ["good", "evil"],"assignment_mode": ["manual", "draw"],"death_cause": ["executed", "night", "other"],"log_mark": ["red", "yellow", "violet", "green", "dead", "none"],"game_status": ["setup", "in_progress", "ended"],"nomination_status": ["open", "voting", "counted", "closed", "cancelled"],"permission_level": ["player", "dm_eligible", "admin"],"team": ["townsfolk", "outsider", "minion", "demon"],"token_kind": ["poisoned", "drunk", "reminder", "custom"]
          }
        }
} as const

