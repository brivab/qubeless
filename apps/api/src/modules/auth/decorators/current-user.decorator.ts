import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthPayload } from '../auth.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthPayload;
  },
);
