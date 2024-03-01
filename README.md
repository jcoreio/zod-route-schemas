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
