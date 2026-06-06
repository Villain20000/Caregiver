export interface ChannelMember {
  userId: string;
  role: 'owner' | 'admin' | 'member';
  lastRead?: string;
}

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  text: string;
  timestamp: string;        // ISO
  edited?: boolean;
  reactions?: { emoji: string; userIds: string[] }[];
  attachments?: { name: string; size: number; kind: 'image' | 'pdf' | 'audio' | 'file' }[];
  system?: boolean;
}

export type ChannelKind = 'care-team' | 'family' | 'clinical' | 'ops' | 'direct';

export interface Channel {
  id: string;
  name: string;
  kind: ChannelKind;
  members: ChannelMember[];
  unread: number;
  lastMessage?: Message;
  pinned?: boolean;
  topic?: string;
  encrypted: boolean;
}
