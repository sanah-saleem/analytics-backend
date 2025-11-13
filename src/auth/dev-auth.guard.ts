import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";

// DEV ONLY: reads a fake user from header or env; swap with Google OAuth later.
@Injectable()
export class DevAuthGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const req = context.switchToHttp().getRequest();
        const email = req.header('x-dev-user') || process.env.DEV_USER_EMAIL;
        if(!email) throw new UnauthorizedException('Set x-dev-user header or DEV_USER_EMAIL for dev auth.');
        //attach a fake user
        req.user = { email, provider: 'dev'};
        return true;
    }
}
