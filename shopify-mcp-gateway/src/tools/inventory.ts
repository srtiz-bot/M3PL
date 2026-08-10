/**
 * Inventory tools.
 *
 * Shopify's inventory model has two levels of indirection that the tool surface
 * deliberately hides: variants map to inventory *items*, and quantities live at
 * inventory *levels* per location. Callers here work in SKUs and location
 * names, which is how a human actually thinks about stock.
 */

import { GatewayError } from '../lib/errors.js';
import { assertNoUserErrors, fromGid, ShopifyClient, toGid, type GraphQLUserError } from '../shopify/client.js';
import { STORE_PROPERTY, type ToolDefinition } from '../mcp/types.js';
import { clampLimit } from './products.js';

interface InventoryLevelNode {
  location: { id: string; name: string };
  quantities: Array<{ name: string; quantity: number }>;
}

interface VariantNode {
  id: string;
  title: string;
  sku: string | null;
  displayName: string;
  inventoryQuantity: number | null;
  product: { id: string; title: string; status: string };
  inventoryItem: {
    id: string;
    tracked: boolean;
    inventoryLevels: { edges: Array<{ node: InventoryLevelNode }> };
  } | null;
}

const VARIANT_INVENTORY_FIELDS = `
  id
  title
  sku
  displayName
  inventoryQuantity
  product { id title status }
  inventoryItem {
    id
    tracked
    inventoryLevels(first: 20) {
      edges { node {
        location { id name }
        quantities(names: ["available", "on_hand", "committed", "incoming"]) { name quantity }
      } }
    }
  }
`;

function shapeVariant(node: VariantNode) {
  const levels = node.inventoryItem?.inventoryLevels.edges ?? [];
  return {
    variantId: fromGid(node.id),
    sku: node.sku,
    variantTitle: node.title,
    productId: fromGid(node.product.id),
    productTitle: node.product.title,
    productStatus: node.product.status,
    tracked: node.inventoryItem?.tracked ?? false,
    inventoryItemId: node.inventoryItem ? fromGid(node.inventoryItem.id) : null,
    totalAvailable: node.inventoryQuantity,
    byLocation: levels.map(({ node: level }) => ({
      locationId: fromGid(level.location.id),
      locationName: level.location.name,
      available: level.quantities.find((q) => q.name === 'available')?.quantity ?? 0,
      onHand: level.quantities.find((q) => q.name === 'on_hand')?.quantity ?? null,
      committed: level.quantities.find((q) => q.name === 'committed')?.quantity ?? null,
      incoming: level.quantities.find((q) => q.name === 'incoming')?.quantity ?? null,
    })),
  };
}

// ---------------------------------------------------------------------------
// inventory_get
// ---------------------------------------------------------------------------

