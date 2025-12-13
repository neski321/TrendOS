export type Category = 'hip_hop' | 'nba' | 'celebrity';

export interface VideoCandidate {
  id: string;
  title: string;
  channel: string;
  publishedAt: string;
  views: number;
  likes: number;
  velocity: number; // views per hour
  score: number;
  category: Category;
  thumbnail: string;
  entity: string;
  url?: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'success' | 'error';
  message: string;
  module?: string;
}

