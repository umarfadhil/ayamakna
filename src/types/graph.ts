export interface QuranVerse {
  surah: number;
  ayah: number;
  surahName: string;
  surahNameAr: string;
}

export interface TopicNode {
  id: string;
  label: string;
  labelId: string; // Indonesian
  labelEn: string; // English
  verse?: QuranVerse;
  explanation?: string;
  explanationId?: string;
  explanationEn?: string;
  tags: string[];
  parentId?: string;
  depth: number; // 0 = center (Al-Qur'an), 1 = topic, 2 = sub-topic, etc.
  createdAt: number;
}

export interface TopicLink {
  source: string;
  target: string;
  type: 'parent-child' | 'same-verse' | 'shared-tag' | 'semantic';
  strength: number; // 0-1
}

export interface GraphData {
  nodes: TopicNode[];
  links: TopicLink[];
}

export interface D3Node extends TopicNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface D3Link {
  source: D3Node | string;
  target: D3Node | string;
  type: 'parent-child' | 'same-verse' | 'shared-tag' | 'semantic';
  strength: number;
}
