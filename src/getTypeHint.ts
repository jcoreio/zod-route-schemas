import z from 'zod'

export type TypeHint =
  | 'string'
  | 'number'
  | 'date'
  | 'bigint'
  | 'boolean'
  | 'unknown'

export function getTypeHint(schema: z.ZodTypeAny): TypeHint {
  switch (schema._def.typeName) {
    case z.ZodFirstPartyTypeKind.ZodString:
      return 'string'
    case z.ZodFirstPartyTypeKind.ZodNumber:
      return 'number'
    case z.ZodFirstPartyTypeKind.ZodNaN:
      return 'number'
    case z.ZodFirstPartyTypeKind.ZodBigInt:
      return 'bigint'
    case z.ZodFirstPartyTypeKind.ZodBoolean:
      return 'boolean'
    case z.ZodFirstPartyTypeKind.ZodDate:
      return 'date'
    case z.ZodFirstPartyTypeKind.ZodUnion: {
      const { options } = schema as z.ZodUnion<z.ZodUnionOptions>
      const hints = new Set(options.map((o) => getTypeHint(o)))
      if (hints.size === 1) return [...hints][0]
      break
    }
    case z.ZodFirstPartyTypeKind.ZodIntersection: {
      const {
        _def: { left, right },
      } = schema as z.ZodIntersection<z.ZodTypeAny, z.ZodTypeAny>
      const leftHint = getTypeHint(left)
      const rightHint = getTypeHint(right)
      if (leftHint === rightHint) return leftHint
      break
    }
    case z.ZodFirstPartyTypeKind.ZodLazy: {
      const { schema: innerSchema } = schema as z.ZodLazy<z.ZodTypeAny>
      return getTypeHint(innerSchema)
    }
    case z.ZodFirstPartyTypeKind.ZodLiteral: {
      const { value } = schema as z.ZodLiteral<any>
      const hint = typeof value
      switch (hint) {
        case 'string':
        case 'number':
        case 'bigint':
        case 'boolean':
          return hint
      }
      break
    }
    case z.ZodFirstPartyTypeKind.ZodEnum: {
      return 'string'
    }
    case z.ZodFirstPartyTypeKind.ZodEffects: {
      const {
        _def: { schema: innerSchema },
      } = schema as z.ZodEffects<z.ZodTypeAny>
      return getTypeHint(innerSchema)
    }
    case z.ZodFirstPartyTypeKind.ZodOptional: {
      const innerSchema = (schema as z.ZodOptional<z.ZodTypeAny>).unwrap()
      return getTypeHint(innerSchema)
    }
    case z.ZodFirstPartyTypeKind.ZodNullable: {
      const innerSchema = (schema as z.ZodNullable<z.ZodTypeAny>).unwrap()
      return getTypeHint(innerSchema)
    }
    case z.ZodFirstPartyTypeKind.ZodDefault: {
      const {
        _def: { innerType },
      } = schema as z.ZodDefault<z.ZodTypeAny>
      return getTypeHint(innerType)
    }
    case z.ZodFirstPartyTypeKind.ZodCatch: {
      const {
        _def: { innerType },
      } = schema as z.ZodCatch<z.ZodTypeAny>
      return getTypeHint(innerType)
    }
    case z.ZodFirstPartyTypeKind.ZodBranded: {
      const {
        _def: { type: innerType },
      } = schema as z.ZodBranded<z.ZodTypeAny, string | number | symbol>
      return getTypeHint(innerType)
    }
    case z.ZodFirstPartyTypeKind.ZodPipeline: {
      const {
        _def: { in: input },
      } = schema as z.ZodPipeline<z.ZodTypeAny, z.ZodTypeAny>
      return getTypeHint(input)
    }
    case z.ZodFirstPartyTypeKind.ZodReadonly: {
      const {
        _def: { innerType },
      } = schema as z.ZodReadonly<z.ZodTypeAny>
      return getTypeHint(innerType)
    }
  }
  return 'unknown'
}
