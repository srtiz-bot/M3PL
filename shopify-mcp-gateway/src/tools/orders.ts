/**
 * Order tools. Read-only by design — the gateway has no order-mutation scope,
 * because refunds and cancellations are money movement and belong behind a
 * deliberate human workflow rather than a model-invoked tool.
 */

import { GatewayError } from '../lib/errors.js';
import { fromGid, ShopifyClient, toGid } from '../shopify/client.js';
import { STORE_PROPERTY, type ToolDefinition } from '../mcp/types.js';
import { clampLimit } from './products.js';

const ORDER_SUMMARY_FIELDS = `
  id
  name
  createdAt
  processedAt
  displayFinancialStatus
  displayFulfillmentStatus
  cancelledAt
  email
  totalPriceSet { shopMoney { amount currencyCode } }
  customer { id displayName }
  shippingAddress { city provinceCode countryCodeV2 }
`;

interface OrderNode {
  id: string;
  name: string;
  createdAt: string;
  processedAt: string | null;
  displayFinancialStatus: string | null;
  displayFulfillmentStatus: string | null;
  cancelledAt: string | null;
  email: string | null;
  totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
  customer: { id: string; displayName: string } | null;
  shippingAddress: { city: string | null; provinceCode: string | null; countryCodeV2: string | null } | null;
}

function shapeOrder(node: OrderNode) {
  return {
    id: fromGid(node.id),
    name: node.name,
    createdAt: node.createdAt,
    processedAt: node.processedAt,
    financialStatus: node.displayFinancialStatus,
    fulfillmentStatus: node.displayFulfillmentStatus,
    cancelled: node.cancelledAt !== null,
    cancelledAt: node.cancelledAt,
    total: node.totalPriceSet.shopMoney.amount,
    currency: node.totalPriceSet.shopMoney.currencyCode,
    customer: node.customer ? { id: fromGid(node.customer.id), name: node.customer.displayName } : null,
    email: node.email,
    shipTo: node.shippingAddress
      ? [node.shippingAddress.city, node.shippingAddress.provinceCode, node.shippingAddress.countryCodeV2]
          .filter(Boolean)
          .join(', ')
      : null,
  };
}

// ---------------------------------------------------------------------------
// order_search
// ---------------------------------------------------------------------------

