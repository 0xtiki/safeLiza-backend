import { Injectable, Logger } from '@nestjs/common';
import { UserService } from '../user/user.service.js';

@Injectable()
export class PasskeyService {
  private readonly logger = new Logger(PasskeyService.name);

  constructor(private userService: UserService) {}

  async getUserByPasskeyId(id: string) {
    return this.userService.findByPasskeyId(id);
  }

  async registerPasskey(
    user: { username: string; id: string },
    credentialId: string,
    pem: string,
  ) {
    try {
      const passkeyData = {
        id: credentialId,
        publicKeyPem: pem,
      };

      const existingCredentials =
        await this.userService.findByPasskeyId(credentialId);

      if (existingCredentials) {
        throw new Error('User already exists - duplicate credentials ID');
      }

      const existingUser = await this.userService.findByUsername(user.username);

      if (existingUser) {
        throw new Error('User already exists - duplicate username');
      }

      return await this.userService.createWithPasskey(user, passkeyData);
    } catch (error) {
      this.logger.error('Registration failed:', error);
      throw new Error(`Registration failed: ${error}`);
    }
  }
}
