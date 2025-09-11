import z from 'zod'
import { describe, it } from 'mocha'
import ZodRoute from '../src/index'
import { expect } from 'chai'
import { getTypeHint } from '../src/getTypeHint'
import { getTypeHints } from '../src/getTypeHints'

const orgRoute = new ZodRoute(
  '/org/:organizationId',
  z.object({
    organizationId: z.number().int(),
  })
)

const relativeOrgRoute = new ZodRoute(
  'org/:organizationId',
  z.object({
    organizationId: z.number().int(),
  })
)

const inexactOrgRoute = new ZodRoute(
  '/org/:organizationId',
  z.object({
    organizationId: z.number().int(),
  }),
  { exact: false }
)

const dashRoute = orgRoute.extend(
  'dashboards/:dashboardId',
  z.object({
    dashboardId: z.string(),
  })
)

const relativeDashRoute = relativeOrgRoute.extend(
  'dashboards/:dashboardId',
  z.object({
    dashboardId: z.string(),
  })
)

const userOrUsersRoute = new ZodRoute(
  '/users/:userId?',
  z.object({
    userId: z.number().int().optional(),
  })
)

const optionalStaticRoute = new ZodRoute(
  '/foo/bar?/:baz',
  z.object({ baz: z.string() })
)

const dateRoute = new ZodRoute(
  '/events/:startTime',
  z.object({
    startTime: z
      .string()
      .datetime()
      .transform((s) => new Date(s)),
  }),
  {
    formatSchema: z.object({
      startTime: z.date().transform((d) => d.toISOString()),
    }),
  }
)

