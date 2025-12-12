import hipHopImg from '@assets/generated_images/hip_hop_podcast_studio_with_neon_lighting.png';
import nbaImg from '@assets/generated_images/nba_basketball_game_action_shot.png';
import celebImg from '@assets/generated_images/modern_celebrity_podcast_studio.png';

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
}

export const MOCK_CANDIDATES: VideoCandidate[] = [
  {
    id: '1',
    title: 'Drake TALKS Future Beef & New Album Leaks (Exclusive)',
    channel: 'VladTV',
    publishedAt: '2025-12-12T08:00:00Z',
    views: 45200,
    likes: 3200,
    velocity: 5600,
    score: 94,
    category: 'hip_hop',
    thumbnail: hipHopImg,
    entity: 'Drake'
  },
  {
    id: '2',
    title: 'LeBron James EXPLODES for 50 Points vs Warriors! Full Highlights',
    channel: 'House of Highlights',
    publishedAt: '2025-12-11T22:30:00Z',
    views: 1250000,
    likes: 85000,
    velocity: 42000,
    score: 98,
    category: 'nba',
    thumbnail: nbaImg,
    entity: 'LeBron James'
  },
  {
    id: '3',
    title: 'Kai Cenat & Kevin Hart: The Uncensored Interview',
    channel: 'AMP',
    publishedAt: '2025-12-12T10:15:00Z',
    views: 890000,
    likes: 120000,
    velocity: 150000,
    score: 99,
    category: 'celebrity',
    thumbnail: celebImg,
    entity: 'Kai Cenat'
  },
  {
    id: '4',
    title: 'Kendrick Lamar "Not Like Us" Video Breakdown',
    channel: 'Joe Budden TV',
    publishedAt: '2025-12-11T18:00:00Z',
    views: 210000,
    likes: 15000,
    velocity: 8000,
    score: 87,
    category: 'hip_hop',
    thumbnail: hipHopImg,
    entity: 'Kendrick Lamar'
  },
  {
    id: '5',
    title: 'Steph Curry Practice Routine is INSANE',
    channel: 'NBA',
    publishedAt: '2025-12-12T09:00:00Z',
    views: 85000,
    likes: 9000,
    velocity: 6000,
    score: 82,
    category: 'nba',
    thumbnail: nbaImg,
    entity: 'Stephen Curry'
  },
  {
    id: '6',
    title: 'MrBeast Reveals His Next $10M Challenge',
    channel: 'Colin and Samir',
    publishedAt: '2025-12-10T14:00:00Z',
    views: 450000,
    likes: 32000,
    velocity: 3000,
    score: 76,
    category: 'celebrity',
    thumbnail: celebImg,
    entity: 'MrBeast'
  }
];

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'success' | 'error';
  message: string;
  module?: string;
}

export const MOCK_LOGS: LogEntry[] = [
  { id: '1', timestamp: '10:45:22', level: 'info', message: 'System initialization complete.', module: 'system' },
  { id: '2', timestamp: '10:45:23', level: 'info', message: 'Loading configuration from entities.yaml...', module: 'config' },
  { id: '3', timestamp: '10:45:25', level: 'success', message: 'Connected to YouTube Data API v3.', module: 'network' },
  { id: '4', timestamp: '10:46:01', level: 'info', message: 'Scanning Category: Hip Hop [Drake, Kendrick...]', module: 'scanner' },
  { id: '5', timestamp: '10:46:05', level: 'success', message: 'Found 12 new candidates for "Drake".', module: 'scanner' },
  { id: '6', timestamp: '10:46:08', level: 'warn', message: 'Rate limit approaching (85%). Throttling requests.', module: 'network' },
  { id: '7', timestamp: '10:46:12', level: 'info', message: 'Scoring candidate "Drake TALKS Future..."', module: 'scorer' },
  { id: '8', timestamp: '10:46:12', level: 'success', message: 'Score Calculated: 94/100 (Velocity High).', module: 'scorer' },
  { id: '9', timestamp: '10:47:00', level: 'info', message: 'Scanning Category: NBA [LeBron, Curry...]', module: 'scanner' },
  { id: '10', timestamp: '10:47:15', level: 'success', message: 'Discord Webhook sent: "Daily Clip Targets - 3 items".', module: 'notifier' },
  { id: '11', timestamp: '10:47:18', level: 'info', message: 'Scanning Category: Celebrity [Kai Cenat, Rogan...]', module: 'scanner' },
  { id: '12', timestamp: '10:47:22', level: 'error', message: 'Connection timeout: api.tiktok.com (Retrying 1/3)', module: 'network' },
  { id: '13', timestamp: '10:47:25', level: 'info', message: 'Retrying connection to TikTok API...', module: 'network' },
  { id: '14', timestamp: '10:47:28', level: 'success', message: 'TikTok API connection established.', module: 'network' },
  { id: '15', timestamp: '10:47:35', level: 'info', message: 'Processing "Kai Cenat" streams...', module: 'scanner' },
  { id: '16', timestamp: '10:47:42', level: 'info', message: 'Candidate found: "Kai Cenat & Kevin Hart" (Views: 890k)', module: 'scanner' },
  { id: '17', timestamp: '10:47:43', level: 'success', message: 'Score Calculated: 99/100 (Viral Event Detected)', module: 'scorer' },
  { id: '18', timestamp: '10:48:01', level: 'info', message: 'Archiving daily results to SQLite...', module: 'storage' },
  { id: '19', timestamp: '10:48:05', level: 'success', message: 'Database backup completed: clip_trends_2025-12-12.db', module: 'storage' },
  { id: '20', timestamp: '10:48:10', level: 'info', message: 'Waiting for next scheduled interval (60m).', module: 'system' }
];
