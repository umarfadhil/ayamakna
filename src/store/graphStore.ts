import { TopicNode, TopicLink, GraphData } from '@/types/graph';

const STORAGE_KEY = 'ayamakna-graph-data';

// Extract keywords from text for auto-tagging
export function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'this', 'that', 'these',
    'those', 'it', 'its', 'from', 'as', 'not', 'no', 'nor', 'so', 'if',
    'dan', 'di', 'ke', 'dari', 'yang', 'ini', 'itu', 'adalah', 'dengan',
    'untuk', 'pada', 'tidak', 'akan', 'juga', 'atau', 'oleh', 'ada',
    'tentang', 'dalam', 'telah', 'sudah', 'belum', 'bisa', 'dapat',
  ]);

  const words = text.toLowerCase()
    .replace(/[^a-zA-Z\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  return [...new Set(words)];
}

// Generate auto-links based on shared verses, tags, or semantic similarity
function generateAutoLinks(nodes: TopicNode[]): TopicLink[] {
  const links: TopicLink[] = [];
  const linkSet = new Set<string>();

  const addLink = (source: string, target: string, type: TopicLink['type'], strength: number) => {
    const key = [source, target].sort().join('-');
    if (!linkSet.has(key) && source !== target) {
      linkSet.add(key);
      links.push({ source, target, type, strength });
    }
  };

  // Parent-child links
  for (const node of nodes) {
    if (node.parentId) {
      addLink(node.parentId, node.id, 'parent-child', 1);
    }
  }

  // Same verse links
  const verseMap = new Map<string, string[]>();
  for (const node of nodes) {
    if (node.verse) {
      const key = `${node.verse.surah}:${node.verse.ayah}`;
      if (!verseMap.has(key)) verseMap.set(key, []);
      verseMap.get(key)!.push(node.id);
    }
  }
  for (const ids of verseMap.values()) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        addLink(ids[i], ids[j], 'same-verse', 0.8);
      }
    }
  }

  // Shared tag links
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const shared = nodes[i].tags.filter(t => nodes[j].tags.includes(t));
      if (shared.length > 0) {
        const strength = Math.min(shared.length * 0.3, 0.9);
        addLink(nodes[i].id, nodes[j].id, 'shared-tag', strength);
      }
    }
  }

  return links;
}

// Center node
const CENTER_NODE: TopicNode = {
  id: 'center',
  label: 'Al-Qur\'an',
  labelId: 'Al-Qur\'an',
  labelEn: 'The Holy Quran',
  tags: ['quran', 'islam', 'revelation'],
  depth: 0,
  createdAt: Date.now(),
};

