import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class PasskeyAuthGuard extends AuthGuard('webauthn') {
  private readonly logger = new Logger(PasskeyAuthGuard.name);

  canActivate(context: ExecutionContext) {
    this.logger.log('PasskeyAuthGuard canActivate');

    this.logger.log(context);

    const req = context.switchToHttp().getRequest();
    const register = (username: string, options: any) => {
      this.logger.log('register', username, options);
    };
    req.register = register;
    // Add your custom authentication logic here
    // for example, call super.logIn(request) to establish a session.
    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    this.logger.log('PasskeyAuthGuard handleRequest');

    this.logger.log(err, user, info);
    // You can throw an exception based on either "info" or "err" arguments
    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    return user;
  }
}
