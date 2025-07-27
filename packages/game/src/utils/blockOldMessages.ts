// Block old WebSocket messages
export function blockOldMessages() {
  console.log('🛡️ Installing WebSocket message blocker...');

  // Intercept WebSocket send method
  const originalSend = WebSocket.prototype.send;

  WebSocket.prototype.send = function (data: string | ArrayBufferLike | Blob | ArrayBufferView) {
    // Try to parse and check the message
    try {
      let message: any;
      if (typeof data === 'string') {
        message = JSON.parse(data);
      }

      // Block specific message types or content
      if (message && message.type === 'send_message') {
        const messageText = message.message?.text || '';
        if (messageText.includes('admin has opened the terminal')) {
          console.error('🚫 BLOCKED problematic message!', message);
          console.trace();
          return; // Don't send it
        }
      }
    } catch (_e) {
      // Not JSON or couldn't parse, let it through
    }

    // Allow other messages
    return originalSend.apply(this, [data]);
  };

  console.log('✅ WebSocket message blocker installed');
}