// Sample data for initial state
const SAMPLE_NODES: TopicNode[] = [
  {
    id: 'taqwa',
    label: 'Taqwa',
    labelId: 'Ketakwaan',
    labelEn: 'God-consciousness',
    verse: { surah: 2, ayah: 197, surahName: "Al-Baqarah", surahNameAr: "البقرة" },
    explanation: 'The essence of spiritual awareness and consciousness of Allah in every action.',
    explanationId: 'Inti dari kesadaran spiritual dan kesadaran akan Allah dalam setiap tindakan.',
    explanationEn: 'The essence of spiritual awareness and consciousness of Allah in every action.',
    tags: ['taqwa', 'piety', 'consciousness', 'spiritual'],
    parentId: 'center',
    depth: 1,
    createdAt: Date.now(),
  },
  {
    id: 'sabr',
    label: 'Sabr',
    labelId: 'Kesabaran',
    labelEn: 'Patience',
    verse: { surah: 2, ayah: 153, surahName: "Al-Baqarah", surahNameAr: "البقرة" },
    explanation: 'Patient perseverance in the face of trials, a cornerstone of faith.',
    explanationId: 'Ketabahan dalam menghadapi ujian, landasan iman.',
    explanationEn: 'Patient perseverance in the face of trials, a cornerstone of faith.',
    tags: ['patience', 'perseverance', 'trial', 'faith'],
    parentId: 'center',
    depth: 1,
    createdAt: Date.now(),
  },
  {
    id: 'tawakkul',
    label: 'Tawakkul',
    labelId: 'Tawakal',
    labelEn: 'Reliance on Allah',
    verse: { surah: 3, ayah: 159, surahName: "Ali 'Imran", surahNameAr: "آل عمران" },
    explanation: 'Trusting in Allah\'s plan after doing your best effort.',
    explanationId: 'Percaya pada rencana Allah setelah berusaha sebaik mungkin.',
    explanationEn: 'Trusting in Allah\'s plan after doing your best effort.',
    tags: ['trust', 'reliance', 'faith', 'effort'],
    parentId: 'center',
    depth: 1,
    createdAt: Date.now(),
  },
  {
    id: 'ihsan',
    label: 'Ihsan',
    labelId: 'Kebaikan',
    labelEn: 'Excellence',
    verse: { surah: 55, ayah: 60, surahName: "Ar-Rahman", surahNameAr: "الرحمن" },
    explanation: 'To worship Allah as if you see Him, and if you cannot see Him, know that He sees you.',
    explanationId: 'Beribadah kepada Allah seolah-olah kamu melihat-Nya.',
    explanationEn: 'To worship Allah as if you see Him, and if you cannot see Him, know that He sees you.',
    tags: ['excellence', 'worship', 'spiritual', 'consciousness'],
    parentId: 'center',
    depth: 1,
    createdAt: Date.now(),
  },
  {
    id: 'dhikr',
    label: 'Dhikr',
    labelId: 'Dzikir',
    labelEn: 'Remembrance',
    verse: { surah: 13, ayah: 28, surahName: "Ar-Ra'd", surahNameAr: "الرعد" },
    explanation: 'Verily, in the remembrance of Allah do hearts find rest.',
    explanationId: 'Sesungguhnya dengan mengingat Allah, hati menjadi tenang.',
    explanationEn: 'Verily, in the remembrance of Allah do hearts find rest.',
    tags: ['remembrance', 'heart', 'peace', 'spiritual'],
    parentId: 'center',
    depth: 1,
    createdAt: Date.now(),
  },
  {
    id: 'salah-taqwa',
    label: 'Salah & Taqwa',
    labelId: 'Shalat & Ketakwaan',
    labelEn: 'Prayer & God-consciousness',
    verse: { surah: 29, ayah: 45, surahName: "Al-'Ankabut", surahNameAr: "العنكبوت" },
    explanation: 'Prayer prevents from immorality and wrongdoing.',
    explanationId: 'Shalat mencegah dari perbuatan keji dan mungkar.',
    explanationEn: 'Prayer prevents from immorality and wrongdoing.',
    tags: ['prayer', 'taqwa', 'prevention', 'spiritual'],
    parentId: 'taqwa',
    depth: 2,
    createdAt: Date.now(),
  },
];

export function loadGraphData(): GraphData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored) as GraphData;
      // Ensure center node exists
      if (!data.nodes.find(n => n.id === 'center')) {
        data.nodes.unshift(CENTER_NODE);
      }
      data.links = generateAutoLinks(data.nodes);
      return data;
    }
  } catch (e) {
    console.error('Failed to load graph data', e);
  }

  const nodes = [CENTER_NODE, ...SAMPLE_NODES];
  const links = generateAutoLinks(nodes);
  return { nodes, links };
}

export function saveGraphData(data: GraphData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save graph data', e);
  }
}

export function addTopic(
  data: GraphData,
  topic: Omit<TopicNode, 'id' | 'createdAt' | 'tags'>
): GraphData {
  const id = `topic-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const allText = [topic.labelEn, topic.labelId, topic.explanation || ''].join(' ');
  const tags = extractKeywords(allText);

  const newNode: TopicNode = {
    ...topic,
    id,
    tags,
    createdAt: Date.now(),
  };

  const nodes = [...data.nodes, newNode];
  const links = generateAutoLinks(nodes);
  const newData = { nodes, links };
  saveGraphData(newData);
  return newData;
}

export function deleteTopic(data: GraphData, id: string): GraphData {
  if (id === 'center') return data;
  // Also remove children recursively
  const idsToRemove = new Set<string>();
  const collectChildren = (parentId: string) => {
    idsToRemove.add(parentId);
    data.nodes.filter(n => n.parentId === parentId).forEach(n => collectChildren(n.id));
  };
  collectChildren(id);

  const nodes = data.nodes.filter(n => !idsToRemove.has(n.id));
  const links = generateAutoLinks(nodes);
  const newData = { nodes, links };
  saveGraphData(newData);
  return newData;
}
