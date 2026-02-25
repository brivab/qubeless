import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator to extract projectId from request params
 * Used by ProjectMembershipGuard to identify which project to check access for
 */
export const ProjectId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    // Try to get projectId from params, query, or body
    return request.params?.projectId || request.query?.projectId || request.body?.projectId;
  },
);