describe('parse/safeParse', function () {
  const testcases: [
    ZodRoute<any, any>,
    [string, z.SafeParseReturnType<any, any>][],
  ][] = [
    [
      orgRoute,
      [
        ['/org/22', { success: true, data: { organizationId: 22 } }],
        ...['/org', '/org/22/b'].map(
          (input): [string, z.SafeParseReturnType<any, any>] => [
            input,
            {
              success: false,
              error: new z.ZodError([
                {
                  code: z.ZodIssueCode.custom,
                  message: `path doesn't match pattern`,
                  path: [],
                },
              ]),
            },
          ]
        ),
        [
          '/org/1.5',
          {
            success: false,
            error: new z.ZodError([
              {
                code: z.ZodIssueCode.invalid_type,
                expected: 'integer',
                received: 'float',
                message: `Expected integer, received float`,
                path: ['organizationId'],
              },
            ]),
          },
        ],
        [
          '/org/a',
          {
            success: false,
            error: new z.ZodError([
              {
                code: z.ZodIssueCode.invalid_type,
                expected: 'number',
                received: 'string',
                path: ['organizationId'],
                message: `Expected number, received string`,
              },
            ]),
          },
        ],
      ],
    ],
    [
      relativeOrgRoute,
      [
        ['org/22', { success: true, data: { organizationId: 22 } }],
        ...['org', 'org/22/b'].map(
          (input): [string, z.SafeParseReturnType<any, any>] => [
            input,
            {
              success: false,
              error: new z.ZodError([
                {
                  code: z.ZodIssueCode.custom,
                  message: `path doesn't match pattern`,
                  path: [],
                },
              ]),
            },
          ]
        ),
        [
          'org/a',
          {
            success: false,
            error: new z.ZodError([
              {
                code: z.ZodIssueCode.invalid_type,
                expected: 'number',
                received: 'string',
                path: ['organizationId'],
                message: `Expected number, received string`,
              },
            ]),
          },
        ],
      ],
    ],
    [
      inexactOrgRoute,
      [
        ['/org/22', { success: true, data: { organizationId: 22 } }],
        ['/org/22/b', { success: true, data: { organizationId: 22 } }],
        ...['/org'].map((input): [string, z.SafeParseReturnType<any, any>] => [
          input,
          {
            success: false,
            error: new z.ZodError([
              {
                code: z.ZodIssueCode.custom,
                message: `path doesn't match pattern`,
                path: [],
              },
            ]),
          },
        ]),
        [
          '/org/a',
          {
            success: false,
            error: new z.ZodError([
              {
                code: z.ZodIssueCode.invalid_type,
                expected: 'number',
                received: 'string',
                path: ['organizationId'],
                message: `Expected number, received string`,
              },
            ]),
          },
        ],
      ],
    ],
    [
      dashRoute,
      [
        [
          '/org/22/dashboards/blah',
          { success: true, data: { organizationId: 22, dashboardId: 'blah' } },
        ],
        ...[
          '/org',
          '/org/22/dashboards',
          'org/22/dashboard/blah',
          'org/22/dashboards/blah/foo',
        ].map((input): [string, z.SafeParseReturnType<any, any>] => [
          input,
          {
            success: false,
            error: new z.ZodError([
              {
                code: z.ZodIssueCode.custom,
                message: `path doesn't match pattern`,
                path: [],
              },
            ]),
          },
        ]),
        [
          '/org/a/dashboards/blah',
          {
            success: false,
            error: new z.ZodError([
              {
                code: z.ZodIssueCode.invalid_type,
                expected: 'number',
                received: 'string',
                path: ['organizationId'],
                message: `Expected number, received string`,
              },
            ]),
          },
        ],
      ],
    ],
    [
      relativeDashRoute,
      [
        [
          'org/22/dashboards/blah',
          { success: true, data: { organizationId: 22, dashboardId: 'blah' } },
        ],
        ...[
          'org',
          'org/22/dashboards',
          'org/22/dashboard/blah',
          'org/22/dashboards/blah/foo',
        ].map((input): [string, z.SafeParseReturnType<any, any>] => [
          input,
          {
            success: false,
            error: new z.ZodError([
              {
                code: z.ZodIssueCode.custom,
                message: `path doesn't match pattern`,
                path: [],
              },
            ]),
          },
        ]),
        [
          'org/a/dashboards/blah',
          {
            success: false,
            error: new z.ZodError([
              {
                code: z.ZodIssueCode.invalid_type,
                expected: 'number',
                received: 'string',
                path: ['organizationId'],
                message: `Expected number, received string`,
              },
            ]),
          },
        ],
      ],
    ],
    [
      userOrUsersRoute,
      [
        ['/users/3', { success: true, data: { userId: 3 } }],
        ['/users', { success: true, data: {} }],
        [
          '/users/a',
          {
            success: false,
            error: new z.ZodError([
              {
                code: z.ZodIssueCode.invalid_type,
                expected: 'number',
                received: 'string',
                path: ['userId'],
                message: `Expected number, received string`,
              },
            ]),
          },
        ],
      ],
    ],
    [
      optionalStaticRoute,
      [
        ['/foo/bar/a', { success: true, data: { baz: 'a' } }],
        ['/foo/a', { success: true, data: { baz: 'a' } }],
      ],
    ],
    [
      dateRoute,
      [
        [
          '/events/2022-01-06T03%3A45%3A00Z',
          {
            success: true,
            data: { startTime: new Date('2022-01-06T03:45:00Z') },
          },
        ],
      ],
    ],
  ]

  for (const [route, inputs] of testcases) {
    describe(`${route.pattern}`, function () {
      for (const [input, expected] of inputs) {
        it(`${JSON.stringify(input)} -> ${JSON.stringify(
          expected
        )}`, function () {
          expect(route.safeParse(input)).to.deep.equal(expected)
          if (expected.success)
            expect(route.parse(input)).to.deep.equal(expected.data)
          else
            expect(() => route.parse(input))
              .to.throw(Error)
              .that.deep.equal(expected.error)
        })
      }
    })
  }
})

