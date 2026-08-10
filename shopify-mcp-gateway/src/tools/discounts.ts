/**
 * Discount code creation.
 *
 * Discounts are money, so this tool is more conservative than the others: it
 * requires an explicit end date or an explicit acknowledgement that the code
 * never expires, and it caps percentage values well below 100% unless the
 * caller opts in. Both guards exist because "50" meaning 50% and "50" meaning
 * $50 off are one keystroke apart.
 */

import { GatewayError } from '../lib/errors.js';
import { assertNoUserErrors, fromGid, ShopifyClient, type GraphQLUserError } from '../shopify/client.js';
import { STORE_PROPERTY, type ToolDefinition } from '../mcp/types.js';

/** Above this, a percentage discount requires `allowDeepDiscount: true`. */
const DEEP_DISCOUNT_THRESHOLD = 50;

export const discountCreateTool: ToolDefinition = {
  name: 'discount_create',
  title: 'Create a discount code',
  description:
    'Create a basic discount code in one store — either a percentage off or a fixed amount off. ' +
    'Applies to the whole order by default. Percentage discounts above 50% require allowDeepDiscount: true, ' +
    'as a guard against confusing a percentage with a dollar amount.',
  scope: 'discounts:write',
  needsStore: true,
  mutating: true,
  loggableArgs: [
    'store',
    'code',
    'valueType',
    'value',
    'startsAt',
    'endsAt',
    'usageLimit',
    'appliesOncePerCustomer',
    'minimumSubtotal',
  ],
  inputSchema: {
    type: 'object',
    properties: {
      ...STORE_PROPERTY,
      code: {
        type: 'string',
        minLength: 1,
        maxLength: 64,
        description: 'The code customers type at checkout, e.g. "SUMMER20".',
      },
      title: { type: 'string', description: 'Internal name shown in the Shopify admin. Defaults to the code.' },
      valueType: {
        type: 'string',
        enum: ['percentage', 'fixed_amount'],
        description: '"percentage" for a % off, "fixed_amount" for a currency amount off.',
      },
      value: {
        type: 'number',
        exclusiveMinimum: 0,
        description: 'For percentage: 20 means 20% off. For fixed_amount: 20 means 20 off in the store currency.',
      },
      startsAt: { type: 'string', description: 'ISO 8601 start time. Defaults to now.' },
      endsAt: { type: 'string', description: 'ISO 8601 end time. Omit only with neverExpires: true.' },
      neverExpires: {
        type: 'boolean',
        default: false,
        description: 'Explicitly acknowledge that this code has no end date.',
      },
      usageLimit: { type: 'integer', minimum: 1, description: 'Total redemptions allowed across all customers.' },
      appliesOncePerCustomer: {
        type: 'boolean',
        default: true,
        description: 'Limit each customer to one use. Defaults to true.',
      },
      minimumSubtotal: { type: 'number', minimum: 0, description: 'Minimum order subtotal required to apply.' },
      allowDeepDiscount: {
        type: 'boolean',
        default: false,
        description: 'Required to create a percentage discount above 50%.',
      },
      idempotencyKey: { type: 'string', description: 'Optional. Prevents a retry from creating a duplicate code.' },
    },
    required: ['store', 'code', 'valueType', 'value'],
    additionalProperties: false,
  },

  async handler(args, { env, store }) {
    const client = new ShopifyClient(env, store!);

    const code = String(args.code).trim();
    const valueType = String(args.valueType);
    const value = Number(args.value);

    if (!code) throw new GatewayError('VALIDATION_FAILED', '`code` cannot be empty.');
    if (!Number.isFinite(value) || value <= 0) {
      throw new GatewayError('VALIDATION_FAILED', '`value` must be a positive number.');
    }

    // --- Guards -------------------------------------------------------------
    if (valueType === 'percentage') {
      if (value > 100) {
        throw new GatewayError('VALIDATION_FAILED', 'A percentage discount cannot exceed 100.');
      }
      if (value > DEEP_DISCOUNT_THRESHOLD && args.allowDeepDiscount !== true) {
        throw new GatewayError(
          'VALIDATION_FAILED',
          `${value}% is a deep discount. If that is intended, pass allowDeepDiscount: true. ` +
            `If you meant ${value} off in currency, use valueType: "fixed_amount".`,
        );
      }
    }

    if (!args.endsAt && args.neverExpires !== true) {
      throw new GatewayError(
        'VALIDATION_FAILED',
        'Provide `endsAt`, or pass neverExpires: true to create a code with no end date.',
      );
    }

    const startsAt = args.startsAt ? assertIsoDateTime(args.startsAt, 'startsAt') : new Date().toISOString();
    const endsAt = args.endsAt ? assertIsoDateTime(args.endsAt, 'endsAt') : null;

    if (endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
      throw new GatewayError('VALIDATION_FAILED', '`endsAt` must be after `startsAt`.');
    }

    // --- Build the input ----------------------------------------------------
    const customerGets: Record<string, unknown> = {
      items: { all: true },
      value:
        valueType === 'percentage'
          ? { percentage: value / 100 } // Shopify expects a 0–1 fraction
          : { discountAmount: { amount: value, appliesOnEachItem: false } },
    };

    const basicCodeDiscount: Record<string, unknown> = {
      title: String(args.title ?? code),
      code,
      startsAt,
      customerSelection: { all: true },
      customerGets,
      appliesOncePerCustomer: args.appliesOncePerCustomer !== false,
    };

    if (endsAt) basicCodeDiscount.endsAt = endsAt;
    if (args.usageLimit !== undefined) basicCodeDiscount.usageLimit = Number(args.usageLimit);
    if (args.minimumSubtotal !== undefined) {
      basicCodeDiscount.minimumRequirement = {
        subtotal: { greaterThanOrEqualToSubtotal: Number(args.minimumSubtotal) },
      };
    }

    const mutation = `
      mutation createDiscount($basicCodeDiscount: DiscountCodeBasicInput!) {
        discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
          codeDiscountNode {
            id
            codeDiscount {
              ... on DiscountCodeBasic {
                title
                status
                startsAt
                endsAt
                usageLimit
                appliesOncePerCustomer
                codes(first: 1) { edges { node { code } } }
              }
            }
          }
          userErrors { field message code }
        }
      }`;

    const { data } = await client.graphql<{
      discountCodeBasicCreate: {
        codeDiscountNode: {
          id: string;
          codeDiscount: {
            title: string;
            status: string;
            startsAt: string;
            endsAt: string | null;
            usageLimit: number | null;
            appliesOncePerCustomer: boolean;
            codes: { edges: Array<{ node: { code: string } }> };
          };
        } | null;
        userErrors: GraphQLUserError[];
      };
    }>(mutation, { basicCodeDiscount }, { costEstimate: 25 });

    assertNoUserErrors(data.discountCodeBasicCreate.userErrors, 'discount_create');

    const node = data.discountCodeBasicCreate.codeDiscountNode;
    if (!node) {
      throw new GatewayError('UPSTREAM_ERROR', 'Shopify accepted the request but returned no discount.');
    }

    return {
      store: store!.label,
      discount: {
        id: fromGid(node.id),
        code: node.codeDiscount.codes.edges[0]?.node.code ?? code,
        title: node.codeDiscount.title,
        status: node.codeDiscount.status,
        valueType,
        value,
        startsAt: node.codeDiscount.startsAt,
        endsAt: node.codeDiscount.endsAt,
        usageLimit: node.codeDiscount.usageLimit,
        appliesOncePerCustomer: node.codeDiscount.appliesOncePerCustomer,
      },
    };
  },
};

function assertIsoDateTime(value: unknown, field: string): string {
  const text = String(value);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) {
    throw new GatewayError(
      'VALIDATION_FAILED',
      `\`${field}\` must be an ISO 8601 timestamp, e.g. "2026-09-01T00:00:00Z".`,
    );
  }
  return new Date(parsed).toISOString();
}
