import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, SessionChallengeStore } from 'passport-fido2-webauthn';
import { PasskeyService } from './passkey.service.js';

@Injectable()
export class WebAuthnStrategy extends PassportStrategy(Strategy, 'webauthn') {
  private readonly logger = new Logger(WebAuthnStrategy.name);

  private store: SessionChallengeStore;

  constructor(private passkeyService: PasskeyService) {
    const store = new SessionChallengeStore();

    super(
      { store },
      // passed in as verify
      async (
        id: string,
        userHandle: Buffer,
        verified: (
          error: any,
          user?: any,
          publicKeyPem?: string | null,
        ) => void,
      ) => {
        this.logger.log('Running verify callback');
        try {
          if (!id) {
            return verified({ message: 'Missing credential ID' }, false, null);
          }

          const user = await this.passkeyService.getUserByPasskeyId(id);

          this.logger.log('User found', user);

          return verified(null, user, user?.passkey?.publicKeyPem);
        } catch (error) {
          verified(error);
        }
      },
    );

    this.store = store;
  }

  // passed in as register
  async validate(
    user: { id: Buffer; username: string },
    credentialId: string,
    pem: string,
    registered: (error: any, user?: any) => void,
  ): Promise<any> {
    this.logger.log('Running register callback');

    return await this.register(
      user,
      credentialId,
      pem as string,
      registered as (error: any, user?: any) => void,
    );
  }

  async register(
    user: { id: Buffer; username: string },
    credentialId: string,
    pem: string,
    registered: (error: any, user?: any) => void,
  ) {
    try {
      const newUser = await this.passkeyService.registerPasskey(
        { username: user.username, id: user.id.toString() },
        credentialId,
        pem,
      );

      this.logger.log('New user registered', newUser);

      return registered(null, newUser);
    } catch (error) {
      throw new Error(`Registration failed: ${error}`);
    }
  }

  getStore() {
    return this.store;
  }
}
