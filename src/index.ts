import z from 'zod'

type Parts<Path extends string> = Path extends `${infer Head}/${infer Tail}`
  ? [Head, ...Parts<Tail>]
  : [Path]

type BindParams<
  Path extends string,
  Params extends Record<string, string | number | boolean | null | undefined>
> = Path extends `${infer Head}/${infer Tail}`
  ? `${BindParam<Head, Params>}/${BindParams<Tail, Params>}`
  : BindParam<Path, Params>

type BindParam<
  Elem extends string,
  Params extends Record<string, string | number | boolean | null | undefined>
> = Elem extends `:${infer Param}`
  ? Param extends keyof Params
    ? Params[Param]
    : Elem
  : Elem

type RawParams<Path extends string> = {
  [K in Parts<Path>[number] as K extends `:${infer S}` ? S : never]: string
}

export type SchemaForPattern<Pattern extends string> = z.ZodType<
  { [K in keyof RawParams<Pattern>]: string | number | boolean },
  any,
  { [K in keyof RawParams<Pattern>]: string }
>

export default class ZodRoute<
  Pattern extends string,
  Schema extends SchemaForPattern<Pattern>
> {
  private parts: string[]

  constructor(
    public readonly pattern: Pattern,
    public readonly schema: Schema
  ) {
    this.parts = pattern.split(/\//g)
  }

  safeParse(
    path: string
  ): z.SafeParseReturnType<z.input<Schema>, z.output<Schema>> {
    const parts = path.split(/\//g)
    if (
      parts.length !== this.parts.length ||
      this.parts.find((p, i) => !p.startsWith(':') && parts[i] !== p)
    ) {
      return {
        success: false,
        error: new z.ZodError([
          {
            code: z.ZodIssueCode.custom,
            message: `path doesn't match pattern`,
            path: [],
          },
        ]),
      }
    }
    return this.schema.safeParse(
      Object.fromEntries(
        this.parts.flatMap((p, i) =>
          p.startsWith(':') ? [[p.substring(1), parts[i]]] : []
        )
      )
    )
  }

  parse(path: string): z.output<Schema> {
    const result = this.safeParse(path)
    if (!result.success) throw result.error
    return result.data
  }

  format(params: z.output<Schema>): BindParams<Pattern, z.output<Schema>> {
    return this.pattern.replace(/:[^/]+/g, (m) =>
      String((params as any)[m.substring(1)])
    ) as any
  }

  partialFormat<P extends Partial<z.output<Schema>>>(
    params: P
  ): BindParams<Pattern, P> {
    return this.pattern.replace(/:[^/]+/g, (m) =>
      m.substring(1) in params ? String((params as any)[m.substring(1)]) : m
    ) as any
  }

  extend<
    Subpattern extends string,
    Subschema extends SchemaForPattern<Subpattern>
  >(
    subpattern: Subpattern,
    subschema: Subschema
  ): ZodRoute<
    `${Pattern}/${Subpattern}`,
    // @ts-expect-error foo
    z.ZodIntersection<Schema, Subschema>
  > {
    return new ZodRoute<any, any>(
      `${this.pattern}/${subpattern}`,
      this.schema.and(subschema)
    )
  }
}
