import { useEffect, useState } from 'react';

const bootMessages = [
    'BIOS v1.0.0',
    'Checking system memory... OK',
    'Loading Terminal OS...',
    '',
    ' ████████╗███████╗██████╗ ███╗   ███╗██╗███╗   ██╗ █████╗ ██╗     ',
    ' ╚══██╔══╝██╔════╝██╔══██╗████╗ ████║██║████╗  ██║██╔══██╗██║     ',
    '    ██║   █████╗  ██████╔╝██╔████╔██║██║██╔██╗ ██║███████║██║     ',
    '    ██║   ██╔══╝  ██╔══██╗██║╚██╔╝██║██║██║╚██╗██║██╔══██║██║     ',
    '    ██║   ███████╗██║  ██║██║ ╚═╝ ██║██║██║ ╚████║██║  ██║███████╗',
    '    ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝',
    '',
    'Initializing AI subsystem...',
    'Loading neural network...',
    'Establishing secure connection...',
    'Connecting to agent...',
    'System ready.',
    'Welcome to Terminal AI v1.0'
];

interface BootSequenceProps {
    onComplete: () => void;
}

export default function BootSequence({ onComplete }: BootSequenceProps) {
    const [visibleLines, setVisibleLines] = useState<number>(0);
    const [showCursor, setShowCursor] = useState(true);

    useEffect(() => {
        console.log('[BootSequence] Starting boot sequence');
        
        // Show lines one by one
        const lineTimer = setInterval(() => {
            setVisibleLines(prev => {
                const nextValue = prev + 1;
                console.log(`[BootSequence] Showing line ${nextValue}/${bootMessages.length}`);
                
                if (prev >= bootMessages.length) {
                    console.log('[BootSequence] All messages shown, clearing timer');
                    clearInterval(lineTimer);
                    // Complete boot sequence after showing all messages
                    console.log('[BootSequence] Calling onComplete in 1 second');
                    setTimeout(() => {
                        console.log('[BootSequence] Calling onComplete callback');
                        onComplete();
                    }, 1000);
                    return prev;
                }
                return nextValue;
            });
        }, 150);

        // Cursor blink
        const cursorTimer = setInterval(() => {
            setShowCursor(prev => !prev);
        }, 500);

        return () => {
            console.log('[BootSequence] Cleaning up timers');
            clearInterval(lineTimer);
            clearInterval(cursorTimer);
        };
    }, [onComplete]);

    return (
        <div className="boot-screen">
            <div className="boot-content">
                {bootMessages.slice(0, visibleLines).map((message, index) => (
                    <div key={index} className="boot-line glow">
                        {message}
                    </div>
                ))}
                {showCursor && <span className="cursor-blink">█</span>}
            </div>
        </div>
    );
} 