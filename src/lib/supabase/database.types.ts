// File generato con `npm run db:types` — non modificare a mano.


export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "competition_teams": {
                  Row: {
                    "competition_id": string,"csi_team_id": number | null,"display_name": string,"group_label": string | null,"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "competition_id": string,"csi_team_id"?: number | null,"display_name": string,"group_label"?: string | null,"team_id": string
                  }
                  Update: {
                    "competition_id"?: string,"csi_team_id"?: number | null,"display_name"?: string,"group_label"?: string | null,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "competition_teams_competition_id_fkey"
      columns: ["competition_id"]
isOneToOne: false
      referencedRelation: "competitions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "competition_teams_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"competitions": {
                  Row: {
                    "created_at": string,"csi_project_id": number | null,"format_notes": string | null,"id": string,"kind": Database["public"]['Enums']["competition_kind"],"name": string,"phase_order": number,"season_id": string,"short_name": string | null,"slug": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"csi_project_id"?: number | null,"format_notes"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["competition_kind"],"name": string,"phase_order"?: number,"season_id": string,"short_name"?: string | null,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"csi_project_id"?: number | null,"format_notes"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["competition_kind"],"name"?: string,"phase_order"?: number,"season_id"?: string,"short_name"?: string | null,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "competitions_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    }
                  ]
                },"data_sources": {
                  Row: {
                    "created_at": string,"id": string,"kind": Database["public"]['Enums']["source_kind"],"label": string,"notes": string | null,"reference_date": string | null,"source_key": string | null,"url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"kind": Database["public"]['Enums']["source_kind"],"label": string,"notes"?: string | null,"reference_date"?: string | null,"source_key"?: string | null,"url"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["source_kind"],"label"?: string,"notes"?: string | null,"reference_date"?: string | null,"source_key"?: string | null,"url"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"imports": {
                  Row: {
                    "completed_at": string | null,"created_at": string,"created_by": string | null,"error_message": string | null,"file_hash": string | null,"file_name": string | null,"file_size": number | null,"id": string,"issues": NonNullable<Json>,"kind": string,"match_id": string | null,"parsed_payload": Json | null,"parser": string | null,"parser_version": string | null,"season_id": string | null,"source_id": string | null,"status": Database["public"]['Enums']["import_status"],"storage_path": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"error_message"?: string | null,"file_hash"?: string | null,"file_name"?: string | null,"file_size"?: number | null,"id"?: string,"issues"?: NonNullable<Json>,"kind": string,"match_id"?: string | null,"parsed_payload"?: Json | null,"parser"?: string | null,"parser_version"?: string | null,"season_id"?: string | null,"source_id"?: string | null,"status"?: Database["public"]['Enums']["import_status"],"storage_path"?: string | null
                  }
                  Update: {
                    "completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"error_message"?: string | null,"file_hash"?: string | null,"file_name"?: string | null,"file_size"?: number | null,"id"?: string,"issues"?: NonNullable<Json>,"kind"?: string,"match_id"?: string | null,"parsed_payload"?: Json | null,"parser"?: string | null,"parser_version"?: string | null,"season_id"?: string | null,"source_id"?: string | null,"status"?: Database["public"]['Enums']["import_status"],"storage_path"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "imports_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "imports_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "v_matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "imports_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "imports_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "data_sources"
      referencedColumns: ["id"]
    }
                  ]
                },"match_awards": {
                  Row: {
                    "award": string,"created_at": string,"match_id": string,"notes": string | null,"player_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "award"?: string,"created_at"?: string,"match_id": string,"notes"?: string | null,"player_id": string
                  }
                  Update: {
                    "award"?: string,"created_at"?: string,"match_id"?: string,"notes"?: string | null,"player_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_awards_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_awards_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "v_matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_awards_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"match_period_scores": {
                  Row: {
                    "match_id": string,"period": number,"points": number,"source_id": string | null,"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "match_id": string,"period": number,"points": number,"source_id"?: string | null,"team_id": string
                  }
                  Update: {
                    "match_id"?: string,"period"?: number,"points"?: number,"source_id"?: string | null,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_period_scores_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_period_scores_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "v_matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_period_scores_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "data_sources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_period_scores_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"matches": {
                  Row: {
                    "away_score": number | null,"away_team_id": string,"competition_id": string,"created_at": string,"csi_game_code": string | null,"csi_match_id": number | null,"home_away_confirmed": boolean,"home_score": number | null,"home_team_id": string,"id": string,"import_key": string | null,"match_date": string | null,"notes": string | null,"result_source_id": string | null,"round_label": string | null,"round_number": number | null,"schedule_source_id": string | null,"start_time": string | null,"status": Database["public"]['Enums']["match_status"],"updated_at": string,"venue_id": string | null,"verification": Database["public"]['Enums']["verification_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "away_score"?: number | null,"away_team_id": string,"competition_id": string,"created_at"?: string,"csi_game_code"?: string | null,"csi_match_id"?: number | null,"home_away_confirmed"?: boolean,"home_score"?: number | null,"home_team_id": string,"id"?: string,"import_key"?: string | null,"match_date"?: string | null,"notes"?: string | null,"result_source_id"?: string | null,"round_label"?: string | null,"round_number"?: number | null,"schedule_source_id"?: string | null,"start_time"?: string | null,"status"?: Database["public"]['Enums']["match_status"],"updated_at"?: string,"venue_id"?: string | null,"verification"?: Database["public"]['Enums']["verification_status"]
                  }
                  Update: {
                    "away_score"?: number | null,"away_team_id"?: string,"competition_id"?: string,"created_at"?: string,"csi_game_code"?: string | null,"csi_match_id"?: number | null,"home_away_confirmed"?: boolean,"home_score"?: number | null,"home_team_id"?: string,"id"?: string,"import_key"?: string | null,"match_date"?: string | null,"notes"?: string | null,"result_source_id"?: string | null,"round_label"?: string | null,"round_number"?: number | null,"schedule_source_id"?: string | null,"start_time"?: string | null,"status"?: Database["public"]['Enums']["match_status"],"updated_at"?: string,"venue_id"?: string | null,"verification"?: Database["public"]['Enums']["verification_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "matches_away_team_id_fkey"
      columns: ["away_team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_competition_id_fkey"
      columns: ["competition_id"]
isOneToOne: false
      referencedRelation: "competitions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_home_team_id_fkey"
      columns: ["home_team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_result_source_id_fkey"
      columns: ["result_source_id"]
isOneToOne: false
      referencedRelation: "data_sources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_schedule_source_id_fkey"
      columns: ["schedule_source_id"]
isOneToOne: false
      referencedRelation: "data_sources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_venue_id_fkey"
      columns: ["venue_id"]
isOneToOne: false
      referencedRelation: "venues"
      referencedColumns: ["id"]
    }
                  ]
                },"official_standings": {
                  Row: {
                    "as_of": string | null,"competition_id": string,"created_at": string,"extra": NonNullable<Json>,"id": string,"losses": number,"ot_losses": number | null,"played": number,"points": number,"points_against": number | null,"points_for": number | null,"position": number,"source_id": string | null,"team_id": string,"wins": number
                  }
                  ComputedFields: never
                  Insert: {
                    "as_of"?: string | null,"competition_id": string,"created_at"?: string,"extra"?: NonNullable<Json>,"id"?: string,"losses": number,"ot_losses"?: number | null,"played": number,"points": number,"points_against"?: number | null,"points_for"?: number | null,"position": number,"source_id"?: string | null,"team_id": string,"wins": number
                  }
                  Update: {
                    "as_of"?: string | null,"competition_id"?: string,"created_at"?: string,"extra"?: NonNullable<Json>,"id"?: string,"losses"?: number,"ot_losses"?: number | null,"played"?: number,"points"?: number,"points_against"?: number | null,"points_for"?: number | null,"position"?: number,"source_id"?: string | null,"team_id"?: string,"wins"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "official_standings_competition_id_fkey"
      columns: ["competition_id"]
isOneToOne: false
      referencedRelation: "competitions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "official_standings_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "data_sources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "official_standings_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"player_aliases": {
                  Row: {
                    "alias": string,"alias_normalized": string,"created_at": string,"id": string,"jersey_number": string | null,"notes": string | null,"player_id": string,"season_id": string | null,"source_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "alias": string,"alias_normalized": string,"created_at"?: string,"id"?: string,"jersey_number"?: string | null,"notes"?: string | null,"player_id": string,"season_id"?: string | null,"source_id"?: string | null
                  }
                  Update: {
                    "alias"?: string,"alias_normalized"?: string,"created_at"?: string,"id"?: string,"jersey_number"?: string | null,"notes"?: string | null,"player_id"?: string,"season_id"?: string | null,"source_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "player_aliases_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_aliases_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_aliases_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "data_sources"
      referencedColumns: ["id"]
    }
                  ]
                },"player_match_stats": {
                  Row: {
                    "ast": number | null,"blk": number | null,"created_at": string,"dreb": number | null,"extra": NonNullable<Json>,"fg3a": number | null,"fg3m": number | null,"fga": number | null,"fgm": number | null,"fta": number | null,"ftm": number | null,"id": string,"import_id": string | null,"is_starter": boolean | null,"jersey_number": string | null,"match_id": string,"minutes": number | null,"oreb": number | null,"participation": Database["public"]['Enums']["participation"],"pf": number | null,"player_id": string | null,"plus_minus": number | null,"points": number | null,"raw_name": string | null,"reb": number | null,"source_id": string,"stl": number | null,"team_id": string,"tov": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ast"?: number | null,"blk"?: number | null,"created_at"?: string,"dreb"?: number | null,"extra"?: NonNullable<Json>,"fg3a"?: number | null,"fg3m"?: number | null,"fga"?: number | null,"fgm"?: number | null,"fta"?: number | null,"ftm"?: number | null,"id"?: string,"import_id"?: string | null,"is_starter"?: boolean | null,"jersey_number"?: string | null,"match_id": string,"minutes"?: number | null,"oreb"?: number | null,"participation"?: Database["public"]['Enums']["participation"],"pf"?: number | null,"player_id"?: string | null,"plus_minus"?: number | null,"points"?: number | null,"raw_name"?: string | null,"reb"?: number | null,"source_id": string,"stl"?: number | null,"team_id": string,"tov"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "ast"?: number | null,"blk"?: number | null,"created_at"?: string,"dreb"?: number | null,"extra"?: NonNullable<Json>,"fg3a"?: number | null,"fg3m"?: number | null,"fga"?: number | null,"fgm"?: number | null,"fta"?: number | null,"ftm"?: number | null,"id"?: string,"import_id"?: string | null,"is_starter"?: boolean | null,"jersey_number"?: string | null,"match_id"?: string,"minutes"?: number | null,"oreb"?: number | null,"participation"?: Database["public"]['Enums']["participation"],"pf"?: number | null,"player_id"?: string | null,"plus_minus"?: number | null,"points"?: number | null,"raw_name"?: string | null,"reb"?: number | null,"source_id"?: string,"stl"?: number | null,"team_id"?: string,"tov"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "player_match_stats_import_id_fkey"
      columns: ["import_id"]
isOneToOne: false
      referencedRelation: "imports"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_match_stats_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_match_stats_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "v_matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_match_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_match_stats_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "data_sources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_match_stats_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"player_season_aggregates": {
                  Row: {
                    "ast": number | null,"blk": number | null,"competition_id": string | null,"created_at": string,"dreb": number | null,"fg3a": number | null,"fg3m": number | null,"fga": number | null,"fgm": number | null,"fta": number | null,"ftm": number | null,"games": number,"id": string,"minutes": number | null,"notes": string | null,"oreb": number | null,"pf": number | null,"player_id": string,"points": number | null,"reb": number | null,"season_id": string,"source_id": string,"stl": number | null,"tov": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ast"?: number | null,"blk"?: number | null,"competition_id"?: string | null,"created_at"?: string,"dreb"?: number | null,"fg3a"?: number | null,"fg3m"?: number | null,"fga"?: number | null,"fgm"?: number | null,"fta"?: number | null,"ftm"?: number | null,"games": number,"id"?: string,"minutes"?: number | null,"notes"?: string | null,"oreb"?: number | null,"pf"?: number | null,"player_id": string,"points"?: number | null,"reb"?: number | null,"season_id": string,"source_id": string,"stl"?: number | null,"tov"?: number | null
                  }
                  Update: {
                    "ast"?: number | null,"blk"?: number | null,"competition_id"?: string | null,"created_at"?: string,"dreb"?: number | null,"fg3a"?: number | null,"fg3m"?: number | null,"fga"?: number | null,"fgm"?: number | null,"fta"?: number | null,"ftm"?: number | null,"games"?: number,"id"?: string,"minutes"?: number | null,"notes"?: string | null,"oreb"?: number | null,"pf"?: number | null,"player_id"?: string,"points"?: number | null,"reb"?: number | null,"season_id"?: string,"source_id"?: string,"stl"?: number | null,"tov"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "player_season_aggregates_competition_id_fkey"
      columns: ["competition_id"]
isOneToOne: false
      referencedRelation: "competitions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_season_aggregates_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_season_aggregates_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_season_aggregates_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "data_sources"
      referencedColumns: ["id"]
    }
                  ]
                },"players": {
                  Row: {
                    "bio": string | null,"created_at": string,"display_name": string | null,"first_name": string,"id": string,"last_name": string,"nickname": string | null,"notes": string | null,"photo_path": string | null,"slug": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bio"?: string | null,"created_at"?: string,"display_name"?: never,"first_name": string,"id"?: string,"last_name": string,"nickname"?: string | null,"notes"?: string | null,"photo_path"?: string | null,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "bio"?: string | null,"created_at"?: string,"display_name"?: never,"first_name"?: string,"id"?: string,"last_name"?: string,"nickname"?: string | null,"notes"?: string | null,"photo_path"?: string | null,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"private_profiles": {
                  Row: {
                    "birth_date": string | null,"id": string,"notes": string | null,"player_id": string | null,"staff_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "birth_date"?: string | null,"id"?: string,"notes"?: string | null,"player_id"?: string | null,"staff_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "birth_date"?: string | null,"id"?: string,"notes"?: string | null,"player_id"?: string | null,"staff_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "private_profiles_player_id_fkey"
      columns: ["player_id"]
isOneToOne: true
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "private_profiles_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: true
      referencedRelation: "staff_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "private_profiles_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: true
      referencedRelation: "v_season_staff"
      referencedColumns: ["staff_id"]
    }
                  ]
                },"season_rosters": {
                  Row: {
                    "created_at": string,"is_active": boolean,"is_captain": boolean,"is_vice_captain": boolean,"jersey_number": string | null,"nickname": string | null,"notes": string | null,"player_id": string,"role": string | null,"season_id": string,"source_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"is_active"?: boolean,"is_captain"?: boolean,"is_vice_captain"?: boolean,"jersey_number"?: string | null,"nickname"?: string | null,"notes"?: string | null,"player_id": string,"role"?: string | null,"season_id": string,"source_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"is_active"?: boolean,"is_captain"?: boolean,"is_vice_captain"?: boolean,"jersey_number"?: string | null,"nickname"?: string | null,"notes"?: string | null,"player_id"?: string,"role"?: string | null,"season_id"?: string,"source_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "season_rosters_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "season_rosters_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "season_rosters_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "data_sources"
      referencedColumns: ["id"]
    }
                  ]
                },"season_staff": {
                  Row: {
                    "created_at": string,"role": string,"season_id": string,"sort_order": number,"source_id": string | null,"staff_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"role": string,"season_id": string,"sort_order"?: number,"source_id"?: string | null,"staff_id": string
                  }
                  Update: {
                    "created_at"?: string,"role"?: string,"season_id"?: string,"sort_order"?: number,"source_id"?: string | null,"staff_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "season_staff_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "season_staff_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "data_sources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "season_staff_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "staff_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "season_staff_staff_id_fkey"
      columns: ["staff_id"]
isOneToOne: false
      referencedRelation: "v_season_staff"
      referencedColumns: ["staff_id"]
    }
                  ]
                },"seasons": {
                  Row: {
                    "created_at": string,"end_date": string | null,"id": string,"is_current": boolean,"label": string,"notes": string | null,"slug": string,"start_date": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"end_date"?: string | null,"id"?: string,"is_current"?: boolean,"label": string,"notes"?: string | null,"slug": string,"start_date"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"end_date"?: string | null,"id"?: string,"is_current"?: boolean,"label"?: string,"notes"?: string | null,"slug"?: string,"start_date"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"source_conflicts": {
                  Row: {
                    "created_at": string,"description": string,"entity_id": string,"entity_type": string,"field": string,"id": string,"match_id": string | null,"primary_source_id": string | null,"primary_value": string | null,"resolution_note": string | null,"resolved_at": string | null,"secondary_source_id": string | null,"secondary_value": string | null,"status": Database["public"]['Enums']["conflict_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description": string,"entity_id": string,"entity_type": string,"field": string,"id"?: string,"match_id"?: string | null,"primary_source_id"?: string | null,"primary_value"?: string | null,"resolution_note"?: string | null,"resolved_at"?: string | null,"secondary_source_id"?: string | null,"secondary_value"?: string | null,"status"?: Database["public"]['Enums']["conflict_status"]
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"entity_id"?: string,"entity_type"?: string,"field"?: string,"id"?: string,"match_id"?: string | null,"primary_source_id"?: string | null,"primary_value"?: string | null,"resolution_note"?: string | null,"resolved_at"?: string | null,"secondary_source_id"?: string | null,"secondary_value"?: string | null,"status"?: Database["public"]['Enums']["conflict_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "source_conflicts_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "source_conflicts_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "v_matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "source_conflicts_primary_source_id_fkey"
      columns: ["primary_source_id"]
isOneToOne: false
      referencedRelation: "data_sources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "source_conflicts_secondary_source_id_fkey"
      columns: ["secondary_source_id"]
isOneToOne: false
      referencedRelation: "data_sources"
      referencedColumns: ["id"]
    }
                  ]
                },"staff_members": {
                  Row: {
                    "created_at": string,"display_name": string | null,"first_name": string,"id": string,"last_name": string,"notes": string | null,"photo_path": string | null,"player_id": string | null,"slug": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: never,"first_name": string,"id"?: string,"last_name": string,"notes"?: string | null,"photo_path"?: string | null,"player_id"?: string | null,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: never,"first_name"?: string,"id"?: string,"last_name"?: string,"notes"?: string | null,"photo_path"?: string | null,"player_id"?: string | null,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_members_player_id_fkey"
      columns: ["player_id"]
isOneToOne: true
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"standings_adjustments": {
                  Row: {
                    "competition_id": string,"created_at": string,"id": string,"points": number,"reason": string,"source_id": string | null,"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "competition_id": string,"created_at"?: string,"id"?: string,"points": number,"reason": string,"source_id"?: string | null,"team_id": string
                  }
                  Update: {
                    "competition_id"?: string,"created_at"?: string,"id"?: string,"points"?: number,"reason"?: string,"source_id"?: string | null,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "standings_adjustments_competition_id_fkey"
      columns: ["competition_id"]
isOneToOne: false
      referencedRelation: "competitions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "standings_adjustments_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "data_sources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "standings_adjustments_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"standings_rules": {
                  Row: {
                    "competition_id": string,"is_verified": boolean,"notes": string | null,"points_forfeit_loss": number | null,"points_forfeit_win": number | null,"points_loss": number,"points_ot_loss": number | null,"points_ot_win": number | null,"points_win": number,"source_id": string | null,"tiebreakers": (string)[],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "competition_id": string,"is_verified"?: boolean,"notes"?: string | null,"points_forfeit_loss"?: number | null,"points_forfeit_win"?: number | null,"points_loss": number,"points_ot_loss"?: number | null,"points_ot_win"?: number | null,"points_win": number,"source_id"?: string | null,"tiebreakers"?: (string)[],"updated_at"?: string
                  }
                  Update: {
                    "competition_id"?: string,"is_verified"?: boolean,"notes"?: string | null,"points_forfeit_loss"?: number | null,"points_forfeit_win"?: number | null,"points_loss"?: number,"points_ot_loss"?: number | null,"points_ot_win"?: number | null,"points_win"?: number,"source_id"?: string | null,"tiebreakers"?: (string)[],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "standings_rules_competition_id_fkey"
      columns: ["competition_id"]
isOneToOne: true
      referencedRelation: "competitions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "standings_rules_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "data_sources"
      referencedColumns: ["id"]
    }
                  ]
                },"stat_columns": {
                  Row: {
                    "column_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "column_name": string
                  }
                  Update: {
                    "column_name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"stat_definitions": {
                  Row: {
                    "category": string,"column_name": string | null,"decimals": number,"denominator_column": string | null,"description": string | null,"higher_is_better": boolean,"key": string,"kind": string,"label": string,"min_attempts": number,"min_games": number,"numerator_column": string | null,"short_label": string,"show_in_box_score": boolean,"show_in_leaderboards": boolean,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"column_name"?: string | null,"decimals"?: number,"denominator_column"?: string | null,"description"?: string | null,"higher_is_better"?: boolean,"key": string,"kind": string,"label": string,"min_attempts"?: number,"min_games"?: number,"numerator_column"?: string | null,"short_label": string,"show_in_box_score"?: boolean,"show_in_leaderboards"?: boolean,"sort_order"?: number
                  }
                  Update: {
                    "category"?: string,"column_name"?: string | null,"decimals"?: number,"denominator_column"?: string | null,"description"?: string | null,"higher_is_better"?: boolean,"key"?: string,"kind"?: string,"label"?: string,"min_attempts"?: number,"min_games"?: number,"numerator_column"?: string | null,"short_label"?: string,"show_in_box_score"?: boolean,"show_in_leaderboards"?: boolean,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "stat_definitions_column_fk"
      columns: ["column_name"]
isOneToOne: false
      referencedRelation: "stat_columns"
      referencedColumns: ["column_name"]
    },{
      foreignKeyName: "stat_definitions_den_fk"
      columns: ["denominator_column"]
isOneToOne: false
      referencedRelation: "stat_columns"
      referencedColumns: ["column_name"]
    },{
      foreignKeyName: "stat_definitions_num_fk"
      columns: ["numerator_column"]
isOneToOne: false
      referencedRelation: "stat_columns"
      referencedColumns: ["column_name"]
    }
                  ]
                },"team_aliases": {
                  Row: {
                    "alias": string,"alias_normalized": string,"created_at": string,"id": string,"season_id": string | null,"source_id": string | null,"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alias": string,"alias_normalized": string,"created_at"?: string,"id"?: string,"season_id"?: string | null,"source_id"?: string | null,"team_id": string
                  }
                  Update: {
                    "alias"?: string,"alias_normalized"?: string,"created_at"?: string,"id"?: string,"season_id"?: string | null,"source_id"?: string | null,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_aliases_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_aliases_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "data_sources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_aliases_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"team_match_stats": {
                  Row: {
                    "ast": number | null,"blk": number | null,"created_at": string,"dreb": number | null,"extra": NonNullable<Json>,"fg3a": number | null,"fg3m": number | null,"fga": number | null,"fgm": number | null,"fta": number | null,"ftm": number | null,"id": string,"import_id": string | null,"match_id": string,"oreb": number | null,"pf": number | null,"points": number | null,"reb": number | null,"source_id": string,"stl": number | null,"team_id": string,"tov": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ast"?: number | null,"blk"?: number | null,"created_at"?: string,"dreb"?: number | null,"extra"?: NonNullable<Json>,"fg3a"?: number | null,"fg3m"?: number | null,"fga"?: number | null,"fgm"?: number | null,"fta"?: number | null,"ftm"?: number | null,"id"?: string,"import_id"?: string | null,"match_id": string,"oreb"?: number | null,"pf"?: number | null,"points"?: number | null,"reb"?: number | null,"source_id": string,"stl"?: number | null,"team_id": string,"tov"?: number | null
                  }
                  Update: {
                    "ast"?: number | null,"blk"?: number | null,"created_at"?: string,"dreb"?: number | null,"extra"?: NonNullable<Json>,"fg3a"?: number | null,"fg3m"?: number | null,"fga"?: number | null,"fgm"?: number | null,"fta"?: number | null,"ftm"?: number | null,"id"?: string,"import_id"?: string | null,"match_id"?: string,"oreb"?: number | null,"pf"?: number | null,"points"?: number | null,"reb"?: number | null,"source_id"?: string,"stl"?: number | null,"team_id"?: string,"tov"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_match_stats_import_id_fkey"
      columns: ["import_id"]
isOneToOne: false
      referencedRelation: "imports"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_match_stats_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_match_stats_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "v_matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_match_stats_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "data_sources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_match_stats_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"teams": {
                  Row: {
                    "city": string | null,"created_at": string,"id": string,"is_own_team": boolean,"logo_path": string | null,"name": string,"notes": string | null,"short_name": string | null,"slug": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "city"?: string | null,"created_at"?: string,"id"?: string,"is_own_team"?: boolean,"logo_path"?: string | null,"name": string,"notes"?: string | null,"short_name"?: string | null,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "city"?: string | null,"created_at"?: string,"id"?: string,"is_own_team"?: boolean,"logo_path"?: string | null,"name"?: string,"notes"?: string | null,"short_name"?: string | null,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"training_breaks": {
                  Row: {
                    "end_date": string,"id": string,"label": string,"season_id": string,"start_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "end_date": string,"id"?: string,"label": string,"season_id": string,"start_date": string
                  }
                  Update: {
                    "end_date"?: string,"id"?: string,"label"?: string,"season_id"?: string,"start_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "training_breaks_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    }
                  ]
                },"training_schedule": {
                  Row: {
                    "end_date": string,"notes": string | null,"season_id": string,"start_date": string,"weekdays": (number)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "end_date": string,"notes"?: string | null,"season_id": string,"start_date": string,"weekdays"?: (number)[]
                  }
                  Update: {
                    "end_date"?: string,"notes"?: string | null,"season_id"?: string,"start_date"?: string,"weekdays"?: (number)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "training_schedule_season_id_fkey"
      columns: ["season_id"]
isOneToOne: true
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    }
                  ]
                },"user_roles": {
                  Row: {
                    "created_at": string,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"role"?: Database["public"]['Enums']["app_role"],"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"venues": {
                  Row: {
                    "address": string | null,"city": string | null,"created_at": string,"id": string,"name": string,"notes": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"city"?: string | null,"created_at"?: string,"id"?: string,"name": string,"notes"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"city"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"notes"?: string | null
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "v_matches": {
                  Row: {
                    "away_is_own": boolean | null,"away_score": number | null,"away_team_id": string | null,"away_team_name": string | null,"away_team_slug": string | null,"competition_id": string | null,"competition_kind": Database["public"]['Enums']["competition_kind"] | null,"competition_name": string | null,"competition_short_name": string | null,"competition_slug": string | null,"csi_game_code": string | null,"csi_match_id": number | null,"has_box_score": boolean | null,"home_away_confirmed": boolean | null,"home_is_own": boolean | null,"home_score": number | null,"home_team_id": string | null,"home_team_name": string | null,"home_team_slug": string | null,"id": string | null,"involves_own_team": boolean | null,"match_date": string | null,"notes": string | null,"opponent_id": string | null,"opponent_name": string | null,"opponent_score": number | null,"opponent_slug": string | null,"own_result": string | null,"own_score": number | null,"own_side": string | null,"periods_recorded": number | null,"phase_order": number | null,"result_source_id": string | null,"round_label": string | null,"round_number": number | null,"schedule_source_id": string | null,"season_id": string | null,"season_label": string | null,"season_slug": string | null,"start_time": string | null,"status": Database["public"]['Enums']["match_status"] | null,"venue_address": string | null,"venue_city": string | null,"venue_id": string | null,"venue_name": string | null,"verification": Database["public"]['Enums']["verification_status"] | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "competitions_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_away_team_id_fkey"
      columns: ["away_team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_competition_id_fkey"
      columns: ["competition_id"]
isOneToOne: false
      referencedRelation: "competitions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_home_team_id_fkey"
      columns: ["home_team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_result_source_id_fkey"
      columns: ["result_source_id"]
isOneToOne: false
      referencedRelation: "data_sources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_schedule_source_id_fkey"
      columns: ["schedule_source_id"]
isOneToOne: false
      referencedRelation: "data_sources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_venue_id_fkey"
      columns: ["venue_id"]
isOneToOne: false
      referencedRelation: "venues"
      referencedColumns: ["id"]
    }
                  ]
                },"v_own_competition_records": {
                  Row: {
                    "competition_id": string | null,"competition_kind": Database["public"]['Enums']["competition_kind"] | null,"competition_name": string | null,"competition_slug": string | null,"losses": number | null,"phase_order": number | null,"played": number | null,"points_against": number | null,"points_for": number | null,"scheduled": number | null,"season_id": string | null,"season_slug": string | null,"wins": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "competitions_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_competition_id_fkey"
      columns: ["competition_id"]
isOneToOne: false
      referencedRelation: "competitions"
      referencedColumns: ["id"]
    }
                  ]
                },"v_player_career_totals": {
                  Row: {
                    "ast": number | null,"ast_games": number | null,"blk": number | null,"blk_games": number | null,"dreb": number | null,"dreb_games": number | null,"fg2a": number | null,"fg2a_games": number | null,"fg2m": number | null,"fg3a": number | null,"fg3a_games": number | null,"fg3m": number | null,"fga": number | null,"fga_games": number | null,"fgm": number | null,"fta": number | null,"fta_games": number | null,"ftm": number | null,"games": number | null,"includes_historical_aggregates": boolean | null,"minutes": number | null,"minutes_games": number | null,"oreb": number | null,"oreb_games": number | null,"pf": number | null,"pf_games": number | null,"player_id": string | null,"plus_minus": number | null,"plus_minus_games": number | null,"points": number | null,"points_games": number | null,"reb": number | null,"reb_games": number | null,"seasons_with_stats": number | null,"stl": number | null,"stl_games": number | null,"tov": number | null,"tov_games": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_player_competition_totals": {
                  Row: {
                    "ast": number | null,"ast_games": number | null,"basis": string | null,"blk": number | null,"blk_games": number | null,"competition_id": string | null,"dreb": number | null,"dreb_games": number | null,"fg2a": number | null,"fg2a_games": number | null,"fg2m": number | null,"fg3a": number | null,"fg3a_games": number | null,"fg3m": number | null,"fga": number | null,"fga_games": number | null,"fgm": number | null,"fta": number | null,"fta_games": number | null,"ftm": number | null,"games": number | null,"minutes": number | null,"minutes_games": number | null,"oreb": number | null,"oreb_games": number | null,"pf": number | null,"pf_games": number | null,"player_id": string | null,"plus_minus": number | null,"plus_minus_games": number | null,"points": number | null,"points_games": number | null,"reb": number | null,"reb_games": number | null,"season_id": string | null,"stl": number | null,"stl_games": number | null,"tov": number | null,"tov_games": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "competitions_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_competition_id_fkey"
      columns: ["competition_id"]
isOneToOne: false
      referencedRelation: "competitions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_match_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"v_player_game_lines": {
                  Row: {
                    "ast": number | null,"blk": number | null,"competition_id": string | null,"competition_kind": Database["public"]['Enums']["competition_kind"] | null,"competition_name": string | null,"competition_slug": string | null,"dreb": number | null,"extra": Json | null,"fg2a": number | null,"fg2m": number | null,"fg3a": number | null,"fg3m": number | null,"fga": number | null,"fgm": number | null,"fta": number | null,"ftm": number | null,"id": string | null,"is_own_team": boolean | null,"is_starter": boolean | null,"jersey_number": string | null,"match_date": string | null,"match_id": string | null,"match_status": Database["public"]['Enums']["match_status"] | null,"minutes": number | null,"opponent_id": string | null,"opponent_name": string | null,"opponent_score": number | null,"oreb": number | null,"own_result": string | null,"own_score": number | null,"own_side": string | null,"participation": Database["public"]['Enums']["participation"] | null,"pf": number | null,"player_id": string | null,"player_name": string | null,"player_slug": string | null,"plus_minus": number | null,"points": number | null,"raw_name": string | null,"reb": number | null,"season_id": string | null,"season_slug": string | null,"source_id": string | null,"source_kind": Database["public"]['Enums']["source_kind"] | null,"stl": number | null,"team_id": string | null,"tov": number | null,"worn_jersey_number": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "competitions_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_competition_id_fkey"
      columns: ["competition_id"]
isOneToOne: false
      referencedRelation: "competitions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_match_stats_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_match_stats_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "v_matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_match_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_match_stats_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "data_sources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_match_stats_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"v_player_season_totals": {
                  Row: {
                    "ast": number | null,"ast_games": number | null,"basis": string | null,"blk": number | null,"blk_games": number | null,"dreb": number | null,"dreb_games": number | null,"fg2a": number | null,"fg2a_games": number | null,"fg2m": number | null,"fg3a": number | null,"fg3a_games": number | null,"fg3m": number | null,"fga": number | null,"fga_games": number | null,"fgm": number | null,"fta": number | null,"fta_games": number | null,"ftm": number | null,"games": number | null,"minutes": number | null,"minutes_games": number | null,"oreb": number | null,"oreb_games": number | null,"pf": number | null,"pf_games": number | null,"player_id": string | null,"plus_minus": number | null,"plus_minus_games": number | null,"points": number | null,"points_games": number | null,"reb": number | null,"reb_games": number | null,"season_id": string | null,"stl": number | null,"stl_games": number | null,"tov": number | null,"tov_games": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"v_season_roster": {
                  Row: {
                    "display_name": string | null,"first_name": string | null,"first_season_slug": string | null,"games": number | null,"is_active": boolean | null,"is_captain": boolean | null,"is_vice_captain": boolean | null,"jersey_number": string | null,"last_name": string | null,"nickname": string | null,"photo_path": string | null,"player_id": string | null,"player_slug": string | null,"role": string | null,"season_id": string | null,"season_slug": string | null,"staff_role": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "season_rosters_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "season_rosters_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    }
                  ]
                },"v_season_staff": {
                  Row: {
                    "display_name": string | null,"first_name": string | null,"games_as_player": number | null,"last_name": string | null,"photo_path": string | null,"player_id": string | null,"player_slug": string | null,"role": string | null,"season_id": string | null,"season_slug": string | null,"slug": string | null,"sort_order": number | null,"staff_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "season_staff_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_members_player_id_fkey"
      columns: ["player_id"]
isOneToOne: true
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "admin_list_access":
{ Args: Record<PropertyKey, never>; Returns: {
              "email": string,"last_sign_in_at": string,"role": string,"user_id": string
            }[]
                           },
"admin_set_role":
{ Args: { "new_role": string,"target_email": string }; Returns: undefined
                           },
"import_match_report":
{ Args: { "payload": Json }; Returns: Json
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_team_member":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           }
          }
          Enums: {
            "app_role": "admin"|"team","competition_kind": "regular_season"|"poule"|"playoff"|"cup"|"friendly"|"other","conflict_status": "open"|"acknowledged"|"resolved","import_status": "pending"|"completed"|"failed"|"superseded"|"duplicate","match_status": "scheduled"|"played"|"postponed"|"cancelled"|"forfeit","participation": "played"|"dnp","source_kind": "html"|"excel"|"csi"|"livescore"|"instagram"|"pdf"|"photo"|"web"|"manual","verification_status": "verified"|"probable"|"to_verify"
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
            "app_role": ["admin", "team"],"competition_kind": ["regular_season", "poule", "playoff", "cup", "friendly", "other"],"conflict_status": ["open", "acknowledged", "resolved"],"import_status": ["pending", "completed", "failed", "superseded", "duplicate"],"match_status": ["scheduled", "played", "postponed", "cancelled", "forfeit"],"participation": ["played", "dnp"],"source_kind": ["html", "excel", "csi", "livescore", "instagram", "pdf", "photo", "web", "manual"],"verification_status": ["verified", "probable", "to_verify"]
          }
        }
} as const
