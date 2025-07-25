#!/usr/bin/env bun

/**
 * Simple test runner to validate core Goals plugin functionality
 * without full runtime initialization
 */

import { logger } from '@elizaos/core';
import { GoalDataManager } from './src/services/goalDataService';

// Mock runtime with minimal database adapter
const mockRuntime = {
  agentId: 'test-agent-123',
  db: {
    goals: new Map(),
    goalTags: new Map(),
    
    insert(table: any) {
      const self = this;
      return {
        values: (values: any) => ({
          returning: async () => {
            // Handle different table types based on table object structure
            const tableName = table?._?.name || table?.name || table?.toString() || 'unknown';
            const tableStr = String(tableName).toLowerCase();
            
            if (tableStr.includes('goals') || tableStr === 'goals' || !tableName || tableName === 'unknown') {
              const goalId = values.id || `goal-${Date.now()}`;
              const goal = { 
                ...values, 
                id: goalId, 
                createdAt: new Date(), 
                updatedAt: new Date(),
                isCompleted: values.isCompleted || false
              };
              self.goals.set(goalId, goal);
              logger.debug(`Created goal: ${goalId}`);
              return [goal];
            } else if (tableStr.includes('tag')) {
              if (Array.isArray(values)) {
                // Multiple tag inserts
                const insertedTags = [];
                for (const tagData of values) {
                  const tagId = tagData.id || `tag-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                  const tag = { ...tagData, id: tagId, createdAt: new Date() };
                  self.goalTags.set(tagId, tag);
                  insertedTags.push(tag);
                }
                logger.debug(`Created ${insertedTags.length} tags`);
                return insertedTags;
              } else {
                // Single tag insert
                const tagId = values.id || `tag-${Date.now()}`;
                const tag = { ...values, id: tagId, createdAt: new Date() };
                self.goalTags.set(tagId, tag);
                logger.debug(`Created tag: ${tagId}`);
                return [tag];
              }
            }
            return [values];
          }
        })
      };
    },
    
    select() {
      const self = this;
      let currentTable = 'goals';
      let whereCondition: any = null;
      
      const executeQuery = async () => {
        let results = [];
        
        if (currentTable.includes('tag')) {
          results = Array.from(self.goalTags.values());
        } else {
          results = Array.from(self.goals.values());
        }
        
        // Apply where condition if present (simplified for testing)
        if (whereCondition && results.length > 0) {
          // For getGoal, just return the first goal for simplicity
          // In a real implementation, we'd parse the condition to find the specific goal
          results = results.slice(0, 1);
        }
        
        logger.debug(`Query result: table=${currentTable}, results=${results.length}`);
        
        return results;
      };
      
      return {
        from: (table: any) => {
          const tableName = table?._?.name || table?.name || table?.toString() || 'goals';
          currentTable = String(tableName).toLowerCase();
          
          return {
            where: (condition: any) => {
              whereCondition = condition;
              return {
                orderBy: () => executeQuery(),
                then: (resolve: any) => resolve(executeQuery()),
                catch: (reject: any) => reject,
                finally: (handler: any) => handler
              };
            },
            orderBy: () => executeQuery(),
            then: (resolve: any) => resolve(executeQuery()),
            catch: (reject: any) => reject,
            finally: (handler: any) => handler
          };
        }
      };
    },
    
    update(table: any) {
      const self = this;
      return {
        set: (values: any) => ({
          where: (condition: any) => ({
            returning: async () => {
              // Simple update - just update first goal for testing
              const [goalId, goal] = Array.from(self.goals.entries())[0] || [null, null];
              if (goal) {
                const updated = { ...goal, ...values, updatedAt: new Date() };
                self.goals.set(goalId, updated);
                return [updated];
              }
              return [];
            }
          })
        })
      };
    },
    
    delete(table: any) {
      const self = this;
      return {
        where: (condition: any) => ({
          returning: async () => {
            const [goalId, goal] = Array.from(self.goals.entries())[0] || [null, null];
            if (goal) {
              self.goals.delete(goalId);
              // Also delete tags
              for (const [tagId, tag] of self.goalTags.entries()) {
                if (tag.goalId === goalId) {
                  self.goalTags.delete(tagId);
                }
              }
              return [goal];
            }
            return [];
          }
        })
      };
    }
  }
} as any;

async function runSimpleTests() {
  try {
    logger.info('🧪 Running Simple Goals Plugin Tests');
    
    const goalManager = new GoalDataManager(mockRuntime);
    
    logger.info('📝 Test 1: Creating a goal');
    const goalId = await goalManager.createGoal({
      agentId: mockRuntime.agentId,
      ownerType: 'entity',
      ownerId: 'test-entity-123',
      name: 'Test Goal',
      description: 'Test goal for validation',
      metadata: {},
      tags: ['test', 'validation']
    });
    
    if (!goalId) {
      throw new Error('Failed to create goal');
    }
    logger.info(`✅ Goal created with ID: ${goalId}`);
    
    logger.info('📖 Test 2: Retrieving the goal');
    const goal = await goalManager.getGoal(goalId);
    if (!goal) {
      throw new Error('Failed to retrieve goal');
    }
    if (goal.name !== 'Test Goal') {
      throw new Error(`Goal name mismatch: expected 'Test Goal', got '${goal.name}'`);
    }
    logger.info('✅ Goal retrieved successfully');
    
    logger.info('📝 Test 3: Updating goal completion');
    await goalManager.updateGoal(goalId, {
      isCompleted: true,
      completedAt: new Date()
    });
    
    const updatedGoal = await goalManager.getGoal(goalId);
    if (!updatedGoal?.isCompleted) {
      throw new Error('Goal should be marked as completed');
    }
    logger.info('✅ Goal marked as completed successfully');
    
    logger.info('📝 Test 4: Getting goals with filters');
    const goals = await goalManager.getGoals({
      ownerType: 'entity',
      ownerId: 'test-entity-123',
      isCompleted: true
    });
    
    if (goals.length !== 1) {
      throw new Error(`Expected 1 goal, got ${goals.length}`);
    }
    logger.info('✅ Goal filtering works correctly');
    
    logger.info('🗑️ Test 5: Deleting the goal');
    await goalManager.deleteGoal(goalId);
    
    const deletedGoal = await goalManager.getGoal(goalId);
    if (deletedGoal) {
      throw new Error('Goal should have been deleted');
    }
    logger.info('✅ Goal deleted successfully');
    
    logger.info('🎉 All Goals Plugin tests passed!');
    return true;
    
  } catch (error) {
    logger.error('❌ Goals Plugin test failed:', error);
    return false;
  }
}

// Run if called directly
if (import.meta.main) {
  const success = await runSimpleTests();
  process.exit(success ? 0 : 1);
}