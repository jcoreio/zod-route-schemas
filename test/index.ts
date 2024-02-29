import z from 'zod'
import { describe, it } from 'mocha'
import ZodRoute from '../src/index'
import { expect } from 'chai'

describe(`basic test`, function () {
  it(`works`, async function () {
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

    expect(orgRoute.format({ organizationId: 35 })).to.equal('/org/35')
    expect(orgRoute.parse('/org/22')).to.deep.equal({ organizationId: 22 })
    expect(orgRoute.safeParse('/org/22')).to.deep.equal({
      success: true,
      data: { organizationId: 22 },
    })
    expect(orgRoute.safeParse('/org/a').success).to.be.false
    expect(orgRoute.safeParse('/org').success).to.be.false
    expect(orgRoute.safeParse('/org/22/b').success).to.be.false
    expect(
      dashRoute.format({ organizationId: 35, dashboardId: 'foo' })
    ).to.equal('/org/35/dashboards/foo')
    expect(dashRoute.partialFormat({ organizationId: 35 } as const)).to.equal(
      '/org/35/dashboards/:dashboardId'
    )
    expect(dashRoute.parse('/org/22/dashboards/blah')).to.deep.equal({
      organizationId: 22,
      dashboardId: 'blah',
    })
    expect(dashRoute.safeParse('/org/22/dashboards/blah')).to.deep.equal({
      success: true,
      data: { organizationId: 22, dashboardId: 'blah' },
    })
  })
})
