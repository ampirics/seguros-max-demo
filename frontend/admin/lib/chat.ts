export interface ChatMessage {
  id: string
  conversationId: string
  sender: "user" | "admin"
  message: string
  timestamp: Date
  read: boolean
}

export interface Conversation {
  id: string
  customerName: string
  customerPhone: string
  lastMessage: string
  lastMessageTime: Date
  unreadCount: number
  status: "active" | "pending" | "closed"
}

const CONVERSATIONS_KEY = "admin_conversations"
const MESSAGES_KEY = "admin_messages"

export function getConversations(): Conversation[] {
  if (typeof window === "undefined") return []
  const conversations = localStorage.getItem(CONVERSATIONS_KEY)
  return conversations ? JSON.parse(conversations) : []
}

export function saveConversations(conversations: Conversation[]): void {
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations))
}

export function getMessages(conversationId: string): ChatMessage[] {
  if (typeof window === "undefined") return []
  const messages = localStorage.getItem(MESSAGES_KEY)
  const allMessages: ChatMessage[] = messages ? JSON.parse(messages) : []
  return allMessages.filter((msg) => msg.conversationId === conversationId)
}

export function saveMessage(message: Omit<ChatMessage, "id">): ChatMessage {
  const messages = getAllMessages()
  const newMessage: ChatMessage = {
    ...message,
    id: Date.now().toString(),
  }
  messages.push(newMessage)
  localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages))

  // Update conversation
  updateConversationLastMessage(message.conversationId, message.message, message.timestamp)

  return newMessage
}

function getAllMessages(): ChatMessage[] {
  if (typeof window === "undefined") return []
  const messages = localStorage.getItem(MESSAGES_KEY)
  return messages ? JSON.parse(messages) : []
}

function updateConversationLastMessage(conversationId: string, message: string, timestamp: Date): void {
  const conversations = getConversations()
  const index = conversations.findIndex((c) => c.id === conversationId)

  if (index !== -1) {
    conversations[index].lastMessage = message
    conversations[index].lastMessageTime = timestamp
    saveConversations(conversations)
  }
}

export function createConversation(customerName: string, customerPhone: string, initialMessage: string): Conversation {
  const conversations = getConversations()
  const newConversation: Conversation = {
    id: Date.now().toString(),
    customerName,
    customerPhone,
    lastMessage: initialMessage,
    lastMessageTime: new Date(),
    unreadCount: 1,
    status: "pending",
  }

  conversations.unshift(newConversation)
  saveConversations(conversations)

  // Save initial message
  saveMessage({
    conversationId: newConversation.id,
    sender: "user",
    message: initialMessage,
    timestamp: new Date(),
    read: false,
  })

  return newConversation
}

export function markConversationAsRead(conversationId: string): void {
  const conversations = getConversations()
  const index = conversations.findIndex((c) => c.id === conversationId)

  if (index !== -1) {
    conversations[index].unreadCount = 0
    saveConversations(conversations)
  }

  // Mark messages as read
  const messages = getAllMessages()
  const updatedMessages = messages.map((msg) => (msg.conversationId === conversationId ? { ...msg, read: true } : msg))
  localStorage.setItem(MESSAGES_KEY, JSON.stringify(updatedMessages))
}

export function updateConversationStatus(conversationId: string, status: Conversation["status"]): void {
  const conversations = getConversations()
  const index = conversations.findIndex((c) => c.id === conversationId)

  if (index !== -1) {
    conversations[index].status = status
    saveConversations(conversations)
  }
}

// Initialize with sample conversations
export function initializeChat(): void {
  const existingConversations = getConversations()
  if (existingConversations.length === 0) {
    const sampleConversations: Conversation[] = [
      {
        id: "1",
        customerName: "María González",
        customerPhone: "+1 (809) 123-4567",
        lastMessage: "Hola, me interesa el polo azul en talla M",
        lastMessageTime: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
        unreadCount: 1,
        status: "pending",
      },
      {
        id: "2",
        customerName: "Carlos Rodríguez",
        customerPhone: "+1 (809) 987-6543",
        lastMessage: "¿Tienen disponibilidad en talla XL?",
        lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
        unreadCount: 0,
        status: "active",
      },
    ]

    saveConversations(sampleConversations)

    // Add sample messages
    const sampleMessages: ChatMessage[] = [
      {
        id: "1",
        conversationId: "1",
        sender: "user",
        message: "Hola, me interesa el polo azul en talla M",
        timestamp: new Date(Date.now() - 1000 * 60 * 30),
        read: false,
      },
      {
        id: "2",
        conversationId: "2",
        sender: "user",
        message: "¿Tienen disponibilidad en talla XL?",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
        read: true,
      },
      {
        id: "3",
        conversationId: "2",
        sender: "admin",
        message: "¡Hola Carlos! Sí, tenemos disponibilidad en talla XL. ¿Te interesa algún color en particular?",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 1.5),
        read: true,
      },
    ]

    localStorage.setItem(MESSAGES_KEY, JSON.stringify(sampleMessages))
  }
}
