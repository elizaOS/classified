import React, { useState, useEffect, useRef } from 'react';
import {
    Box,
    TextField,
    Button,
    Typography,
    CircularProgress,
    Dialog as MuiDialog,
    DialogTitle as MuiDialogTitle,
    DialogContent as MuiDialogContent,
    DialogActions as MuiDialogActions,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useElizaClient } from '../hooks/useElizaClient';
import { v4 as uuidv4 } from 'uuid';
import { MobileMenu } from './MobileMenu';

interface OutputLine {
    type: 'user' | 'agent' | 'system' | 'error';
    content: string;
    timestamp: Date;
}

export const Terminal: React.FC = () => {
    const [input, setInput] = useState('');
    const [output, setOutput] = useState<OutputLine[]>([
        {
            type: 'system',
            content: 'Initializing secure connection...',
            timestamp: new Date(),
        },
    ]);
    const [isTyping] = useState(false);
    const [, setIsWaitingForResponse] = useState(false);
    const [apiConfig, setApiConfig] = useState({
        baseUrl: 'http://localhost:3000',
        apiKey: '',
    });
    const [userId] = useState(() => {
        const stored = localStorage.getItem('terminal-user-id');
        if (stored) return stored;
        const newId = uuidv4();
        localStorage.setItem('terminal-user-id', newId);
        return newId;
    });

    const containerRef = useRef<HTMLDivElement>(null);
    const historyPosition = useRef<number>(-1);
    const commandHistory = useRef<string[]>([]);
    const lastAgentMessageRef = useRef<string>('');

    const {
        isConnected,
        sendMessage,
        error,
        isLoading,
    } = useElizaClient({
        baseUrl: apiConfig.baseUrl,
        userId,
        onMessage: (message) => {
            // Handle incoming messages - add to output if it's not from the current user
            if (message.authorId !== userId) {
                setOutput((prev) => [
                    ...prev,
                    {
                        type: 'agent',
                        content: message.content,
                        timestamp: message.timestamp,
                    },
                ]);
                lastAgentMessageRef.current = message.content;
            }
        },
        onConnectionChange: (connected) => {
            if (connected) {
                setOutput((prev) => [
                    ...prev,
                    {
                        type: 'system',
                        content: '✓ Connected to ElizaOS',
                        timestamp: new Date(),
                    },
                ]);
            } else {
                setOutput((prev) => [
                    ...prev,
                    {
                        type: 'error',
                        content: '✗ Disconnected from ElizaOS',
                        timestamp: new Date(),
                    },
                ]);
            }
        },
    });

    // Show connection status on mount
    useEffect(() => {
        if (isLoading) {
            setOutput((prev) => [
                ...prev,
                {
                    type: 'system',
                    content: 'Setting up secure channel...',
                    timestamp: new Date(),
                },
            ]);
        }
    }, [isLoading]);

    // Show errors
    useEffect(() => {
        if (error) {
            setOutput((prev) => [
                ...prev,
                {
                    type: 'error',
                    content: `Error: ${error}`,
                    timestamp: new Date(),
                },
            ]);
        }
    }, [error]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !isConnected) return;

        const trimmedInput = input.trim();
        commandHistory.current.push(trimmedInput);
        historyPosition.current = -1;

        setOutput((prev) => [
            ...prev,
            {
                type: 'user',
                content: trimmedInput,
                timestamp: new Date(),
            },
        ]);

        setInput('');
        setIsWaitingForResponse(true);

        // Send message using the API client
        try {
            await sendMessage(trimmedInput);
        } catch (err) {
            console.error('Failed to send message:', err);
            setOutput((prev) => [
                ...prev,
                {
                    type: 'error',
                    content: 'Failed to send message. Please try again.',
                    timestamp: new Date(),
                },
            ]);
        } finally {
            setIsWaitingForResponse(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSubmit(e);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (historyPosition.current < commandHistory.current.length - 1) {
                historyPosition.current++;
                setInput(commandHistory.current[historyPosition.current]);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyPosition.current > -1) {
                historyPosition.current--;
                if (historyPosition.current === -1) {
                    setInput('');
                } else {
                    setInput(commandHistory.current[historyPosition.current]);
                }
            }
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInput(e.target.value);
    };

    const handleSettingsClick = () => {
        setIsSettingsDialogOpen(true);
    };

    const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                bgcolor: 'background.paper',
                borderRadius: 2,
                overflow: 'hidden',
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    p: 1,
                    bgcolor: 'primary.main',
                    color: 'white',
                    borderRadius: 2,
                }}
            >
                <Typography variant="h6" component="h1" sx={{ ml: 1 }}>
                    ElizaOS Terminal
                </Typography>
                <Button
                    variant="contained"
                    onClick={handleSettingsClick}
                    sx={{ mr: 1 }}
                >
                    Settings
                </Button>
            </Box>

            <Box
                ref={containerRef}
                sx={{
                    flexGrow: 1,
                    overflowY: 'auto',
                    p: 2,
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                {output.map((line, index) => (
                    <Box
                        key={index}
                        sx={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            mb: 1,
                        }}
                    >
                        <Box
                            sx={{
                                mr: 1,
                                width: 20,
                                height: 20,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '50%',
                                bgcolor:
                                    line.type === 'user'
                                        ? 'primary.main'
                                        : line.type === 'agent'
                                            ? 'success.main'
                                            : line.type === 'system'
                                                ? 'info.main'
                                                : 'error.main',
                                color: 'white',
                            }}
                        >
                            {line.type === 'user' ? 'U' : line.type === 'agent' ? 'A' : line.type === 'system' ? 'S' : 'E'}
                        </Box>
                        <Typography variant="body1" sx={{ wordBreak: 'break-word' }}>
                            {line.content}
                        </Typography>
                    </Box>
                ))}
                {isTyping && (
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                        <CircularProgress size={20} sx={{ mr: 1 }} />
                        <Typography variant="body2">Eliza is typing...</Typography>
                    </Box>
                )}
                {isLoading && (
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                        <CircularProgress size={20} sx={{ mr: 1 }} />
                        <Typography variant="body2">Loading...</Typography>
                    </Box>
                )}
                {error && (
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, color: 'error.main' }}>
                        <Typography variant="body2">Error: {error}</Typography>
                    </Box>
                )}
            </Box>

            <Box
                sx={{
                    p: 2,
                    display: 'flex',
                    alignItems: 'center',
                    bgcolor: 'primary.light',
                    borderTop: '1px solid',
                    borderColor: 'primary.dark',
                }}
            >
                <TextField
                    fullWidth
                    variant="outlined"
                    size="small"
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    InputProps={{
                        endAdornment: (
                            <Button
                                variant="contained"
                                onClick={handleSubmit}
                                disabled={!input.trim() || !isConnected || isLoading || isTyping}
                                sx={{ ml: 1 }}
                            >
                                Send
                            </Button>
                        ),
                    }}
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            pr: 1,
                        },
                    }}
                />
            </Box>

            <MobileMenu />

            <SettingsDialog
                open={isSettingsDialogOpen}
                onClose={() => setIsSettingsDialogOpen(false)}
                apiConfig={apiConfig}
                setApiConfig={setApiConfig}
            />
        </Box>
    );
};

