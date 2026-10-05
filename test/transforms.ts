import { describe, it } from 'mocha'
import { expect } from 'chai'
import ZodRoute, { ZodRouteParseError } from '../src'
import z from 'zod'
import { invertible } from 'zod-invertible'

describe(`transforms`, function () {
  it(`parse and format`, function () {
    const org = new ZodRoute('/org/:orgId', z.object({ orgId: z.number() }))
    const ParseDirection = z
      .enum(['from', 'to'])
      .transform((d) => (d === 'from' ? 'FROM_DEVICE' : 'TO_DEVICE'))
    const FormatDirection = z
      .enum(['FROM_DEVICE', 'TO_DEVICE'])
      .transform((d) => (d === 'FROM_DEVICE' ? 'from' : 'to'))

    const device = org.extend(
      'devices/mqtt/:deviceId',
      z.object({ deviceId: z.number() })
    )

    const addChannel = device.extend(
      'addChannel/:direction',
      z.object({
        direction: ParseDirection,
      }),
      { formatSchema: z.object({ direction: FormatDirection }) }
    )

    expect(
      addChannel.parse('/org/3/devices/mqtt/4/addChannel/from')
    ).to.deep.equal({
      orgId: 3,
      deviceId: 4,
      direction: 'FROM_DEVICE',
    })

    expect(() => addChannel.parse('/org/3/devices/mqtt/4/addChannel/fro'))
      .to.throw(ZodRouteParseError)
      .that.deep.equals(
        new ZodRouteParseError({
          route: addChannel,
          path: '/org/3/devices/mqtt/4/addChannel/fro',
          cause: new z.ZodError([
            {
              code: z.ZodIssueCode.invalid_enum_value,
              received: 'fro',
              options: ['from', 'to'],
              path: ['direction'],
              message: `Invalid enum value. Expected 'from' | 'to', received 'fro'`,
            },
          ]),
        })
      )
    expect(
      addChannel.format({
        orgId: 3,
        deviceId: 4,
        direction: 'FROM_DEVICE',
      })
    ).to.equal('/org/3/devices/mqtt/4/addChannel/from')
  })
  it(`invertible schema`, function () {
    const org = new ZodRoute('/org/:orgId', z.object({ orgId: z.number() }))
    const device = org.extend(
      'devices/mqtt/:deviceId',
      z.object({ deviceId: z.number() })
    )

    const Direction = invertible(
      z.enum(['from', 'to']),
      (d) => (d === 'from' ? 'FROM_DEVICE' : 'TO_DEVICE'),
      z.enum(['FROM_DEVICE', 'TO_DEVICE']),
      (d) => (d === 'FROM_DEVICE' ? 'from' : 'to')
    )

    const addChannel = device.extend(
      'addChannel/:direction',
      z.object({ direction: Direction })
    )

    expect(
      addChannel.parse('/org/3/devices/mqtt/4/addChannel/from')
    ).to.deep.equal({
      orgId: 3,
      deviceId: 4,
      direction: 'FROM_DEVICE',
    })
    expect(() => addChannel.parse('/org/3/devices/mqtt/4/addChannel/fro'))
      .to.throw(ZodRouteParseError)
      .that.deep.equals(
        new ZodRouteParseError({
          route: addChannel,
          path: '/org/3/devices/mqtt/4/addChannel/fro',
          cause: new z.ZodError([
            {
              code: z.ZodIssueCode.invalid_enum_value,
              received: 'fro',
              options: ['from', 'to'],
              path: ['direction'],
              message: `Invalid enum value. Expected 'from' | 'to', received 'fro'`,
            },
          ]),
        })
      )
    expect(
      addChannel.format({
        orgId: 3,
        deviceId: 4,
        direction: 'FROM_DEVICE',
      })
    ).to.equal('/org/3/devices/mqtt/4/addChannel/from')
  })
})
