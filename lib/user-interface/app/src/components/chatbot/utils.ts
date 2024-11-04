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

export const valorantAgentsMap: { [key: string]: Agent } = {
    'jett': {
        name: 'Jett',
        role: 'Duelist',
        image: '/images/agents/jett.png',
    },
    'phoenix': {
        name: 'Phoenix',
        role: 'Duelist',

        image: '/images/agents/phoenix.png',
    },
    'reyna': {
        name: 'Reyna',
        role: 'Duelist',

        image: '/images/agents/reyna.png',
    },
    'raze': {
        name: 'Raze',
        role: 'Duelist',

        image: '/images/agents/raze.png',
    },
    'yoru': {
        name: 'Yoru',
        role: 'Duelist',

        image: '/images/agents/yoru.png',
    },
    'neon': {
        name: 'Neon',
        role: 'Duelist',

        image: '/images/agents/neon.png',
    },
    'brimstone': {
        name: 'Brimstone',
        role: 'Controller',

        image: '/images/agents/brimstone.png',
    },
    'viper': {
        name: 'Viper',
        role: 'Controller',

        image: '/images/agents/viper.png',
    },
    'omen': {
        name: 'Omen',
        role: 'Controller',

        image: '/images/agents/omen.png',
    },
    'astra': {
        name: 'Astra',
        role: 'Controller',

        image: '/images/agents/astra.png',
    },
    'harbor': {
        name: 'Harbor',
        role: 'Controller',

        image: '/images/agents/harbor.png',
    },
    'sage': {
        name: 'Sage',
        role: 'Sentinel',

        image: '/images/agents/sage.png',
    },
    'cypher': {
        name: 'Cypher',
        role: 'Sentinel',

        image: '/images/agents/cypher.png',
    },
    'killjoy': {
        name: 'Killjoy',
        role: 'Sentinel',

        image: '/images/agents/killjoy.png',
    },
    'chamber': {
        name: 'Chamber',
        role: 'Sentinel',

        image: '/images/agents/chamber.png',
    },
    'skye': {
        name: 'Skye',
        role: 'Initiator',
        image: '/images/agents/skye.png',
    },
    'sova': {
        name: 'Sova',
        role: 'Initiator',
        image: '/images/agents/sova.png',
    },
    'breach': {
        name: 'Breach',
        role: 'Initiator',
        image: '/images/agents/breach.png',
    },
    'kayo': {
        name: 'KAY/O',
        role: 'Initiator',
        image: '/images/agents/kayo.png',
    },
    'fade': {
        name: 'Fade',
        role: 'Initiator',
        image: '/images/agents/fade.png',
    },
    'gekko': {
        name: 'Gekko',
        role: 'Initiator',
        image: '/images/agents/gekko.png',
    },
    'deadlock': {
        name: 'Deadlock',
        role: 'Sentinel',
        image: '/images/agents/deadlock.png',
    },
    'vyse': {
        name: 'Vyse',
        role: 'Sentinel',
        image: '/images/agents/vyse.png',
    },
    'iso': {
        name: 'Iso',
        role: 'Duelist',
        image: '/images/agents/iso.png',
    },
    'clove': {
        name: 'Clove',
        role: 'Controller',
        image: '/images/agents/clove.png',
    },
    'sunburst': {
        name: 'Sunburst',
        role: 'Duelist',
        image: '/images/agents/sunburst.png',
    },
    'titan': {
        name: 'Titan',
        role: 'Controller',
        image: '/images/agents/titan.png',
    },
};



export const valorantMapsMap = {
    'ascent': {
        name: 'Ascent',
        image: '/images/maps/ascent.png',
    },
    'bind': {
        name: 'Bind',
        image: '/images/maps/bind.png',
    },
    'haven': {
        name: 'Haven',
        image: '/images/maps/haven.png',
    },
    'split': {
        name: 'Split',
        image: '/images/maps/split.png',
    },
    'icebox': {
        name: 'Icebox',
        image: '/images/maps/icebox.png',
    },
    'breeze': {
        name: 'Breeze',
        image: '/images/maps/breeze.png',
    },
    'fracture': {
        name: 'Fracture',
        image: '/images/maps/fracture.png',
    },
    'pearl': {
        name: 'Pearl',
        image: '/images/maps/pearl.png',
    },
    'lotus': {
        name: 'Lotus',
        image: '/images/maps/lotus.png',
    },
    'sunset': {
        name: 'Sunset',
        image: '/images/maps/sunset.png',
    },
};

