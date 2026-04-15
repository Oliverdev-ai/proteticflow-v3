export type ChatbotConversation = {
  id: number;
  tenantId: number;
  clientId: number | null;
  type: 'status_query' | 'scheduling' | 'quote' | 'technical_support' | 'general' | 'complaint';
  status: 'open' | 'escalated' | 'resolved' | 'closed';
  satisfactionScore: number | null;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
};

export type ChatbotMessage = {
  id: number;
  conversationId: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  intentDetected: string | null;
  createdAt: string;
};

export type SupportTicket = {
  id: number;
  tenantId: number;
  clientId: number | null;
  conversationId: number | null;
  assignedToUserId: number | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  subject: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type TicketMessage = {
  id: number;
  ticketId: number;
  authorId: number | null;
  content: string;
  isInternal: boolean;
  createdAt: string;
};

export type AutoResponseTemplate = {
  id: number;
  tenantId: number;
  intent: string;
  title: string;
  body: string;
  isActive: boolean;
};

export type SupportSuggestionCategory =
  | 'product'
  | 'ux'
  | 'performance'
  | 'financial'
  | 'support'
  | 'other';

export type SupportSuggestionImpact = 'low' | 'medium' | 'high';

export type SupportSuggestionStatus = 'received' | 'reviewing' | 'implemented' | 'rejected';

export type SupportSuggestion = {
  id: number;
  tenantId: number;
  authorUserId: number;
  title: string;
  description: string;
  category: SupportSuggestionCategory;
  perceivedImpact: SupportSuggestionImpact;
  status: SupportSuggestionStatus;
  createdAt: string;
  updatedAt: string;
};