interface SettingsDialogProps {
    open: boolean;
    onClose: () => void;
    apiConfig: {
        baseUrl: string;
        apiKey: string;
    };
    setApiConfig: (config: { baseUrl: string; apiKey: string }) => void;
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({
    open,
    onClose,
    apiConfig,
    setApiConfig,
}) => {
    const [baseUrl, setBaseUrl] = useState(apiConfig.baseUrl);
    const [apiKey, setApiKey] = useState(apiConfig.apiKey);

    const handleSave = () => {
        setApiConfig({ baseUrl, apiKey });
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>Settings</DialogTitle>
            <DialogContent>
                <TextField
                    label="Base URL"
                    fullWidth
                    margin="normal"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                />
                <TextField
                    label="API Key"
                    fullWidth
                    margin="normal"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="primary">
                    Cancel
                </Button>
                <Button onClick={handleSave} color="primary">
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    );
};

const Dialog = styled(MuiDialog)(({ theme }) => ({
    '& .MuiDialog-paper': {
        borderRadius: 4,
        padding: theme.spacing(2),
    },
}));

const DialogTitle = styled(MuiDialogTitle)(({ theme }) => ({
    fontSize: '1.25rem',
    fontWeight: 600,
    color: theme.palette.primary.main,
}));

const DialogContent = styled(MuiDialogContent)(({ theme }) => ({
    padding: theme.spacing(2),
}));

const DialogActions = styled(MuiDialogActions)(({ theme }) => ({
    padding: theme.spacing(2),
})); 