import z from 'zod'

type Parts<Path extends string> = Path extends `${infer Head}/${infer Tail}`
  ? [Head, ...Parts<Tail>]
  : [Path]

type BindParams<
  Path extends string,
  Params extends Record<string, any>
> = Path extends `${infer Head}/${infer Tail}`
  ? `${BindParam<Head, Params>}/${BindParams<Tail, Params>}`
  : BindParam<Path, Params>

type BindParam<
  Elem extends string,
  Params extends Record<string, any>
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
  { [K in keyof RawParams<Pattern>]: any },
  any,
  { [K in keyof RawParams<Pattern>]: string }
>

type InvertSchema<Schema extends z.ZodTypeAny> = Schema extends z.ZodType<
  infer O,
  any,
  infer I
>
  ? z.ZodType<I, any, O>
  : never

const defaultFormatSchema = z
  .record(
    z.union([z.string(), z.number(), z.boolean(), z.null(), z.undefined()])
  )
  .transform((o) =>
    Object.fromEntries(
      Object.entries(o).flatMap(([key, value]) =>
        value === undefined ? [] : [[key, String(value)]]
      )
    )
  )

type PartialSchema<S extends z.ZodTypeAny> = S extends z.ZodObject<
  infer T,
  infer UnknownKeys,
  infer Catchall
>
  ? z.ZodObject<
      {
        [k in keyof T]: z.ZodOptional<T[k]>
      },
      UnknownKeys,
      Catchall
    >
  : S extends z.ZodLazy<infer T>
  ? z.ZodLazy<PartialSchema<T>>
  : S

function defaultPartialFormatSchema<S extends z.ZodTypeAny>(
  schema: S
): PartialSchema<S> {
  if (schema instanceof z.ZodLazy) {
    return z.lazy(() => defaultPartialFormatSchema(schema.schema)) as any
  }
  if (schema instanceof z.ZodObject) {
    return schema.partial() as any
  }
  return schema as any
}

export default class ZodRoute<
  Pattern extends string,
  Schema extends SchemaForPattern<Pattern>,
  FormatSchema extends InvertSchema<Schema> = InvertSchema<Schema>,
  PartialFormatSchema extends PartialSchema<FormatSchema> = PartialSchema<FormatSchema>
> {
  private parts: string[]
  public readonly formatSchema: FormatSchema
  public readonly partialFormatSchema: PartialFormatSchema
  public readonly exact: boolean

  constructor(
    public readonly pattern: Pattern,
    public readonly schema: Schema,
    {
      formatSchema = defaultFormatSchema as any,
      partialFormatSchema = defaultPartialFormatSchema(formatSchema) as any,
      exact = true,
    }: {
      formatSchema?: FormatSchema
      partialFormatSchema?: PartialFormatSchema
      exact?: boolean
    } = {}
  ) {
    this.parts = pattern.split(/\//g)
    this.formatSchema = formatSchema
    this.partialFormatSchema = partialFormatSchema
    this.exact = exact
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
        if (this.exact) valid = false
        break
      }
      if (patternPart.startsWith(':')) {
        input[patternPart.replace(/^:|\?$/g, '')] = decodeURIComponent(part)
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
    const rawParams: any = this.formatSchema.parse(params)
    return this.parts
      .flatMap((p) => {
        if (p.startsWith(':')) {
          const value = rawParams[p.replace(/^:|\?$/g, '')]
          if (p.endsWith('?') && value == null) return []
          return [encodeURIComponent(value)]
        }
        return [p.replace(/\?$/, '')]
      })
      .join('/') as any
  }

  partialFormat<P extends Partial<z.output<Schema>>>(
    params: P
  ): BindParams<Pattern, P> {
    const rawParams: any = this.partialFormatSchema.parse(params)
    return this.parts
      .flatMap((p) => {
        if (p.startsWith(':')) {
          const key = p.replace(/^:|\?$/g, '')
          if (!(key in rawParams)) return [p]
          const value = rawParams[key]
          if (p.endsWith('?') && value == null) return []
          return [encodeURIComponent(value)]
        }
        return [p]
      })
      .join('/') as any
  }

  extend<
    Subpattern extends string,
    Subschema extends SchemaForPattern<Subpattern>,
    FormatSubschema extends InvertSchema<Subschema> = InvertSchema<Subschema>,
    PartialFormatSubschema extends PartialSchema<FormatSubschema> = PartialSchema<FormatSubschema>
  >(
    subpattern: Subpattern,
    subschema: Subschema,
    {
      formatSchema: formatSubschema = defaultFormatSchema as any,
      partialFormatSchema: partialFormatSubschema = defaultPartialFormatSchema(
        formatSubschema
      ) as any,
    }: {
      formatSchema?: FormatSubschema
      partialFormatSchema?: PartialFormatSubschema
    } = {}
  ): ZodRoute<
    `${Pattern}/${Subpattern}`,
    // @ts-expect-error probably impossbile to get this type to work
    z.ZodIntersection<Schema, Subschema>,
    z.ZodIntersection<FormatSchema, FormatSubschema>,
    z.ZodIntersection<PartialFormatSchema, PartialFormatSubschema>
  > {
    return new ZodRoute<any, any, any>(
      `${this.pattern}/${subpattern}`,
      this.schema.and(subschema),
      {
        formatSchema: this.formatSchema.and(formatSubschema),
        partialFormatSchema: this.partialFormatSchema.and(
          partialFormatSubschema
        ),
      }
    )
  }
}

export { ZodRoute }
