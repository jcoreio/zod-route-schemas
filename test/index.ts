import z from 'zod'
import { describe, it } from 'mocha'
import ZodRoute from '../src/index'
import { expect } from 'chai'

const orgRoute = new ZodRoute(
  '/org/:organizationId',
  z.object({
    organizationId: z
      .string()
      .regex(/^\d+$/)
      .transform((s) => parseInt(s)),
  })
)

const dashRoute = orgRoute.extend(
  'dashboards/:dashboardId',
  z.object({
    dashboardId: z.string(),
  })
)

const userOrUsersRoute = new ZodRoute(
  '/users/:userId?',
  z.object({
    userId: z
      .string()
      .regex(/^\d+$/)
      .transform((s) => parseInt(s))
      .optional(),
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
    [string, z.SafeParseReturnType<any, any>][]
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
          '/org/a',
          {
            success: false,
            error: new z.ZodError([
              {
                validation: 'regex',
                code: z.ZodIssueCode.invalid_string,
                message: `Invalid`,
                path: ['organizationId'],
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
                validation: 'regex',
                code: z.ZodIssueCode.invalid_string,
                message: `Invalid`,
                path: ['organizationId'],
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
                validation: 'regex',
                code: z.ZodIssueCode.invalid_string,
                message: `Invalid`,
                path: ['userId'],
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