export const inventoryGetTool: ToolDefinition = {
  name: 'inventory_get',
  title: 'Read inventory levels',
  description:
    'Read stock levels for variants, broken down by location. Select by SKU, by variant id, ' +
    'or by product id to get every variant of that product.',
  scope: 'inventory:read',
  needsStore: true,
  mutating: false,
  loggableArgs: ['store', 'sku', 'variantId', 'productId', 'limit'],
  inputSchema: {
    type: 'object',
    properties: {
      ...STORE_PROPERTY,
      sku: { type: 'string', description: 'Exact or partial SKU to match.' },
      variantId: { type: 'string', description: 'A specific variant id or gid.' },
      productId: { type: 'string', description: 'Return every variant of this product.' },
      limit: { type: 'integer', minimum: 1, maximum: 250, default: 50, description: 'Max variants to return.' },
    },
    required: ['store'],
    additionalProperties: false,
  },

  async handler(args, { env, store }) {
    const client = new ShopifyClient(env, store!);
    const limit = clampLimit(args.limit, 50);

    if (args.variantId) {
      const { data } = await client.graphql<{ productVariant: VariantNode | null }>(
        `query getVariant($id: ID!) { productVariant(id: $id) { ${VARIANT_INVENTORY_FIELDS} } }`,
        { id: toGid('ProductVariant', String(args.variantId)) },
        { costEstimate: 20 },
      );
      if (!data.productVariant) {
        throw new GatewayError('NOT_FOUND', `Variant ${args.variantId} was not found in ${store!.label}.`);
      }
      return { store: store!.label, variants: [shapeVariant(data.productVariant)], count: 1 };
    }

    if (args.productId) {
      const { data } = await client.graphql<{
        product: { variants: { edges: Array<{ node: VariantNode }> } } | null;
      }>(
        `query getProductVariants($id: ID!, $first: Int!) {
           product(id: $id) { variants(first: $first) { edges { node { ${VARIANT_INVENTORY_FIELDS} } } } }
         }`,
        { id: toGid('Product', String(args.productId)), first: limit },
        { costEstimate: 40 },
      );
      if (!data.product) {
        throw new GatewayError('NOT_FOUND', `Product ${args.productId} was not found in ${store!.label}.`);
      }
      const variants = data.product.variants.edges.map((e) => shapeVariant(e.node));
      return { store: store!.label, variants, count: variants.length };
    }

    if (!args.sku) {
      throw new GatewayError('VALIDATION_FAILED', 'Provide one of `sku`, `variantId` or `productId`.');
    }

    const { data } = await client.graphql<{
      productVariants: { edges: Array<{ node: VariantNode }> };
    }>(
      `query findBySku($first: Int!, $query: String!) {
         productVariants(first: $first, query: $query) { edges { node { ${VARIANT_INVENTORY_FIELDS} } } }
       }`,
      { first: limit, query: `sku:${String(args.sku).replace(/(['"\\])/g, '\\$1')}` },
      { costEstimate: 40 },
    );

    const variants = data.productVariants.edges.map((e) => shapeVariant(e.node));
    return {
      store: store!.label,
      variants,
      count: variants.length,
      note: variants.length === 0 ? `No variants matched SKU "${args.sku}".` : undefined,
    };
  },
};

// ---------------------------------------------------------------------------
// inventory_set
// ---------------------------------------------------------------------------

