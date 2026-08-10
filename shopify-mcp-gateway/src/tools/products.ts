/**
 * Product tools: search, get, update, and bulk tagging.
 */

import { GatewayError } from '../lib/errors.js';
import { assertNoUserErrors, fromGid, ShopifyClient, toGid, type GraphQLUserError } from '../shopify/client.js';
import { STORE_PROPERTY, type ToolDefinition, type ToolContext } from '../mcp/types.js';

// ---------------------------------------------------------------------------
// Shared GraphQL fragments
// ---------------------------------------------------------------------------

const PRODUCT_SUMMARY_FIELDS = `
  id
  title
  handle
  status
  vendor
  productType
  tags
  totalInventory
  updatedAt
  featuredImage { url altText }
  priceRangeV2 {
    minVariantPrice { amount currencyCode }
    maxVariantPrice { amount currencyCode }
  }
`;

interface ProductNode {
  id: string;
  title: string;
  handle: string;
  status: string;
  vendor: string;
  productType: string;
  tags: string[];
  totalInventory: number | null;
  updatedAt: string;
  featuredImage?: { url: string; altText: string | null } | null;
  priceRangeV2?: {
    minVariantPrice: { amount: string; currencyCode: string };
    maxVariantPrice: { amount: string; currencyCode: string };
  };
}

function shapeProduct(node: ProductNode) {
  return {
    id: fromGid(node.id),
    gid: node.id,
    title: node.title,
    handle: node.handle,
    status: node.status,
    vendor: node.vendor,
    productType: node.productType,
    tags: node.tags,
    totalInventory: node.totalInventory,
    updatedAt: node.updatedAt,
    image: node.featuredImage?.url ?? null,
    priceRange: node.priceRangeV2
      ? {
          min: node.priceRangeV2.minVariantPrice.amount,
          max: node.priceRangeV2.maxVariantPrice.amount,
          currency: node.priceRangeV2.minVariantPrice.currencyCode,
        }
      : null,
  };
}

/**
 * Build a Shopify search query string from structured filters.
 *
 * Free-text is quoted so that a term containing a colon (e.g. a SKU like
 * `AB:12`) is not silently reinterpreted as a field filter.
 */
export function buildProductQuery(args: {
  query?: string;
  tag?: string;
  status?: string;
  vendor?: string;
  productType?: string;
}): string {
  const clauses: string[] = [];

  if (args.query) clauses.push(`(title:*${escapeQueryTerm(args.query)}* OR sku:*${escapeQueryTerm(args.query)}*)`);
  if (args.tag) clauses.push(`tag:'${escapeQueryTerm(args.tag)}'`);
  if (args.status) clauses.push(`status:${args.status.toUpperCase()}`);
  if (args.vendor) clauses.push(`vendor:'${escapeQueryTerm(args.vendor)}'`);
  if (args.productType) clauses.push(`product_type:'${escapeQueryTerm(args.productType)}'`);

  return clauses.join(' AND ');
}

