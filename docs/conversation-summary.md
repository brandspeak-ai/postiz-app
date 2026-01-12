# Conversation Summary

## Focus
- Produced a contributor guide (`AGENTS.md`) and explored how Postiz can support an agency business model covering client onboarding, channel integrations, posting, scheduling, and analytics.
- Answered follow-up questions on using the public API/SDK patterns and on infrastructure choices for a self-hosted offering.
- Clarified scaling expectations and potential bottlenecks when operating Postiz as a multi-tenant SaaS.

## Agency Capabilities
- Core tenancy is modeled by `Organization` (agency), `Customer` (client profiles), and `Integration` (per-channel credentials) records in `libraries/nestjs-libraries/src/database/prisma/schema.prisma`.
- Posts are scoped by organization + integration and support rich media, carousels, videos, and scheduling via BullMQ workers (`apps/workers`).
- Analytics endpoints combine provider-specific adapters in `libraries/nestjs-libraries/src/integrations/social/*`, enabling per-channel performance reporting.

## API & SDK Considerations
- Public API (`apps/backend/src/public-api/routes/v1/public.integrations.controller.ts`) already exposes media upload, slot discovery, integration listing, and post CRUD operations; internal routes add customer and analytics management.
- Authentication is handled with organization API keys, so an SDK can map “agency key → client profile → channel integration” without modifying the schema.

## Hosting & Scaling Guidance
- Backend (NestJS) and frontend (Next.js) are stateless; deploy on containers or serverless platforms, but keep dedicated worker and cron services online for BullMQ queues.
- Persistence depends on managed Postgres and Redis; scale vertically first, then add read replicas or shard organizations if needed.
- Platform rate limits, OAuth scopes (e.g., TikTok, Instagram), and AGPL-3.0 license obligations are the main non-technical constraints.