export const inventorySetTool: ToolDefinition = {
  name: 'inventory_set',
  title: 'Set or adjust inventory',
  description:
    'Change available stock for a variant at a location. Use mode "set" for an absolute count, ' +
    'or "adjust" for a relative delta (negative to decrease). Identify the variant by SKU or variant id, ' +
    'and the location by name or id — omit the location when the store has only one.',
  scope: 'inventory:write',
  needsStore: true,
  mutating: true,
  loggableArgs: ['store', 'sku', 'variantId', 'locationName', 'locationId', 'mode', 'quantity', 'reason'],
  inputSchema: {
    type: 'object',
    properties: {
      ...STORE_PROPERTY,
      sku: { type: 'string', description: 'Variant SKU. Must match exactly one variant.' },
      variantId: { type: 'string', description: 'Variant id, as an alternative to sku.' },
      mode: {
        type: 'string',
        enum: ['set', 'adjust'],
        default: 'set',
        description: '"set" writes an absolute quantity; "adjust" applies a delta.',
      },
      quantity: {
        type: 'integer',
        description: 'The absolute quantity (mode "set") or the delta (mode "adjust", may be negative).',
      },
      locationName: { type: 'string', description: 'Location name, e.g. "Miami Warehouse".' },
      locationId: { type: 'string', description: 'Location id, as an alternative to locationName.' },
      reason: {
        type: 'string',
        default: 'correction',
        description: 'Shopify inventory change reason, e.g. correction, cycle_count_available, damaged, restock.',
      },
      idempotencyKey: { type: 'string', description: 'Optional. Prevents a retry from double-applying an adjustment.' },
    },
    required: ['store', 'quantity'],
    additionalProperties: false,
  },

  async handler(args, { env, store }) {
    const client = new ShopifyClient(env, store!);
    const mode = String(args.mode ?? 'set');
    const quantity = Number(args.quantity);

    if (!Number.isInteger(quantity)) {
      throw new GatewayError('VALIDATION_FAILED', '`quantity` must be a whole number.');
    }
    if (mode === 'set' && quantity < 0) {
      throw new GatewayError('VALIDATION_FAILED', 'An absolute quantity cannot be negative. Use mode "adjust" to decrease.');
    }
    if (!args.sku && !args.variantId) {
      throw new GatewayError('VALIDATION_FAILED', 'Provide either `sku` or `variantId`.');
    }

    // --- Resolve the variant ------------------------------------------------
    const variant = await resolveSingleVariant(client, store!.label, args);
    if (!variant.inventoryItem) {
      throw new GatewayError('VALIDATION_FAILED', `Variant ${variant.sku ?? fromGid(variant.id)} has no inventory item.`);
    }
    if (!variant.inventoryItem.tracked) {
      throw new GatewayError(
        'VALIDATION_FAILED',
        `Inventory is not tracked for ${variant.displayName}. Enable tracking in Shopify before setting stock.`,
      );
    }

    // --- Resolve the location -----------------------------------------------
    const locationGid = await resolveLocation(client, store!.label, args, variant);

    // --- Apply --------------------------------------------------------------
    if (mode === 'adjust') {
      const mutation = `
        mutation adjustQuantities($input: InventoryAdjustQuantitiesInput!) {
          inventoryAdjustQuantities(input: $input) {
            inventoryAdjustmentGroup { createdAt reason changes { name delta quantityAfterChange } }
            userErrors { field message }
          }
        }`;

      const { data } = await client.graphql<{
        inventoryAdjustQuantities: {
          inventoryAdjustmentGroup: {
            createdAt: string;
            reason: string;
            changes: Array<{ name: string; delta: number; quantityAfterChange: number | null }>;
          } | null;
          userErrors: GraphQLUserError[];
        };
      }>(
        mutation,
        {
          input: {
            name: 'available',
            reason: String(args.reason ?? 'correction'),
            changes: [{ inventoryItemId: variant.inventoryItem.id, locationId: locationGid, delta: quantity }],
          },
        },
        { costEstimate: 20 },
      );

      assertNoUserErrors(data.inventoryAdjustQuantities.userErrors, 'inventory_set (adjust)');

      const change = data.inventoryAdjustQuantities.inventoryAdjustmentGroup?.changes[0];
      return {
        store: store!.label,
        variant: { id: fromGid(variant.id), sku: variant.sku, name: variant.displayName },
        mode,
        delta: quantity,
        newQuantity: change?.quantityAfterChange ?? null,
        reason: String(args.reason ?? 'correction'),
      };
    }

    const mutation = `
      mutation setQuantities($input: InventorySetQuantitiesInput!) {
        inventorySetQuantities(input: $input) {
          inventoryAdjustmentGroup { createdAt reason changes { name delta quantityAfterChange } }
          userErrors { field message }
        }
      }`;

    const { data } = await client.graphql<{
      inventorySetQuantities: {
        inventoryAdjustmentGroup: {
          changes: Array<{ name: string; delta: number; quantityAfterChange: number | null }>;
        } | null;
        userErrors: GraphQLUserError[];
      };
    }>(
      mutation,
      {
        input: {
          name: 'available',
          reason: String(args.reason ?? 'correction'),
          // We read the level immediately before writing, so a concurrent
          // change would be clobbered. Shopify's compareQuantity guard is the
          // right fix but requires a read-modify-write the caller cannot see;
          // ignoreCompareQuantity keeps this predictable and is documented.
          ignoreCompareQuantity: true,
          quantities: [
            { inventoryItemId: variant.inventoryItem.id, locationId: locationGid, quantity },
          ],
        },
      },
      { costEstimate: 20 },
    );

    assertNoUserErrors(data.inventorySetQuantities.userErrors, 'inventory_set');

    const change = data.inventorySetQuantities.inventoryAdjustmentGroup?.changes[0];
    return {
      store: store!.label,
      variant: { id: fromGid(variant.id), sku: variant.sku, name: variant.displayName },
      mode,
      newQuantity: change?.quantityAfterChange ?? quantity,
      delta: change?.delta ?? null,
      reason: String(args.reason ?? 'correction'),
    };
  },
};

