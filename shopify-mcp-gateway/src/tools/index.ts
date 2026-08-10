/**
 * Tool registry.
 *
 * Adding a tool means adding it here and nowhere else — the dispatcher derives
 * permission checks, audit redaction and `tools/list` filtering from the
 * definition, so there is no second place to keep in sync.
 */

import type { ToolDefinition } from '../mcp/types.js';
import { auditSearchTool } from './audit.js';
import { discountCreateTool } from './discounts.js';
import { inventoryGetTool, inventorySetTool } from './inventory.js';
import { orderGetTool, orderSearchTool } from './orders.js';
import { bulkTagTool, productGetTool, productSearchTool, productUpdateTool } from './products.js';
import { listStoresTool } from './stores.js';

export const TOOLS: ToolDefinition[] = [
  listStoresTool,
  productSearchTool,
  productGetTool,
  productUpdateTool,
  bulkTagTool,
  inventoryGetTool,
  inventorySetTool,
  orderSearchTool,
  orderGetTool,
  discountCreateTool,
  auditSearchTool,
];

const BY_NAME = new Map(TOOLS.map((tool) => [tool.name, tool]));

export function listTools(): ToolDefinition[] {
  return TOOLS;
}

export function getTool(name: string): ToolDefinition | undefined {
  return BY_NAME.get(name);
}
