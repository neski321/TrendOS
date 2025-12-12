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
}

export const MOCK_LOGS: LogEntry[] = [
  { id: '1', timestamp: '10:45:22', level: 'info', message: 'System initialization complete.' },
  { id: '2', timestamp: '10:45:23', level: 'info', message: 'Loading configuration from entities.yaml...' },
  { id: '3', timestamp: '10:45:25', level: 'success', message: 'Connected to YouTube Data API v3.' },
  { id: '4', timestamp: '10:46:01', level: 'info', message: 'Scanning Category: Hip Hop [Drake, Kendrick...]' },
  { id: '5', timestamp: '10:46:05', level: 'success', message: 'Found 12 new candidates for "Drake".' },
  { id: '6', timestamp: '10:46:08', level: 'warn', message: 'Rate limit approaching (85%). Throttling requests.' },
  { id: '7', timestamp: '10:46:12', level: 'info', message: 'Scoring candidate "Drake TALKS Future..."' },
  { id: '8', timestamp: '10:46:12', level: 'success', message: 'Score Calculated: 94/100 (Velocity High).' },
  { id: '9', timestamp: '10:47:00', level: 'info', message: 'Scanning Category: NBA [LeBron, Curry...]' },
  { id: '10', timestamp: '10:47:15', level: 'success', message: 'Discord Webhook sent: "Daily Clip Targets - 3 items".' },
];
