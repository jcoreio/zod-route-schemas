# zod-route-schemas

[![CircleCI](https://circleci.com/gh/jcoreio/zod-route-schemas.svg?style=svg)](https://circleci.com/gh/jcoreio/zod-route-schemas)
[![Coverage Status](https://codecov.io/gh/jcoreio/zod-route-schemas/branch/master/graph/badge.svg)](https://codecov.io/gh/jcoreio/zod-route-schemas)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![npm version](https://badge.fury.io/js/zod-route-schemas.svg)](https://badge.fury.io/js/zod-route-schemas)

Utility for parsing URL routes with typesafe parameters

# Intro

Many routing libraries like `react-router` allow you to define
route patterns with parameters like `/users/:userId`, but they
don't validate or parse the parameters, like if `userId` must
be a number.

`zod-route-schemas` allows you to validate and parse the parameters
according to a zod schema:

```ts
import z from 'zod'
import ZodRoute from 'zod-route-schemas'

const usersRoute = new ZodRoute(
  '/users/:userId',
  z.object({
    // ZodRoute type magic requires this schema to have a userId property!
    userId: z
      .string()
      .regex(/^\d+$/)
      .transform((s) => parseInt(s)),
  })
)

const params: { userId: number } = usersRoute.parse('/users/23') // type safe!
```

# API

## Patterns

A pattern should be a valid URL path (this is not strictly enforced at the moment).
Any path segment (part delimited by `/`) that starts with `:` is a _parameter_. For example the path
`/org/:orgId/dashboards/:dashboardId` has two parameters, `orgId` and `dashboardId`.

You can mark a path segment optional (whether it's a parameter or not) with a trailing `?`.
For example `/settings/account?/password` matches `/settings/account/password` or `/settings/account`,
and `/users/:userId` matches `/users` or `/users/dude` with `userId: 'dude'`.

## `class ZodRoute`

```ts
import ZodRoute from 'zod-route-schemas'
```

```ts
class ZodRoute<
  Pattern extends string,
  Schema extends SchemaForPattern<Pattern>,
  FormatSchema extends InvertSchema<Schema> = InvertSchema<Schema>
>
```

### `constructor(pattern, schema, [options])`

`constructor(pattern: Pattern, schema: Schema, options?: { formatSchema?: FormatSchema, partialFormatSchema?: PartialFormatSchema })`

Creates a `ZodRoute`. The `schema` must accept an object as input with all parameters
from `pattern` as `string`-valued properties.

`schema` is used to parse the parameters in `.parse()`/`.safeParse()`.

`formatSchema` is optional, and is used to transform the output parameter values back
to the raw string values in `.format()`.
only accepts an object with `string`, `number`, `boolean`, `null`, or `undefined` values,
and `String()`ifies them.

`partialFormatSchema` is optional, and is used to transform the output parameter values back
to the raw string values in `.partialFormat()`.

### `pattern: Pattern`

The pattern for this route.

### `schema: Schema`

The schema for parsing this route's parameters in `.parse()`/`.safeParse()`

### `formatSchema: FormatSchema`

The schema for formatting this route's parameters in `.format()`/`.partialFormat()`.

### `safeParse(path)`

`safeParse(path: string): z.SafeParseReturnType<z.input<Schema>, z.output<Schema>>`

Parses the given `path`. If it matches the `pattern`,
returns `{ success: true, data: z.output<Schema> }`.
Otherwise, returns `{ success: false, error: ZodError }`

### `parse(path)`

`parse(path: string): z.output<Schema>`

Parses the given `path`, returning the parsed parameters.
If `path` doesn't match the `pattern` or `schema`, throws a `ZodError`.

### `format(params)`

`format(params: z.output<Schema>): BindParams<Pattern, z.output<Schema>`

Creates a path from the given `params`. If `formatSchema`
can't parse the `params`, throws an error. The return type
can be computed exactly if the `params` are passed `as const`
and have only primitive values.

### `partialFormat(params)`

`partialFormat<P extends Partial<z.output<Schema>>>(params: P): BindParams<Pattern, P>`

Creates a path or pattern from the given `params`. If a
parameter is omitted, the corresponding path segment
(starting with `:`) will be preserved in the returned
pattern.

### `extend(subpattern, subschema, [formatSubschema])`

```
extend<
  Subpattern extends string,
  Subschema extends SchemaForPattern<Subpattern>,
  FormatSubschema extends InvertSchema<Subschema> = InvertSchema<Subschema>
>(
  subpattern: Subpattern,
  subschema: Subschema,
  formatSubschema: FormatSubschema = defaultFormatSchema as any
): ZodRoute<
  `${Pattern}/${Subpattern}`,
  z.ZodIntersection<Schema, Subschema>,
  z.ZodIntersection<FormatSchema, FormatSubschema>
>
```
