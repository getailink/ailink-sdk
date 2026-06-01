/**
 * Unit Tests — Function Registry
 * Tests tool registration, role-based access, group filtering
 */

import { FunctionRegistry } from '../../src/registry';
import {
  ToolAlreadyExistsError,
  ToolNotFoundError,
} from '../../src/errors';
import { toolSchemas } from '../fixtures/toolSchemas';
import { createMockToolHandlers, resetMockData } from '../fixtures/testData';

describe('FunctionRegistry', () => {
  let registry: FunctionRegistry;
  const handlers = createMockToolHandlers();

  beforeEach(() => {
    registry = new FunctionRegistry();
    resetMockData();
  });

  describe('Tool Registration', () => {
    it('should register a tool successfully', () => {
      registry.register(
        'checkInventory',
        'Check product stock',
        toolSchemas.checkInventory,
        handlers.checkInventory
      );

      expect(registry.has('checkInventory')).toBe(true);
    });

    it('should reject duplicate tool names', () => {
      registry.register(
        'checkInventory',
        'Check stock',
        toolSchemas.checkInventory,
        handlers.checkInventory
      );

      expect(() => {
        registry.register(
          'checkInventory',
          'Duplicate',
          toolSchemas.checkInventory,
          handlers.checkInventory
        );
      }).toThrow(ToolAlreadyExistsError);
    });

    it('should register with custom roles', () => {
      registry.register(
        'adminTool',
        'Admin only',
        { type: 'object', properties: {} },
        handlers.checkInventory,
        { roles: ['admin', 'developer'] }
      );

      const tool = registry.get('adminTool');
      expect(tool?.roles).toEqual(['admin', 'developer']);
    });

    it('should register with default roles if not specified', () => {
      registry.register(
        'defaultTool',
        'Default roles',
        { type: 'object', properties: {} },
        handlers.checkInventory
      );

      const tool = registry.get('defaultTool');
      expect(tool?.roles).toEqual(['user', 'admin', 'developer']);
    });

    it('should register tool with group', () => {
      registry.register(
        'inventoryCheck',
        'Check inventory',
        toolSchemas.checkInventory,
        handlers.checkInventory,
        { group: 'inventory' }
      );

      const tool = registry.get('inventoryCheck');
      expect(tool?.group).toBe('inventory');
    });

    it('should register tool without group', () => {
      registry.register(
        'noGroupTool',
        'No group',
        { type: 'object', properties: {} },
        handlers.checkInventory
      );

      const tool = registry.get('noGroupTool');
      expect(tool?.group).toBeUndefined();
    });
  });

  describe('Tool Retrieval', () => {
    beforeEach(() => {
      registry.register(
        'tool1',
        'Tool 1',
        toolSchemas.checkInventory,
        handlers.checkInventory
      );
      registry.register(
        'tool2',
        'Tool 2',
        toolSchemas.getOrderStatus,
        handlers.getOrderStatus,
        { group: 'orders' }
      );
    });

    it('should get tool by name', () => {
      const tool = registry.get('tool1');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('tool1');
    });

    it('should return undefined for non-existent tool', () => {
      const tool = registry.get('nonexistent');
      expect(tool).toBeUndefined();
    });

    it('should check if tool exists', () => {
      expect(registry.has('tool1')).toBe(true);
      expect(registry.has('nonexistent')).toBe(false);
    });

    it('should list all tool names', () => {
      const tools = registry.list();
      expect(tools).toContain('tool1');
      expect(tools).toContain('tool2');
      expect(tools.length).toBe(2);
    });
  });

  describe('Tool Unregistration', () => {
    beforeEach(() => {
      registry.register(
        'tempTool',
        'Temporary',
        toolSchemas.checkInventory,
        handlers.checkInventory
      );
    });

    it('should unregister a tool', () => {
      expect(registry.has('tempTool')).toBe(true);
      registry.unregister('tempTool');
      expect(registry.has('tempTool')).toBe(false);
    });

    it('should throw when unregistering non-existent tool', () => {
      expect(() => {
        registry.unregister('nonexistent');
      }).toThrow(ToolNotFoundError);
    });
  });

  describe('Role-Based Filtering', () => {
    beforeEach(() => {
      // User tool
      registry.register(
        'userTool',
        'User tool',
        { type: 'object', properties: {} },
        handlers.checkInventory,
        { roles: ['user'] }
      );

      // Admin tool
      registry.register(
        'adminTool',
        'Admin tool',
        { type: 'object', properties: {} },
        handlers.checkInventory,
        { roles: ['admin'] }
      );

      // Developer tool
      registry.register(
        'devTool',
        'Developer tool',
        { type: 'object', properties: {} },
        handlers.checkInventory,
        { roles: ['developer'] }
      );

      // User + Admin tool
      registry.register(
        'userAdminTool',
        'User + Admin',
        { type: 'object', properties: {} },
        handlers.checkInventory,
        { roles: ['user', 'admin'] }
      );
    });

    it('should filter tools for user role', () => {
      const tools = registry.getByRole('user');
      const names = tools.map(t => t.name);
      
      expect(names).toContain('userTool');
      expect(names).toContain('userAdminTool');
      expect(names).not.toContain('adminTool');
      expect(names).not.toContain('devTool');
    });

    it('should filter tools for admin role', () => {
      const tools = registry.getByRole('admin');
      const names = tools.map(t => t.name);
      
      expect(names).toContain('adminTool');
      expect(names).toContain('userAdminTool');
      expect(names).toContain('userTool'); // admin sees user tools
      expect(names).not.toContain('devTool');
    });

    it('should filter tools for developer role (sees all)', () => {
      const tools = registry.getByRole('developer');
      expect(tools.length).toBe(4); // All 4 tools
    });
  });

  describe('Group-Based Filtering', () => {
    beforeEach(() => {
      registry.register('userTool', 'User', { type: 'object', properties: {} }, handlers.checkInventory, {
        roles: ['user'],
        group: 'inventory',
      });
      registry.register('adminTool', 'Admin', { type: 'object', properties: {} }, handlers.checkInventory, {
        roles: ['admin'],
        group: 'admin',
      });
      registry.register('noGroupTool', 'No Group', { type: 'object', properties: {} }, handlers.checkInventory, {
        roles: ['user'],
      });
    });

    it('should filter tools by specific group', () => {
      const tools = registry.getFiltered('user', ['inventory']);
      const names = tools.map(t => t.name);
      
      expect(names).toContain('userTool');
      expect(names).not.toContain('adminTool');
      expect(names).not.toContain('noGroupTool'); // no group doesn't match specified groups
    });

    it('should return all tools for role when no groups specified', () => {
      const tools = registry.getFiltered('user');
      const names = tools.map(t => t.name);
      
      expect(names).toContain('userTool');
      expect(names).toContain('noGroupTool');
    });

    it('should return empty array when groups have no matching tools', () => {
      const tools = registry.getFiltered('user', ['nonexistent_group']);
      expect(tools.length).toBe(0);
    });

    it('should filter multiple groups', () => {
      registry.register('ordersTool', 'Orders', { type: 'object', properties: {} }, handlers.checkInventory, {
        roles: ['user'],
        group: 'orders',
      });

      const tools = registry.getFiltered('user', ['inventory', 'orders']);
      const names = tools.map(t => t.name);
      
      expect(names).toContain('userTool');
      expect(names).toContain('ordersTool');
      expect(names).not.toContain('noGroupTool');
    });
  });

  describe('Schema Export', () => {
    beforeEach(() => {
      registry.register(
        'checkInventory',
        'Check product stock',
        toolSchemas.checkInventory,
        handlers.checkInventory
      );
      registry.register(
        'getOrderStatus',
        'Get order status',
        toolSchemas.getOrderStatus,
        handlers.getOrderStatus
      );
    });

    it('should export all tools as JSON schema array', () => {
      const schema = registry.exportSchema();
      
      expect(Array.isArray(schema)).toBe(true);
      expect(schema.length).toBe(2);
    });

    it('should export schema with correct structure', () => {
      const schema = registry.exportSchema();
      
      schema.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('parameters');
      });
    });

    it('should export subset of tools if provided', () => {
      const allTools = registry.getAll();
      const filtered = [allTools[0]]; // First tool only
      const schema = registry.exportSchema(filtered);
      
      expect(schema.length).toBe(1);
      // Schema export adapts tool name for providers
      expect(schema[0]).toHaveProperty('name');
    });

    it('should export empty array when no tools', () => {
      const emptyRegistry = new FunctionRegistry();
      const schema = emptyRegistry.exportSchema();
      expect(schema).toEqual([]);
    });
  });

  describe('Get All Tools', () => {
    it('should return empty array for empty registry', () => {
      const tools = registry.getAll();
      expect(tools).toEqual([]);
    });

    it('should return all registered tools regardless of role/group', () => {
      registry.register('tool1', 'T1', { type: 'object', properties: {} }, handlers.checkInventory, {
        roles: ['user'],
        group: 'g1',
      });
      registry.register('tool2', 'T2', { type: 'object', properties: {} }, handlers.checkInventory, {
        roles: ['admin'],
        group: 'g2',
      });
      registry.register('tool3', 'T3', { type: 'object', properties: {} }, handlers.checkInventory);

      const tools = registry.getAll();
      expect(tools.length).toBe(3);
      expect(tools.map(t => t.name)).toEqual(['tool1', 'tool2', 'tool3']);
    });
  });

  describe('Integration: Complex Scenarios', () => {
    beforeEach(() => {
      // Set up a realistic tool registry
      registry.register('getOrders', 'Get user orders', toolSchemas.getOrderStatus, handlers.getOrderStatus, {
        roles: ['user', 'admin', 'developer'],
        group: 'orders',
      });
      registry.register('cancelOrder', 'Cancel order', toolSchemas.cancelOrder, handlers.cancelOrder, {
        roles: ['user', 'admin', 'developer'],
        group: 'orders',
      });
      registry.register('checkInventory', 'Check inventory', toolSchemas.checkInventory, handlers.checkInventory, {
        roles: ['user', 'admin', 'developer'],
        group: 'inventory',
      });
      registry.register('refundOrder', 'Refund order', toolSchemas.getOrderStatus, handlers.getOrderStatus, {
        roles: ['admin', 'developer'],
        group: 'payments',
      });
      registry.register('deleteAccount', 'Delete account', toolSchemas.noParams, handlers.checkInventory, {
        roles: ['developer'],
        group: 'admin',
      });
    });

    it('user should see orders and inventory but not payments/admin tools', () => {
      const tools = registry.getByRole('user');
      const names = tools.map(t => t.name);
      
      expect(names).toContain('getOrders');
      expect(names).toContain('cancelOrder');
      expect(names).toContain('checkInventory');
      expect(names).not.toContain('refundOrder');
      expect(names).not.toContain('deleteAccount');
    });

    it('admin should see orders, inventory, payments but not admin tools', () => {
      const tools = registry.getByRole('admin');
      const names = tools.map(t => t.name);
      
      expect(names).toContain('getOrders');
      expect(names).toContain('cancelOrder');
      expect(names).toContain('checkInventory');
      expect(names).toContain('refundOrder');
      expect(names).not.toContain('deleteAccount');
    });

    it('developer should see all tools', () => {
      const tools = registry.getByRole('developer');
      expect(tools.length).toBe(5);
    });

    it('user with specific groups should only see those tools', () => {
      const tools = registry.getFiltered('user', ['orders']);
      const names = tools.map(t => t.name);
      
      expect(names).toContain('getOrders');
      expect(names).toContain('cancelOrder');
      expect(names).not.toContain('checkInventory');
    });
  });
});