/**
 * Resolve exactly one variant.
 *
 * Ambiguity is refused rather than guessed: writing stock to the wrong variant
 * is expensive to notice and worse to undo.
 */
async function resolveSingleVariant(
  client: ShopifyClient,
  storeLabel: string,
  args: Record<string, unknown>,
): Promise<VariantNode> {
  if (args.variantId) {
    const { data } = await client.graphql<{ productVariant: VariantNode | null }>(
      `query getVariant($id: ID!) { productVariant(id: $id) { ${VARIANT_INVENTORY_FIELDS} } }`,
      { id: toGid('ProductVariant', String(args.variantId)) },
      { costEstimate: 20 },
    );
    if (!data.productVariant) {
      throw new GatewayError('NOT_FOUND', `Variant ${args.variantId} was not found in ${storeLabel}.`);
    }
    return data.productVariant;
  }

  const sku = String(args.sku);
  const { data } = await client.graphql<{ productVariants: { edges: Array<{ node: VariantNode }> } }>(
    `query findBySku($query: String!) {
       productVariants(first: 5, query: $query) { edges { node { ${VARIANT_INVENTORY_FIELDS} } } }
     }`,
    { query: `sku:${sku.replace(/(['"\\])/g, '\\$1')}` },
    { costEstimate: 20 },
  );

  const matches = data.productVariants.edges
    .map((e) => e.node)
    // Shopify's sku: filter is a prefix match, so narrow to an exact hit.
    .filter((node) => node.sku === sku);

  if (matches.length === 0) {
    throw new GatewayError('NOT_FOUND', `No variant in ${storeLabel} has SKU "${sku}".`);
  }
  if (matches.length > 1) {
    throw new GatewayError(
      'VALIDATION_FAILED',
      `SKU "${sku}" matches ${matches.length} variants in ${storeLabel}. Use \`variantId\` to disambiguate.`,
      { details: { matches: matches.map((m) => ({ variantId: fromGid(m.id), product: m.product.title })) } },
    );
  }
  return matches[0]!;
}

/** Resolve a location by id, by name, or implicitly when there is only one. */
async function resolveLocation(
  client: ShopifyClient,
  storeLabel: string,
  args: Record<string, unknown>,
  variant: VariantNode,
): Promise<string> {
  if (args.locationId) return toGid('Location', String(args.locationId));

  const levels = variant.inventoryItem?.inventoryLevels.edges ?? [];

  if (args.locationName) {
    const wanted = String(args.locationName).toLowerCase();
    const match = levels.find((l) => l.node.location.name.toLowerCase() === wanted);
    if (match) return match.node.location.id;

    // Fall back to the shop's full location list — the variant may not be
    // stocked at that location yet, which is a legitimate thing to fix.
    const { data } = await client.graphql<{
      locations: { edges: Array<{ node: { id: string; name: string } }> };
    }>(`query listLocations { locations(first: 50) { edges { node { id name } } } }`, {}, { costEstimate: 10 });

    const location = data.locations.edges.find((e) => e.node.name.toLowerCase() === wanted);
    if (!location) {
      throw new GatewayError('NOT_FOUND', `No location named "${args.locationName}" in ${storeLabel}.`, {
        details: { availableLocations: data.locations.edges.map((e) => e.node.name) },
      });
    }
    return location.node.id;
  }

  if (levels.length === 1) return levels[0]!.node.location.id;

  if (levels.length === 0) {
    throw new GatewayError(
      'VALIDATION_FAILED',
      `This variant is not stocked at any location in ${storeLabel}. Specify \`locationName\`.`,
    );
  }

  throw new GatewayError(
    'VALIDATION_FAILED',
    `This variant is stocked at ${levels.length} locations. Specify which one with \`locationName\`.`,
    { details: { locations: levels.map((l) => l.node.location.name) } },
  );
}
