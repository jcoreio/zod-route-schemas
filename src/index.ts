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
  [K in Parts<Path>[number] as K extends `:${string}?`
    ? never
    : K extends `:${infer S}`
    ? S
    : never]: string
} & {
  [K in Parts<Path>[number] as K extends `:${infer S}?` ? S : never]?: string
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
    let partIndex = 0
    let patternIndex = 0
    const input: any = {}
    let valid = true

    while (partIndex < parts.length) {
      const part = parts[partIndex]
      const patternPart = this.parts[patternIndex]
      if (patternPart == null) {
        valid = false
        break
      }
      if (patternPart.startsWith(':')) {
        input[patternPart.replace(/^:|\?$/g, '')] = part
        partIndex++
        patternIndex++
        continue
      }
      if (patternPart.endsWith('?')) {
        if (part === patternPart.substring(0, patternPart.length - 1)) {
          partIndex++
        }
        patternIndex++
        continue
      }
      if (patternPart !== part) {
        valid = false
        break
      }
      patternIndex++
      partIndex++
    }
    if (valid) {
      while (patternIndex < this.parts.length) {
        if (!this.parts[patternIndex++].endsWith('?')) {
          valid = false
          break
        }
      }
    }
    if (!valid) {
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
    return this.schema.safeParse(input)
  }

  parse(path: string): z.output<Schema> {
    const result = this.safeParse(path)
    if (!result.success) throw result.error
    return result.data
  }

  format(params: z.output<Schema>): BindParams<Pattern, z.output<Schema>> {
    return this.parts
      .flatMap((p) => {
        if (p.startsWith(':')) {
          const value = (params as any)[p.replace(/^:|\?$/g, '')]
          if (p.endsWith('?') && value == null) return []
          return [String(value)]
        }
        return [p.replace(/\?$/, '')]
      })
      .join('/') as any
  }

  partialFormat<P extends Partial<z.output<Schema>>>(
    params: P
  ): BindParams<Pattern, P> {
    return this.parts
      .flatMap((p) => {
        if (p.startsWith(':')) {
          const key = p.replace(/^:|\?$/g, '')
          if (!(key in params)) return [p]
          const value = (params as any)[key]
          if (p.endsWith('?') && value == null) return []
          return [String(value)]
        }
        return [p]
      })
      .join('/') as any
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