describe('format', function () {
  const testcases: [ZodRoute<any, any>, [object, string][]][] = [
    [orgRoute, [[{ organizationId: 22 }, '/org/22']]],
    [relativeOrgRoute, [[{ organizationId: 22 }, 'org/22']]],
    [
      dashRoute,
      [
        [
          { organizationId: 35, dashboardId: 'blah' },
          '/org/35/dashboards/blah',
        ],
      ],
    ],
    [
      relativeDashRoute,
      [[{ organizationId: 35, dashboardId: 'blah' }, 'org/35/dashboards/blah']],
    ],
    [
      userOrUsersRoute,
      [
        [{ userId: 21 }, '/users/21'],
        [{}, '/users'],
      ],
    ],
    [optionalStaticRoute, [[{ baz: 'a' }, '/foo/bar/a']]],
    [
      dateRoute,
      [
        [
          { startTime: new Date('2022-01-06T03:45:00Z') },
          '/events/2022-01-06T03%3A45%3A00.000Z',
        ],
      ],
    ],
  ]

  for (const [route, inputs] of testcases) {
    describe(`${route.pattern}`, function () {
      for (const [input, expected] of inputs) {
        it(`${JSON.stringify(input)} -> ${JSON.stringify(
          expected
        )}`, function () {
          expect(route.format(input)).to.deep.equal(expected)
        })
      }
    })
  }
})

describe(`partialFormat`, function () {
  const testcases: [ZodRoute<any, any>, [object, string][]][] = [
    [orgRoute, [[{ organizationId: 22 }, '/org/22']]],
    [relativeOrgRoute, [[{ organizationId: 22 }, 'org/22']]],
    [
      dashRoute,
      [
        [{ dashboardId: 'blah' }, '/org/:organizationId/dashboards/blah'],
        [{ organizationId: 35 }, '/org/35/dashboards/:dashboardId'],
        [
          { organizationId: 35, dashboardId: 'blah' },
          '/org/35/dashboards/blah',
        ],
      ],
    ],
    [
      relativeDashRoute,
      [
        [{ dashboardId: 'blah' }, 'org/:organizationId/dashboards/blah'],
        [{ organizationId: 35 }, 'org/35/dashboards/:dashboardId'],
        [{ organizationId: 35, dashboardId: 'blah' }, 'org/35/dashboards/blah'],
      ],
    ],
    [
      userOrUsersRoute,
      [
        [{ userId: 21 }, '/users/21'],
        [{}, '/users/:userId?'],
      ],
    ],
    [
      optionalStaticRoute,
      [
        [{ baz: 'a' }, '/foo/bar?/a'],
        [{}, '/foo/bar?/:baz'],
      ],
    ],
    [
      dateRoute,
      [
        [{}, '/events/:startTime'],
        [
          { startTime: new Date('Jan 1 2020 CST') },
          '/events/2020-01-01T06%3A00%3A00.000Z',
        ],
      ],
    ],
  ]

  for (const [route, inputs] of testcases) {
    describe(`${route.pattern}`, function () {
      for (const [input, expected] of inputs) {
        it(`${JSON.stringify(input)} -> ${JSON.stringify(
          expected
        )}`, function () {
          expect(route.partialFormat(input)).to.deep.equal(expected)
        })
      }
    })
  }
})

it(`other type hints`, function () {
  const schema = new ZodRoute(
    '/a/:bigint',
    z.object({
      bigint: z.bigint(),
    })
  ).extend(
    ':boolean',
    z.object({
      boolean: z.boolean(),
    })
  )
  expect(schema.safeParse('/a/3/false')).to.deep.equal({
    success: true,
    data: { bigint: 3n, boolean: false },
  })
  expect(schema.safeParse('/a/2341982883482/true')).to.deep.equal({
    success: true,
    data: { bigint: 2341982883482n, boolean: true },
  })
  expect(schema.safeParse('/a/234.5/fals')).to.deep.equal({
    success: false,
    error: new z.ZodError([
      {
        code: z.ZodIssueCode.invalid_type,
        expected: 'bigint',
        received: 'string',
        path: ['bigint'],
        message: 'Expected bigint, received string',
      },
      {
        code: z.ZodIssueCode.invalid_type,
        expected: 'boolean',
        received: 'string',
        path: ['boolean'],
        message: 'Expected boolean, received string',
      },
    ]),
  })
})