export const orderSearchTool: ToolDefinition = {
  name: 'order_search',
  title: 'Search orders',
  description:
    'Search orders in one store by status, date range, customer email, or free text. ' +
    'Returns summaries; use order_get for line items and fulfillments.',
  scope: 'orders:read',
  needsStore: true,
  mutating: false,
  // `email` is deliberately absent: it is customer PII and the audit log uses
  // an allowlist, so omitting it here keeps it out of the log (decision D-009).
  loggableArgs: ['store', 'financialStatus', 'fulfillmentStatus', 'createdAfter', 'createdBefore', 'limit'],
  inputSchema: {
    type: 'object',
    properties: {
      ...STORE_PROPERTY,
      query: { type: 'string', description: 'Free text, e.g. an order name like "#1001".' },
      email: { type: 'string', description: 'Customer email to filter by.' },
      financialStatus: {
        type: 'string',
        enum: ['paid', 'pending', 'refunded', 'partially_refunded', 'voided', 'authorized'],
        description: 'Payment status filter.',
      },
      fulfillmentStatus: {
        type: 'string',
        enum: ['fulfilled', 'unfulfilled', 'partial', 'restocked'],
        description: 'Fulfillment status filter.',
      },
      createdAfter: { type: 'string', description: 'ISO date, e.g. "2026-08-01". Orders created on or after.' },
      createdBefore: { type: 'string', description: 'ISO date. Orders created on or before.' },
      limit: { type: 'integer', minimum: 1, maximum: 250, default: 25, description: 'Results per page.' },
      cursor: { type: 'string', description: 'Pagination cursor from a previous call.' },
    },
    required: ['store'],
    additionalProperties: false,
  },

  async handler(args, { env, store }) {
    const client = new ShopifyClient(env, store!);
    const limit = clampLimit(args.limit, 25);

    const clauses: string[] = [];
    if (args.query) clauses.push(String(args.query));
    if (args.email) clauses.push(`email:${String(args.email).replace(/(['"\\])/g, '\\$1')}`);
    if (args.financialStatus) clauses.push(`financial_status:${args.financialStatus}`);
    if (args.fulfillmentStatus) clauses.push(`fulfillment_status:${args.fulfillmentStatus}`);
    if (args.createdAfter) clauses.push(`created_at:>=${assertIsoDate(args.createdAfter, 'createdAfter')}`);
    if (args.createdBefore) clauses.push(`created_at:<=${assertIsoDate(args.createdBefore, 'createdBefore')}`);

    const searchQuery = clauses.join(' AND ');

    const { data } = await client.graphql<{
      orders: {
        edges: Array<{ cursor: string; node: OrderNode }>;
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    }>(
      `query searchOrders($first: Int!, $query: String, $after: String) {
         orders(first: $first, query: $query, after: $after, sortKey: CREATED_AT, reverse: true) {
           edges { cursor node { ${ORDER_SUMMARY_FIELDS} } }
           pageInfo { hasNextPage endCursor }
         }
       }`,
      { first: limit, query: searchQuery || null, after: args.cursor ?? null },
      { costEstimate: Math.max(15, limit) },
    );

    return {
      store: store!.label,
      orders: data.orders.edges.map((e) => shapeOrder(e.node)),
      count: data.orders.edges.length,
      hasMore: data.orders.pageInfo.hasNextPage,
      nextCursor: data.orders.pageInfo.hasNextPage ? data.orders.pageInfo.endCursor : null,
      appliedQuery: searchQuery || '(no filters)',
    };
  },
};

/** Reject malformed dates before they become a confusing Shopify syntax error. */
function assertIsoDate(value: unknown, field: string): string {
  const text = String(value);
  if (!/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/.test(text)) {
    throw new GatewayError('VALIDATION_FAILED', `\`${field}\` must be an ISO date such as "2026-08-01".`);
  }
  return text;
}

// ---------------------------------------------------------------------------
// order_get
// ---------------------------------------------------------------------------

export const orderGetTool: ToolDefinition = {
  name: 'order_get',
  title: 'Get order',
  description:
    'Fetch one order in full: line items, discounts, shipping address, fulfillments and tracking. ' +
    'Accepts an order id or an order name like "#1001".',
  scope: 'orders:read',
  needsStore: true,
  mutating: false,
  loggableArgs: ['store', 'orderId', 'orderName'],
  inputSchema: {
    type: 'object',
    properties: {
      ...STORE_PROPERTY,
      orderId: { type: 'string', description: 'Order id or full gid.' },
      orderName: { type: 'string', description: 'Order name, e.g. "#1001". Use instead of orderId.' },
    },
    required: ['store'],
    additionalProperties: false,
  },

  async handler(args, { env, store }) {
    const client = new ShopifyClient(env, store!);

    if (!args.orderId && !args.orderName) {
      throw new GatewayError('VALIDATION_FAILED', 'Provide either `orderId` or `orderName`.');
    }

    const detailFields = `
      ${ORDER_SUMMARY_FIELDS}
      note
      tags
      subtotalPriceSet { shopMoney { amount currencyCode } }
      totalShippingPriceSet { shopMoney { amount currencyCode } }
      totalTaxSet { shopMoney { amount currencyCode } }
      totalRefundedSet { shopMoney { amount currencyCode } }
      shippingAddress { name address1 address2 city provinceCode zip countryCodeV2 phone }
      lineItems(first: 100) {
        edges { node {
          id title quantity sku vendor
          variant { id title }
          originalTotalSet { shopMoney { amount currencyCode } }
          discountedTotalSet { shopMoney { amount currencyCode } }
        } }
      }
      fulfillments(first: 20) {
        status createdAt
        trackingInfo { company number url }
      }
      discountApplications(first: 10) {
        edges { node { targetType allocationMethod } }
      }
    `;

    const query = args.orderName
      ? `query getOrderByName($query: String!) {
           orders(first: 2, query: $query) { edges { node { ${detailFields} } } }
         }`
      : `query getOrder($id: ID!) { order(id: $id) { ${detailFields} } }`;

    const variables = args.orderName
      ? { query: `name:${String(args.orderName).replace(/^#/, '#')}` }
      : { id: toGid('Order', String(args.orderId)) };

    const { data } = await client.graphql<{
      order?: OrderDetail | null;
      orders?: { edges: Array<{ node: OrderDetail }> };
    }>(query, variables, { costEstimate: 60 });

    const order = data.order ?? data.orders?.edges[0]?.node;
    if (!order) {
      throw new GatewayError(
        'NOT_FOUND',
        `No order found in ${store!.label} for ${args.orderName ? `name "${args.orderName}"` : `id "${args.orderId}"`}.`,
      );
    }

    return {
      store: store!.label,
      order: {
        ...shapeOrder(order),
        note: order.note,
        tags: order.tags,
        subtotal: order.subtotalPriceSet?.shopMoney.amount ?? null,
        shipping: order.totalShippingPriceSet?.shopMoney.amount ?? null,
        tax: order.totalTaxSet?.shopMoney.amount ?? null,
        refunded: order.totalRefundedSet?.shopMoney.amount ?? null,
        shippingAddress: order.shippingAddress,
        lineItems: order.lineItems.edges.map(({ node }) => ({
          id: fromGid(node.id),
          title: node.title,
          quantity: node.quantity,
          sku: node.sku,
          vendor: node.vendor,
          variantId: node.variant ? fromGid(node.variant.id) : null,
          variantTitle: node.variant?.title ?? null,
          originalTotal: node.originalTotalSet.shopMoney.amount,
          discountedTotal: node.discountedTotalSet.shopMoney.amount,
        })),
        fulfillments: order.fulfillments.map((f) => ({
          status: f.status,
          createdAt: f.createdAt,
          tracking: f.trackingInfo.map((t) => ({ carrier: t.company, number: t.number, url: t.url })),
        })),
      },
    };
  },
};

interface OrderDetail extends OrderNode {
  note: string | null;
  tags: string[];
  subtotalPriceSet?: { shopMoney: { amount: string; currencyCode: string } };
  totalShippingPriceSet?: { shopMoney: { amount: string; currencyCode: string } };
  totalTaxSet?: { shopMoney: { amount: string; currencyCode: string } };
  totalRefundedSet?: { shopMoney: { amount: string; currencyCode: string } };
  lineItems: {
    edges: Array<{
      node: {
        id: string;
        title: string;
        quantity: number;
        sku: string | null;
        vendor: string | null;
        variant: { id: string; title: string } | null;
        originalTotalSet: { shopMoney: { amount: string; currencyCode: string } };
        discountedTotalSet: { shopMoney: { amount: string; currencyCode: string } };
      };
    }>;
  };
  fulfillments: Array<{
    status: string;
    createdAt: string;
    trackingInfo: Array<{ company: string | null; number: string | null; url: string | null }>;
  }>;
}
