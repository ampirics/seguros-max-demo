// Test simple para verificar el API client

// Verificar que las URLs estén correctas

// Simular un test del API client
const testMessage = {
  sender: "admin",
  message: "Test message",
  is_read: false
}


// Test del endpoint URL construction
const conversationId = "test-conversation-id"
const endpoint = `/chat/conversations/${conversationId}/messages`

// Test WhatsApp endpoint
const whatsappEndpoint = `/chat/conversations/${conversationId}/send-whatsapp`