function escapeQueryTerm(term: string): string {
  // Backslash-escape the characters Shopify's search syntax treats specially.
  return term.replace(/(['"\\()])/g, '\\$1').trim();
}

// ---------------------------------------------------------------------------
// product_search
// ---------------------------------------------------------------------------

export const productSearchTool: ToolDefinition = {
  name: 'product_search',
  title: 'Search products',
  description:
    'Search products in one store by free text, tag, status, vendor, or product type. ' +
    'Returns a page of summaries plus a `nextCursor` — pass it back as `cursor` for the next page.',
  scope: 'products:read',
  needsStore: true,
  mutating: false,
  loggableArgs: ['store', 'query', 'tag', 'status', 'vendor', 'productType', 'limit'],
  inputSchema: {
    type: 'object',
    properties: {
      ...STORE_PROPERTY,
      query: { type: 'string', description: 'Free text matched against product title and variant SKU.' },
      tag: { type: 'string', description: 'Only products carrying this exact tag.' },
      status: { type: 'string', enum: ['ACTIVE', 'ARCHIVED', 'DRAFT'], description: 'Product status filter.' },
      vendor: { type: 'string', description: 'Exact vendor name.' },
      productType: { type: 'string', description: 'Exact product type.' },
      limit: { type: 'integer', minimum: 1, maximum: 250, default: 25, description: 'Results per page (max 250).' },
      cursor: { type: 'string', description: 'Pagination cursor from a previous call.' },
    },
    required: ['store'],
    additionalProperties: false,
  },

  async handler(args, { env, store }) {
    const client = new ShopifyClient(env, store!);
    const limit = clampLimit(args.limit, 25);

    const query = `
      query searchProducts($first: Int!, $query: String, $after: String) {
        products(first: $first, query: $query, after: $after, sortKey: UPDATED_AT, reverse: true) {
          edges { cursor node { ${PRODUCT_SUMMARY_FIELDS} } }
          pageInfo { hasNextPage endCursor }
        }
      }`;

    const searchQuery = buildProductQuery(args as Parameters<typeof buildProductQuery>[0]);

    const { data } = await client.graphql<{
      products: {
        edges: Array<{ cursor: string; node: ProductNode }>;
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    }>(
      query,
      { first: limit, query: searchQuery || null, after: args.cursor ?? null },
      { costEstimate: Math.max(10, limit) },
    );

    return {
      store: store!.label,
      products: data.products.edges.map((edge) => shapeProduct(edge.node)),
      count: data.products.edges.length,
      hasMore: data.products.pageInfo.hasNextPage,
      nextCursor: data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null,
      appliedQuery: searchQuery || '(no filters)',
    };
  },
};

// ---------------------------------------------------------------------------
// product_get
// ---------------------------------------------------------------------------

export const productGetTool: ToolDefinition = {
  name: 'product_get',
  title: 'Get product',
  description:
    'Fetch one product in full, including its variants with SKUs, prices and per-location inventory. ' +
    'Accepts a numeric product id, a full gid, or a product handle.',
  scope: 'products:read',
  needsStore: true,
  mutating: false,
  loggableArgs: ['store', 'productId', 'handle'],
  inputSchema: {
    type: 'object',
    properties: {
      ...STORE_PROPERTY,
      productId: { type: 'string', description: 'Product id, e.g. "8123456789" or a full gid.' },
      handle: { type: 'string', description: 'Product handle, e.g. "hard-wax-beads". Use instead of productId.' },
    },
    required: ['store'],
    additionalProperties: false,
  },

  async handler(args, { env, store }) {
    const client = new ShopifyClient(env, store!);

    if (!args.productId && !args.handle) {
      throw new GatewayError('VALIDATION_FAILED', 'Provide either `productId` or `handle`.');
    }

    const variantFields = `
      variants(first: 100) {
        edges { node {
          id title sku price compareAtPrice barcode
          inventoryQuantity
          inventoryItem {
            id
            tracked
            inventoryLevels(first: 20) {
              edges { node {
                location { id name }
                quantities(names: ["available"]) { name quantity }
              } }
            }
          }
        } }
      }`;

    const query = args.handle
      ? `query getByHandle($handle: String!) {
           productByHandle(handle: $handle) { ${PRODUCT_SUMMARY_FIELDS} descriptionHtml ${variantFields} }
         }`
      : `query getById($id: ID!) {
           product(id: $id) { ${PRODUCT_SUMMARY_FIELDS} descriptionHtml ${variantFields} }
         }`;

    const variables = args.handle
      ? { handle: String(args.handle) }
      : { id: toGid('Product', String(args.productId)) };

    const { data } = await client.graphql<Record<string, ProductAndVariants | null>>(query, variables, {
      costEstimate: 60,
    });

    const product = data.product ?? data.productByHandle;
    if (!product) {
      throw new GatewayError(
        'NOT_FOUND',
        `No product found in ${store!.label} for ${args.handle ? `handle "${args.handle}"` : `id "${args.productId}"`}.`,
      );
    }

    return {
      store: store!.label,
      product: {
        ...shapeProduct(product),
        descriptionHtml: product.descriptionHtml,
        variants: product.variants.edges.map(({ node }) => ({
          id: fromGid(node.id),
          gid: node.id,
          title: node.title,
          sku: node.sku,
          price: node.price,
          compareAtPrice: node.compareAtPrice,
          barcode: node.barcode,
          inventoryQuantity: node.inventoryQuantity,
          inventoryItemId: node.inventoryItem ? fromGid(node.inventoryItem.id) : null,
          tracked: node.inventoryItem?.tracked ?? false,
          inventoryByLocation: (node.inventoryItem?.inventoryLevels.edges ?? []).map(({ node: level }) => ({
            locationId: fromGid(level.location.id),
            locationName: level.location.name,
            available: level.quantities.find((q) => q.name === 'available')?.quantity ?? 0,
          })),
        })),
      },
    };
  },
};

interface ProductAndVariants extends ProductNode {
  descriptionHtml: string;
  variants: {
    edges: Array<{
      node: {
        id: string;
        title: string;
        sku: string | null;
        price: string;
        compareAtPrice: string | null;
        barcode: string | null;
        inventoryQuantity: number | null;
        inventoryItem: {
          id: string;
          tracked: boolean;
          inventoryLevels: {
            edges: Array<{
              node: {
                location: { id: string; name: string };
                quantities: Array<{ name: string; quantity: number }>;
              };
            }>;
          };
        } | null;
      };
    }>;
  };
}

// ---------------------------------------------------------------------------
// product_update
// ---------------------------------------------------------------------------

export const productUpdateTool: ToolDefinition = {
  name: 'product_update',
  title: 'Update product',
  description:
    'Update a single product\'s title, description, status, vendor, product type, or tags. ' +
    'Only the fields you supply are changed. Note that `tags` REPLACES the full tag list — ' +
    'use bulk_tag to add or remove individual tags without disturbing the others.',
  scope: 'products:write',
  needsStore: true,
  mutating: true,
  loggableArgs: ['store', 'productId', 'status', 'vendor', 'productType', 'tags', 'title'],
  inputSchema: {
    type: 'object',
    properties: {
      ...STORE_PROPERTY,
      productId: { type: 'string', description: 'Product id or full gid.' },
      title: { type: 'string', description: 'New product title.' },
      descriptionHtml: { type: 'string', description: 'New description, as HTML.' },
      status: { type: 'string', enum: ['ACTIVE', 'ARCHIVED', 'DRAFT'], description: 'New status.' },
      vendor: { type: 'string', description: 'New vendor.' },
      productType: { type: 'string', description: 'New product type.' },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Replaces the entire tag list. To add or remove tags, use bulk_tag instead.',
      },
      idempotencyKey: {
        type: 'string',
        description: 'Optional. Repeating a call with the same key returns the first result instead of re-applying it.',
      },
    },
    required: ['store', 'productId'],
    additionalProperties: false,
  },

  async handler(args, { env, store }) {
    const client = new ShopifyClient(env, store!);

    const input: Record<string, unknown> = { id: toGid('Product', String(args.productId)) };
    for (const field of ['title', 'descriptionHtml', 'status', 'vendor', 'productType'] as const) {
      if (args[field] !== undefined) input[field] = args[field];
    }
    if (Array.isArray(args.tags)) input.tags = args.tags;

    if (Object.keys(input).length === 1) {
      throw new GatewayError('VALIDATION_FAILED', 'Supply at least one field to change.');
    }

    const mutation = `
      mutation updateProduct($input: ProductInput!) {
        productUpdate(input: $input) {
          product { ${PRODUCT_SUMMARY_FIELDS} }
          userErrors { field message }
        }
      }`;

    const { data } = await client.graphql<{
      productUpdate: { product: ProductNode | null; userErrors: GraphQLUserError[] };
    }>(mutation, { input }, { costEstimate: 20 });

    assertNoUserErrors(data.productUpdate.userErrors, 'product_update');

    if (!data.productUpdate.product) {
      throw new GatewayError('NOT_FOUND', `Product ${args.productId} was not found in ${store!.label}.`);
    }

    return {
      store: store!.label,
      updated: shapeProduct(data.productUpdate.product),
      changedFields: Object.keys(input).filter((k) => k !== 'id'),
    };
  },
};

// ---------------------------------------------------------------------------
// bulk_tag
// ---------------------------------------------------------------------------

/** Shopify's tagsAdd/tagsRemove accept up to 250 ids per call. */
const TAG_BATCH_SIZE = 100;

export const bulkTagTool: ToolDefinition = {
  name: 'bulk_tag',
  title: 'Bulk add or remove product tags',
  description:
    'Add or remove tags across many products at once, without disturbing their other tags. ' +
    'Either pass explicit `productIds`, or a `query`/`tag` filter to select products by search. ' +
    'Processes in batches and reports per-batch results, so a partial failure is visible rather than silent.',
  scope: 'products:write',
  needsStore: true,
  mutating: true,
  loggableArgs: ['store', 'action', 'tags', 'query', 'tag', 'status', 'vendor', 'maxProducts'],
  inputSchema: {
    type: 'object',
    properties: {
      ...STORE_PROPERTY,
      action: { type: 'string', enum: ['add', 'remove'], description: 'Whether to add or remove the tags.' },
      tags: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        description: 'Tags to add or remove.',
      },
      productIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Explicit product ids. Mutually exclusive with the search filters below.',
      },
      query: { type: 'string', description: 'Select products by free text instead of listing ids.' },
      tag: { type: 'string', description: 'Select products carrying this tag.' },
      status: { type: 'string', enum: ['ACTIVE', 'ARCHIVED', 'DRAFT'], description: 'Restrict selection by status.' },
      vendor: { type: 'string', description: 'Restrict selection by vendor.' },
      maxProducts: {
        type: 'integer',
        minimum: 1,
        maximum: 1000,
        default: 250,
        description: 'Safety cap on how many products a filter-based run may touch.',
      },
      dryRun: {
        type: 'boolean',
        default: false,
        description: 'Resolve and report which products would change, without writing anything.',
      },
      idempotencyKey: { type: 'string', description: 'Optional. Prevents a retry from re-applying the change.' },
    },
    required: ['store', 'action', 'tags'],
    additionalProperties: false,
  },

  async handler(args, context) {
    const { env, store } = context;
    const client = new ShopifyClient(env, store!);

    const action = String(args.action);
    const tags = (args.tags as string[]).map((t) => t.trim()).filter(Boolean);
    if (tags.length === 0) {
      throw new GatewayError('VALIDATION_FAILED', '`tags` must contain at least one non-empty tag.');
    }

    const productGids = await resolveTargetProducts(args, client, context);

    if (productGids.length === 0) {
      return {
        store: store!.label,
        action,
        tags,
        matched: 0,
        updated: 0,
        note: 'No products matched. Nothing was changed.',
      };
    }

    if (args.dryRun) {
      return {
        store: store!.label,
        action,
        tags,
        matched: productGids.length,
        updated: 0,
        dryRun: true,
        productIds: productGids.map(fromGid),
        note: `Dry run — ${productGids.length} product(s) would be affected. Re-run with dryRun: false to apply.`,
      };
    }

    const mutation =
      action === 'add'
        ? `mutation addTags($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { userErrors { field message } } }`
        : `mutation removeTags($id: ID!, $tags: [String!]!) { tagsRemove(id: $id, tags: $tags) { userErrors { field message } } }`;

    const failures: Array<{ productId: string; message: string }> = [];
    let updated = 0;

    // Sequential per product, batched for progress reporting. The rate limiter
    // already paces us; firing all of them concurrently would only queue up
    // inside the Durable Object while making partial failure harder to report.
    for (let offset = 0; offset < productGids.length; offset += TAG_BATCH_SIZE) {
      const batch = productGids.slice(offset, offset + TAG_BATCH_SIZE);

      for (const gid of batch) {
        try {
          const { data } = await client.graphql<{
            tagsAdd?: { userErrors: GraphQLUserError[] };
            tagsRemove?: { userErrors: GraphQLUserError[] };
          }>(mutation, { id: gid, tags }, { costEstimate: 10 });

          const userErrors = data.tagsAdd?.userErrors ?? data.tagsRemove?.userErrors ?? [];
          if (userErrors.length > 0) {
            failures.push({ productId: fromGid(gid), message: userErrors.map((e) => e.message).join('; ') });
          } else {
            updated++;
          }
        } catch (err) {
          // One product failing must not abandon the rest — report and continue.
          failures.push({
            productId: fromGid(gid),
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    return {
      store: store!.label,
      action,
      tags,
      matched: productGids.length,
      updated,
      failed: failures.length,
      failures: failures.slice(0, 25),
      note:
        failures.length > 0
          ? `${updated} of ${productGids.length} product(s) updated; ${failures.length} failed. See \`failures\`.`
          : `${updated} product(s) updated.`,
    };
  },
};

/** Resolve the target set from either explicit ids or a search filter. */
async function resolveTargetProducts(
  args: Record<string, unknown>,
  client: ShopifyClient,
  _context: ToolContext,
): Promise<string[]> {
  const explicit = args.productIds as string[] | undefined;

  if (explicit && explicit.length > 0) {
    return explicit.map((id) => toGid('Product', id));
  }

  const searchQuery = buildProductQuery(args as Parameters<typeof buildProductQuery>[0]);
  if (!searchQuery) {
    throw new GatewayError(
      'VALIDATION_FAILED',
      'Provide either `productIds`, or at least one of `query`, `tag`, `status` or `vendor` to select products. ' +
        'Refusing to tag the entire catalogue by accident.',
    );
  }

  const maxProducts = clampLimit(args.maxProducts, 250, 1000);
  const gids: string[] = [];
  let cursor: string | null = null;

  while (gids.length < maxProducts) {
    const pageSize: number = Math.min(250, maxProducts - gids.length);

    const { data }: { data: { products: { edges: Array<{ cursor: string; node: { id: string } }>; pageInfo: { hasNextPage: boolean; endCursor: string | null } } } } =
      await client.graphql(
        `query selectProducts($first: Int!, $query: String, $after: String) {
           products(first: $first, query: $query, after: $after) {
             edges { cursor node { id } }
             pageInfo { hasNextPage endCursor }
           }
         }`,
        { first: pageSize, query: searchQuery, after: cursor },
        { costEstimate: Math.max(10, pageSize) },
      );

    gids.push(...data.products.edges.map((e) => e.node.id));

    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }

  return gids;
}

export function clampLimit(value: unknown, fallback: number, max = 250): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}
