import { Service, logger, } from '@elizaos/core';
import '../types'; // Import to register service types
import { createTodoDataService } from './todoDataService';
import { NotificationManager } from './notificationManager';
import { CacheManager } from './cacheManager';
/**
 * Main todo reminder service that handles all reminder functionality
 */
export class TodoReminderService extends Service {
    static serviceType = 'TODO_REMINDER';
    static serviceName = 'TODO_REMINDER';
    capabilityDescription = 'Manages todo reminders and notifications';
    get serviceName() {
        return 'TODO_REMINDER';
    }
    // Configuration with sensible defaults
    reminderConfig = {
        reminderCheckInterval: 30 * 1000, // 30 seconds
        minReminderInterval: 30 * 60 * 1000, // 30 minutes
        upcomingThreshold: 30 * 60 * 1000, // 30 minutes
        dailyReminderHours: [9, 18], // 9 AM and 6 PM
    };
    notificationManager;
    cacheManager;
    reminderTimer = null;
    rolodexService = null;
    lastReminderCheck = new Map(); // Track last reminder time per todo
    static async start(runtime) {
        logger.info('Starting TodoReminderService...');
        const service = new TodoReminderService();
        service.runtime = runtime;
        await service.initialize();
        logger.info('TodoReminderService started successfully');
        return service;
    }
    loadConfiguration() {
        // Load configuration from runtime settings with defaults
        const checkInterval = this.runtime.getSetting('TODO_REMINDER_CHECK_INTERVAL');
        if (checkInterval && typeof checkInterval === 'number') {
            this.reminderConfig.reminderCheckInterval = checkInterval;
        }
        const minInterval = this.runtime.getSetting('TODO_MIN_REMINDER_INTERVAL');
        if (minInterval && typeof minInterval === 'number') {
            this.reminderConfig.minReminderInterval = minInterval;
        }
        const upcomingThreshold = this.runtime.getSetting('TODO_UPCOMING_THRESHOLD');
        if (upcomingThreshold && typeof upcomingThreshold === 'number') {
            this.reminderConfig.upcomingThreshold = upcomingThreshold;
        }
        const dailyHours = this.runtime.getSetting('TODO_DAILY_REMINDER_HOURS');
        if (dailyHours) {
            if (typeof dailyHours === 'string') {
                // Parse comma-separated string like "9,18"
                const hours = dailyHours
                    .split(',')
                    .map((h) => parseInt(h.trim()))
                    .filter((h) => h >= 0 && h <= 23);
                if (hours.length > 0) {
                    this.reminderConfig.dailyReminderHours = hours;
                }
            }
            else if (Array.isArray(dailyHours)) {
                // Use array directly if provided
                const hours = dailyHours.filter((h) => typeof h === 'number' && h >= 0 && h <= 23);
                if (hours.length > 0) {
                    this.reminderConfig.dailyReminderHours = hours;
                }
            }
        }
        logger.info('TodoReminderService configuration loaded:', this.reminderConfig);
    }
    async initialize() {
        // Load configuration from runtime settings
        this.loadConfiguration();
        // Initialize internal managers
        this.notificationManager = new NotificationManager(this.runtime);
        this.cacheManager = new CacheManager();
        // Try to get rolodex service for enhanced entity management (optional)
        try {
            this.rolodexService = this.runtime.getService('rolodex');
            if (this.rolodexService) {
                logger.info('Rolodex service found - enhanced entity management enabled');
            }
            else {
                logger.info('Rolodex service not found - using basic reminder functionality');
            }
        }
        catch (error) {
            logger.warn('Could not initialize rolodex service:', error);
        }
        // Start reminder checking loop
        this.startReminderLoop();
    }
    startReminderLoop() {
        if (this.reminderTimer) {
            clearInterval(this.reminderTimer);
        }
        // Check for reminders at configured interval
        this.reminderTimer = setInterval(() => {
            this.checkTasksForReminders().catch((error) => {
                logger.error('Error in reminder loop:', error);
            });
        }, this.reminderConfig.reminderCheckInterval);
        // Also run immediately on start
        this.checkTasksForReminders().catch((error) => {
            logger.error('Error in initial reminder check:', error);
        });
        logger.info(`Reminder loop started - checking every ${this.reminderConfig.reminderCheckInterval / 1000} seconds`);
    }
    async checkTasksForReminders() {
        try {
            const dataService = createTodoDataService(this.runtime);
            // Get all incomplete todos
            const todos = await dataService.getTodos({ isCompleted: false });
            for (const todo of todos) {
                try {
                    await this.processTodoReminder(todo);
                }
                catch (error) {
                    logger.error(`Error processing reminder for todo ${todo.id}:`, error);
                }
            }
        }
        catch (error) {
            logger.error('Error checking tasks for reminders:', error);
        }
    }
    async processTodoReminder(todo) {
        const now = new Date();
        let shouldRemind = false;
        let reminderType = 'general';
        let priority = 'medium';
        // Check last reminder time to avoid spam
        const lastReminder = this.lastReminderCheck.get(todo.id) || 0;
        const timeSinceLastReminder = now.getTime() - lastReminder;
        if (timeSinceLastReminder < this.reminderConfig.minReminderInterval) {
            return; // Skip if we reminded recently
        }
        // Check if overdue
        if (todo.dueDate && todo.dueDate < now) {
            shouldRemind = true;
            reminderType = 'overdue';
            priority = 'high';
        }
        // Check if upcoming (within configured threshold)
        else if (todo.dueDate) {
            const timeUntilDue = todo.dueDate.getTime() - now.getTime();
            if (timeUntilDue < this.reminderConfig.upcomingThreshold && timeUntilDue > 0) {
                shouldRemind = true;
                reminderType = 'upcoming';
                priority = todo.isUrgent ? 'high' : 'medium';
            }
        }
        // Check daily tasks (remind at configured hours)
        else if (todo.type === 'daily') {
            const hour = now.getHours();
            // Check if current hour matches any configured reminder hours
            if (this.reminderConfig.dailyReminderHours.includes(hour)) {
                // Check if completed today
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (!todo.completedAt || todo.completedAt < today) {
                    shouldRemind = true;
                    reminderType = 'daily';
                    priority = 'low';
                }
            }
        }
        if (shouldRemind) {
            await this.sendReminder(todo, reminderType, priority);
            this.lastReminderCheck.set(todo.id, now.getTime());
        }
    }
    async sendReminder(todo, reminderType, priority) {
        try {
            const title = this.formatReminderTitle(todo, reminderType);
            const body = this.formatReminderBody(todo, reminderType);
            // Always send in-app notification
            await this.notificationManager.queueNotification({
                title,
                body,
                type: reminderType,
                taskId: todo.id,
                roomId: todo.roomId,
                priority,
            });
            // Send message through runtime's messaging system
            try {
                await this.runtime.createMemory({
                    entityId: this.runtime.agentId,
                    roomId: todo.roomId,
                    content: {
                        text: `${title}\n\n${body}`,
                        type: 'reminder',
                        metadata: {
                            todoId: todo.id,
                            todoName: todo.name,
                            reminderType,
                            dueDate: todo.dueDate || undefined,
                            priority,
                        },
                    },
                }, 'messages');
                logger.info(`Sent ${reminderType} reminder message for todo: ${todo.name}`);
            }
            catch (error) {
                logger.error('Failed to send reminder message:', error);
            }
            logger.info(`Sent ${reminderType} reminder for todo: ${todo.name}`);
        }
        catch (error) {
            logger.error(`Error sending reminder for todo ${todo.id}:`, error);
        }
    }
    formatReminderTitle(todo, reminderType) {
        switch (reminderType) {
            case 'overdue':
                return `⚠️ OVERDUE: ${todo.name}`;
            case 'upcoming':
                return `⏰ REMINDER: ${todo.name}`;
            case 'daily':
                return '📅 Daily Reminder';
            default:
                return `📋 Reminder: ${todo.name}`;
        }
    }
    formatReminderBody(todo, reminderType) {
        switch (reminderType) {
            case 'overdue':
                return `Your task "${todo.name}" is overdue. Please complete it when possible.`;
            case 'upcoming':
                return `Your task "${todo.name}" is due soon. Don't forget to complete it!`;
            case 'daily':
                return "Don't forget to complete your daily tasks today!";
            default:
                return `Reminder about your task: ${todo.name}`;
        }
    }
    async processBatchReminders() {
        await this.checkTasksForReminders();
    }
    async stop() {
        if (this.reminderTimer) {
            clearInterval(this.reminderTimer);
            this.reminderTimer = null;
        }
        if (this.notificationManager) {
            await this.notificationManager.stop();
        }
        if (this.cacheManager) {
            await this.cacheManager.stop();
        }
        logger.info('TodoReminderService stopped');
    }
    static async stop(runtime) {
        const service = runtime.getService(TodoReminderService.serviceType);
        if (service) {
            await service.stop();
        }
    }
}
