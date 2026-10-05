import z from 'zod'
import { TypeHint } from './getTypeHint'
import { getTypeHints } from './getTypeHints'
import { invert } from 'zod-invertible'

type Parts<Path extends string> =
  Path extends `${infer Head}/${infer Tail}` ? [Head, ...Parts<Tail>] : [Path]

type RawParams<Path extends string> = {
  [K in Parts<Path>[number] as K extends `:${string}?` ? never
  : K extends `:${infer S}` ? S
  : never]: string
} & {
  [K in Parts<Path>[number] as K extends `:${infer S}?` ? S : never]?: string
}

export type SchemaForPattern<Pattern extends string> = z.ZodType<
  { [K in keyof RawParams<Pattern>]: any },
  any,
  { [K in keyof RawParams<Pattern>]: string | number | bigint | boolean }
>

type InvertSchema<Schema extends z.ZodTypeAny> =
  Schema extends z.ZodType<infer O, any, infer I> ? z.ZodType<I, any, O> : never

type PartialSchema<S extends z.ZodTypeAny> =
  S extends z.ZodObject<infer T, infer UnknownKeys, infer Catchall> ?
    z.ZodObject<
      {
        [k in keyof T]: z.ZodOptional<T[k]>
      },
      UnknownKeys,
      Catchall
    >
  : S extends z.ZodLazy<infer T> ? z.ZodLazy<PartialSchema<T>>
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
> {
  private parts: string[]
  public readonly formatSchema: FormatSchema
  public readonly partialFormatSchema: PartialSchema<FormatSchema>
  public readonly exact: boolean
  private typeHints?: { [K in string]?: TypeHint }

  constructor(
    public readonly pattern: Pattern,
    public readonly schema: Schema,
    {
      formatSchema = invert(schema) as any,
      partialFormatSchema = defaultPartialFormatSchema(formatSchema),
      exact = true,
    }: {
      formatSchema?: FormatSchema
      partialFormatSchema?: PartialSchema<FormatSchema>
      exact?: boolean
    } = {}
  ) {
    this.parts = pattern.split(/\//g)
    this.formatSchema = formatSchema
    this.partialFormatSchema = partialFormatSchema
    this.exact = exact
  }

  safeParse(path: string): ZodRouteSafeParseReturnType<z.output<Schema>> {
    const typeHints =
      this.typeHints || (this.typeHints = getTypeHints(this.schema))

    const parts = path.split(/\//g)
    let partIndex = 0
    let patternIndex = 0
    const input: any = {}
    let valid = true

    while (partIndex < parts.length) {
      const part = parts[partIndex]
      const patternPart = this.parts[patternIndex]
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (patternPart == null) {
        if (this.exact) valid = false
        break
      }
      if (patternPart.startsWith(':')) {
        const key = patternPart.replace(/^:|\?$/g, '')
        const rawValue = decodeURIComponent(part)
        let value: unknown = rawValue
        switch (typeHints[key]) {
          case 'number': {
            const cast = Number(rawValue)
            if (rawValue.trim() && Number.isFinite(cast)) value = cast
            break
          }
          case 'bigint': {
            if (/^\d+$/.test(rawValue)) value = BigInt(rawValue)
            break
          }
          case 'boolean': {
            if (rawValue === 'true') value = true
            if (rawValue === 'false') value = false
            break
          }
        }
        input[key] = value
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
        error: new ZodRouteParseError({ route: this, path }),
      }
    }
    const result = this.schema.safeParse(input)
    if (result.success) return result
    return {
      success: false,
      error: new ZodRouteParseError({
        route: this,
        path,
        cause: result.error,
      }),
    }
  }

  parse(path: string): z.output<Schema> {
    const result = this.safeParse(path)
    if (!result.success) throw result.error
    return result.data
  }

  format(params: z.output<Schema>): string {
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
      .join('/')
  }

  partialFormat(params: Partial<z.output<Schema>>): string {
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
      .join('/')
  }

  extend<
    Subpattern extends string,
    Subschema extends SchemaForPattern<Subpattern>,
    FormatSubschema extends InvertSchema<Subschema> = InvertSchema<Subschema>,
  >(
    subpattern: Subpattern,
    subschema: Subschema,
    {
      formatSchema: formatSubschema = invert(subschema) as any,
      partialFormatSchema: partialFormatSubschema = defaultPartialFormatSchema(
        formatSubschema
      ) as any,
      exact = true,
    }: {
      formatSchema?: FormatSubschema
      partialFormatSchema?: PartialSchema<FormatSchema>
      exact?: boolean
    } = {}
  ): ZodRoute<
    `${Pattern}/${Subpattern}`,
    z.ZodIntersection<Schema, Subschema>,
    z.ZodIntersection<FormatSchema, FormatSubschema>
  > {
    return new ZodRoute<any, any, any>(
      `${this.pattern}/${subpattern}`,
      this.schema.and(subschema),
      {
        formatSchema: this.formatSchema.and(formatSubschema),
        partialFormatSchema: this.partialFormatSchema.and(
          partialFormatSubschema
        ),
        exact,
      }
    )
  }
}

export { ZodRoute }

export type ZodRouteSafeParseReturnType<Output> =
  | { success: true; data: Output; error?: never }
  | { success: false; error: ZodRouteParseError; data?: never }

/**
 * Error returned by `ZodRoute.safeParse` or thrown by `ZodRoute` if the input path is invalid.
 */
export class ZodRouteParseError extends Error {
  name = 'ZodRouteParseError'
  /**
   * The `ZodRoute` instance that tried to parse the `path`
   */
  route: ZodRoute<any, any>
  /**
   * The input path that the `route` tried to parse
   */
  path: string
  /**
   * The `ZodError`, if the route pattern matched by param parsing failed
   */
  cause?: z.ZodError

  constructor({
    route,
    path,
    cause,
  }: {
    route: ZodRoute<any, any>
    path: string
    cause?: z.ZodError
  }) {
    super(cause ? `Invalid path: ${path}` : `Not found: ${path}`, { cause })
    this.route = route
    this.path = path
    this.cause = cause
  }
}
