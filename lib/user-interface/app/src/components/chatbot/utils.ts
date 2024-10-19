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
    .join(' ');
}

export function removeAngleBracketContent(input: string): string {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }
  
  return input.replace(/<[^>]*>/g, '');
}