it(`getTypeHint`, function () {
  expect(getTypeHint(z.number())).to.equal('number')
  expect(getTypeHint(z.nan())).to.equal('number')
  expect(getTypeHint(z.string())).to.equal('string')
  expect(getTypeHint(z.bigint())).to.equal('bigint')
  expect(getTypeHint(z.boolean())).to.equal('boolean')
  expect(getTypeHint(z.date())).to.equal('date')
  expect(getTypeHint(z.literal(1))).to.equal('number')
  expect(getTypeHint(z.literal(1n))).to.equal('bigint')
  expect(getTypeHint(z.literal('a'))).to.equal('string')
  expect(getTypeHint(z.literal(true))).to.equal('boolean')
  expect(getTypeHint(z.literal(null))).to.equal('unknown')
  expect(getTypeHint(z.union([z.literal(1), z.literal(2)]))).to.equal('number')
  expect(getTypeHint(z.union([z.literal(1), z.literal('2')]))).to.equal(
    'unknown'
  )
  expect(getTypeHint(z.intersection(z.literal(1), z.number()))).to.equal(
    'number'
  )
  expect(getTypeHint(z.intersection(z.literal(1), z.string()))).to.equal(
    'unknown'
  )
  expect(getTypeHint(z.lazy(() => z.number()))).to.equal('number')
  expect(getTypeHint(z.enum(['a', 'b']))).to.equal('string')
  expect(getTypeHint(z.number().transform((n) => String(n)))).to.equal('number')
  expect(getTypeHint(z.number().optional())).to.equal('number')
  expect(getTypeHint(z.number().nullable())).to.equal('number')
  expect(getTypeHint(z.number().default(5))).to.equal('number')
  expect(getTypeHint(z.number().catch(3))).to.equal('number')
  expect(getTypeHint(z.number().brand('a'))).to.equal('number')
  expect(
    getTypeHint(
      z
        .number()
        .transform((n) => String(n))
        .pipe(z.string().regex(/^\d+$/))
    )
  ).to.equal('number')
  expect(getTypeHint(z.number().readonly())).to.equal('number')
})

it(`getTypeHints`, function () {
  const schema = z.object({ a: z.number(), b: z.string() })
  const expected = {
    a: 'number',
    b: 'string',
  }
  expect(getTypeHints(schema)).to.deep.equal(expected)
  expect(getTypeHints(z.lazy(() => schema))).to.deep.equal(expected)
  expect(getTypeHints(schema.refine(() => true))).to.deep.equal(expected)
  expect(getTypeHints(schema.optional())).to.deep.equal(expected)
  expect(getTypeHints(schema.nullable())).to.deep.equal(expected)
  expect(getTypeHints(schema.default({ a: 1, b: '2' }))).to.deep.equal(expected)
  expect(getTypeHints(schema.catch({ a: 1, b: '2' }))).to.deep.equal(expected)
  expect(getTypeHints(schema.brand('blah'))).to.deep.equal(expected)
  expect(getTypeHints(schema.pipe(schema))).to.deep.equal(expected)
  expect(getTypeHints(schema.readonly())).to.deep.equal(expected)

  expect(
    getTypeHints(
      z
        .object({ a: z.number(), b: z.string(), d: z.boolean() })
        .and(z.object({ a: z.literal(2), b: z.boolean(), c: z.bigint() }))
    )
  ).to.deep.equal({
    a: 'number',
    c: 'bigint',
    d: 'boolean',
  })

  expect(
    getTypeHints(
      z.union([
        z.object({ a: z.number(), b: z.literal('a') }),
        z.object({ b: z.string(), c: z.boolean() }),
        z.object({ b: z.string(), c: z.string() }),
      ])
    )
  ).to.deep.equal({
    a: 'number',
    b: 'string',
  })

  expect(getTypeHints(z.record(z.string()))).to.deep.equal({})
  expect(getTypeHints(z.set(z.string()))).to.deep.equal({})
  expect(getTypeHints(z.map(z.string(), z.string()))).to.deep.equal({})
})
