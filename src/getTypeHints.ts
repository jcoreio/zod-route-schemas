import z from 'zod'
import { TypeHint, getTypeHint } from './getTypeHint'

export function getTypeHints(schema: z.ZodTypeAny): {
  [K in string]?: TypeHint
} {
  switch (schema._def.typeName) {
    case z.ZodFirstPartyTypeKind.ZodObject: {
      const { shape } = schema as z.ZodObject<z.ZodRawShape>
      const hints: {
        [K in string]?: TypeHint
      } = {}
      for (const key in shape) {
        const value = shape[key]
        hints[key] = getTypeHint(value)
      }
      return hints
    }
    case z.ZodFirstPartyTypeKind.ZodUnion:
    case z.ZodFirstPartyTypeKind.ZodDiscriminatedUnion: {
      const { options } = schema as
        | z.ZodUnion<z.ZodUnionOptions>
        | z.ZodDiscriminatedUnion<
            string,
            z.ZodDiscriminatedUnionOption<string>[]
          >
      const optionHints = options.map((o) => getTypeHints(o))
      const keys = new Set(optionHints.flatMap((o) => Object.keys(o)))
      const hints: {
        [K in string]?: TypeHint
      } = {}
      for (const key of keys) {
        const hintsForKey = new Set(optionHints.flatMap((h) => h[key] || []))
        if (hintsForKey.size === 1) hints[key] = [...hintsForKey][0]
      }
      return hints
    }
    case z.ZodFirstPartyTypeKind.ZodIntersection: {
      const {
        _def: { left, right },
      } = schema as z.ZodIntersection<z.ZodTypeAny, z.ZodTypeAny>
      const leftHints = getTypeHints(left)
      const rightHints = getTypeHints(right)
      const hints: { [K in string]?: TypeHint } = {}
      for (const key of new Set([
        ...Object.keys(leftHints),
        ...Object.keys(rightHints),
      ])) {
        if (
          !(key in leftHints) ||
          !(key in rightHints) ||
          leftHints[key] === rightHints[key]
        ) {
          hints[key] = leftHints[key] || rightHints[key]
        }
      }
      return hints
    }
    case z.ZodFirstPartyTypeKind.ZodLazy: {
      const { schema: innerSchema } = schema as z.ZodLazy<z.ZodTypeAny>
      return getTypeHints(innerSchema)
    }
    case z.ZodFirstPartyTypeKind.ZodEffects: {
      const {
        _def: { schema: innerSchema },
      } = schema as z.ZodEffects<z.ZodTypeAny>
      return getTypeHints(innerSchema)
    }
    case z.ZodFirstPartyTypeKind.ZodOptional: {
      const innerSchema = (schema as z.ZodOptional<z.ZodTypeAny>).unwrap()
      return getTypeHints(innerSchema)
    }
    case z.ZodFirstPartyTypeKind.ZodNullable: {
      const innerSchema = (schema as z.ZodNullable<z.ZodTypeAny>).unwrap()
      return getTypeHints(innerSchema)
    }
    case z.ZodFirstPartyTypeKind.ZodDefault: {
      const {
        _def: { innerType },
      } = schema as z.ZodDefault<z.ZodTypeAny>
      return getTypeHints(innerType)
    }
    case z.ZodFirstPartyTypeKind.ZodCatch: {
      const {
        _def: { innerType },
      } = schema as z.ZodCatch<z.ZodTypeAny>
      return getTypeHints(innerType)
    }
    case z.ZodFirstPartyTypeKind.ZodBranded: {
      const {
        _def: { type: innerType },
      } = schema as z.ZodBranded<z.ZodTypeAny, string | number | symbol>
      return getTypeHints(innerType)
    }
    case z.ZodFirstPartyTypeKind.ZodPipeline: {
      const {
        _def: { in: input },
      } = schema as z.ZodPipeline<z.ZodTypeAny, z.ZodTypeAny>
      return getTypeHints(input)
    }
    case z.ZodFirstPartyTypeKind.ZodReadonly: {
      const {
        _def: { innerType },
      } = schema as z.ZodReadonly<z.ZodTypeAny>
      return getTypeHints(innerType)
    }
  }
  return {}
}
