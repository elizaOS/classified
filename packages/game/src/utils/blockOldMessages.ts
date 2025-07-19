// Block old WebSocket messages
export function blockOldMessages() {
  console.log('🛡️ Installing message blocker...');
  
  // Check if Socket.IO is loaded
  const checkAndBlock = () => {
    if ((window as any).io && (window as any).io.Socket) {
      const OriginalSocket = (window as any).io.Socket;
      const originalEmit = OriginalSocket.prototype.emit;
      
      OriginalSocket.prototype.emit = function(event: string, ...args: any[]) {
        // Block any SEND_MESSAGE events
        if (event === 'SEND_MESSAGE') {
          console.error('🚫 BLOCKED SEND_MESSAGE event!', args);
          console.trace();
          
          // Check if this is the problematic message
          const dataStr = JSON.stringify(args);
          if (dataStr.includes('admin has opened the terminal')) {
            console.error('🚨 BLOCKED THE PROBLEMATIC MESSAGE!');
            return; // Don't send it
          }
        }
        
        // Allow other events
        return originalEmit.apply(this, [event, ...args]);
      };
      
      console.log('✅ Message blocker installed');
    } else {
      // Try again in 100ms
      setTimeout(checkAndBlock, 100);
    }
  };
  
  checkAndBlock();
} 