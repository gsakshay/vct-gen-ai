import {
  ChatBotHistoryItem,
  ChatBotMessageType,
} from "./types";


function pairwise(arr: ChatBotHistoryItem[], func) {
  for (var i = 0; i < arr.length - 1; i++) {
    func(arr[i], arr[i + 1])
  }
}

/**Assembles local message history copy into a format suitable for the chat API */
export function assembleHistory(history: ChatBotHistoryItem[]) {
  var hist: Object[] = [];
  for (var i = 0; i < history.length - 1; i++) {
    if (history[i].type == ChatBotMessageType.Human) {
      hist.push({ "user": history[i].content, "chatbot": history[i+1].content, "metadata" : JSON.stringify(history[i+1].metadata)})
    }
  }

  return hist;
}

export function formatThinkingString(input: string): string {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }

  return input
    .replace(/^\*+|\*+$/g, '')
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ') + '...';
}

export function removeAngleBracketContent(input: string): string {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }

  return input.replace(/<[^>]*>/g, '');
}

// AGENTS 

interface Agent {
    name: string;
    role: 'Duelist' | 'Controller' | 'Sentinel' | 'Initiator';
    image: string;
}

const valorantAgentsMap: { [key: string]: Agent } = {
    'jett': {
        name: 'Jett',
        role: 'Duelist',
        image: '/images/jett.webp',
    },
    'phoenix': {
        name: 'Phoenix',
        role: 'Duelist',
        image: '/images/phoenix.webp',
    },
    'reyna': {
        name: 'Reyna',
        role: 'Duelist',
        image: '/images/reyna.webp',
    },
    'raze': {
        name: 'Raze',
        role: 'Duelist',
        image: '/images/raze.webp',
    },
    'yoru': {
        name: 'Yoru',
        role: 'Duelist',
        image: '/images/yoru.webp',
    },
    'neon': {
        name: 'Neon',
        role: 'Duelist',
        image: '/images/neon.webp',
    },
    'brimstone': {
        name: 'Brimstone',
        role: 'Controller',
        image: '/images/brimstone.webp',
    },
    'viper': {
        name: 'Viper',
        role: 'Controller',
        image: '/images/viper.webp',
    },
    'omen': {
        name: 'Omen',
        role: 'Controller',
        image: '/images/omen.webp',
    },
    'astra': {
        name: 'Astra',
        role: 'Controller',
        image: '/images/astra.webp',
    },
    'harbor': {
        name: 'Harbor',
        role: 'Controller',
        image: '/images/harbor.webp',
    },
    'sage': {
        name: 'Sage',
        role: 'Sentinel',
        image: '/images/sage.webp',
    },
    'cypher': {
        name: 'Cypher',
        role: 'Sentinel',
        image: '/images/cypher.webp',
    },
    'killjoy': {
        name: 'Killjoy',
        role: 'Sentinel',
        image: '/images/killjoy.webp',
    },
    'chamber': {
        name: 'Chamber',
        role: 'Sentinel',
        image: '/images/chamber.webp',
    },
    'skye': {
        name: 'Skye',
        role: 'Initiator',
        image: '/images/skye.webp',
    },
    'sova': {
        name: 'Sova',
        role: 'Initiator',
        image: '/images/sova.webp',
    },
    'breach': {
        name: 'Breach',
        role: 'Initiator',
        image: '/images/breach.webp',
    },
    'kayo': {
        name: 'KAY/O',
        role: 'Initiator',
        image: '/images/kayo.webp',
    },
    'fade': {
        name: 'Fade',
        role: 'Initiator',
        image: '/images/fade.webp',
    },
    'gekko': {
        name: 'Gekko',
        role: 'Initiator',
        image: '/images/gekko.webp',
    },
    'deadlock': {
        name: 'Deadlock',
        role: 'Sentinel',
        image: '/images/deadlock.webp',
    }
};

export default valorantAgentsMap;
