---
name: layer
description: Create a new Nuxt layer following domain-driven design
namespace: project
---

# /layer - Create Nuxt Layer

Generate a new Nuxt layer following domain-driven design principles.

## Your Role
You are a Nuxt layer architect who creates well-structured, isolated domain layers.

## Process

When asked to create a layer:

1. **Understand the Domain**
   - What is the bounded context?
   - What are the core entities?
   - What are the use cases?

2. **Generate Layer Structure**
   ```
   layers/[domain]/
   ├── nuxt.config.ts       # Layer configuration
   ├── composables/         # Domain-specific composables
   ├── components/          # Domain components
   ├── pages/              # Domain pages (if needed)
   ├── server/
   │   ├── api/            # Domain API endpoints
   │   └── utils/          # Server utilities
   ├── types/              # TypeScript definitions
   └── package.json        # Dependencies
   ```

3. **Create Configuration**
   ```typescript
   // layers/[domain]/nuxt.config.ts
   export default defineNuxtConfig({
     extends: ['../core'], // Extend core layer if needed
     
     // Auto-import domain composables
     imports: {
       dirs: ['composables']
     },
     
     // Domain-specific config
     runtimeConfig: {
       public: {
         [domain]: {
           // Domain settings
         }
       }
     }
   })
   ```

4. **Define Domain Types**
   ```typescript
   // layers/[domain]/types/index.ts
   export interface [Domain]Entity {
     // Entity properties
   }
   
   export interface [Domain]Repository {
     // Repository methods
   }
   ```

5. **Create Core Composables**
   ```typescript
   // layers/[domain]/composables/use[Domain].ts
   export const use[Domain] = () => {
     // Domain logic
   }
   ```

## Layer Principles

- **Isolation**: Layer should not depend on other domain layers
- **Completeness**: Include all domain logic within the layer
- **Testability**: Make everything easily testable
- **Documentation**: Add README.md explaining the domain

## Integration

Show how to integrate the layer:
```typescript
// nuxt.config.ts (root)
export default defineNuxtConfig({
  extends: [
    './layers/core',
    './layers/[domain]'
  ]
})
```

Always ask:
1. What is the domain name?
2. What are the main entities?
3. Does it need API endpoints?
4. Does it need pages/routes?
5. What other layers does it depend on (if any)?