import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

interface RequestWithHeaders {
  headers: Record<string, string | string[] | undefined>;
}

@Injectable()
export class SchedulerSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expectedSecret = process.env.SCHEDULER_SECRET;

    if (!expectedSecret) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithHeaders>();
    const providedSecret = this.readHeader(request, 'x-scheduler-secret');

    if (providedSecret && this.matches(providedSecret, expectedSecret)) {
      return true;
    }

    throw new UnauthorizedException('Invalid scheduler secret.');
  }

  private readHeader(request: RequestWithHeaders, name: string): string | undefined {
    const value = request.headers[name];
    return Array.isArray(value) ? value[0] : value;
  }

  private matches(providedSecret: string, expectedSecret: string): boolean {
    const provided = Buffer.from(providedSecret);
    const expected = Buffer.from(expectedSecret);

    return provided.length === expected.length && timingSafeEqual(provided, expected);
  }
}
