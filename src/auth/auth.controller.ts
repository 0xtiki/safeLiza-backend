import {
  Controller,
  Post,
  Get,
  Req,
  UseGuards,
  Res,
  Logger,
  Body,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WebAuthnStrategy } from './webauthn.strategy.js';
import { SessionGuard } from './session.guard.js';
import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import base64url from 'base64url';
import { UserService } from '../user/user.service.js';
import { Hex } from 'viem';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private webAuthnStrategy: WebAuthnStrategy,
    private userService: UserService,
  ) {}

  @Post('passkey/challenge')
  async getPasskeyChallenge(@Req() req) {
    const userId = base64url.default.encode(uuidv4());
    const user = {
      id: userId,
      username: req.body.username || userId,
    };
    return new Promise((resolve, reject) => {
      // sign in with passkey
      if (user.id === user.username) {
        this.logger.log('Generating login challenge');

        this.webAuthnStrategy.getStore().challenge(req, (err, challenge) => {
          if (err) reject(err);
          if (!challenge) reject(new Error('No challenge generated'));

          const challengeHex = base64url.default.decode(
            base64url.default.encode(challenge!),
            'hex',
          );

          this.logger.log('challenge:', challengeHex);

          const data = {
            challenge: base64url.default.encode(`0x${challengeHex}`),
          };

          req.session['webauthn'] = data;
          req.session.save();

          console.log('Session after setting challenge:', req.session);

          resolve(data);
        });
      } else {
        // registrer passkey
        this.logger.log('Generating registration challenge');
        this.webAuthnStrategy
          .getStore()
          .challenge(req, { user: user }, (err, challenge) => {
            if (err) reject(err);
            if (!challenge) reject(new Error('No challenge generated'));

            const data = {
              user,
              challenge: base64url.default.encode(challenge!),
            };

            this.logger.log('data:', { user, challenge });

            // Store challenge under 'webauthn' key in session
            req.session['webauthn'] = data;
            req.session.save();

            resolve(data);
          });
      }
    });
  }

  @Post('passkey/verify')
  @UseGuards(AuthGuard('webauthn'))
  async verifyPasskey(@Req() req, @Body() body: { publicKeyHex: Hex }) {
    this.logger.log('verification complete');

    // Fetch the user from the database using the data in req.user
    const user = await this.userService.findOneByCustomId(req.user.customId);

    if (user && body.publicKeyHex) {
      // Update the user's publicKeyHex field
      if (!user.passkey) {
        user.passkey = {
          id: req.user.id,
          publicKeyPem: req.user.publicKeyPem,
          publicKeyHex: body.publicKeyHex,
        };
      } else {
        user.passkey.publicKeyHex = body.publicKeyHex;
      }
      await this.userService.updateUser(user);
    }

    // Store the user ID in the session
    req.session.userId = user?.customId;

    return req.user;
  }

  @Post('logout')
  async logout(@Req() req, @Res() res: Response) {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).send('Could not log out');
      }
      res.clearCookie('connect.sid'); // Clear the session cookie
      return res.send('Logged out');
    });
  }

  @Get('user')
  @UseGuards(SessionGuard)
  async getUser(@Req() req) {
    // Retrieve the user ID from the session
    const userId = req.session.userId;

    // Fetch the user from the database using the user ID
    const user = await this.userService.findOneByCustomId(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Return the user information
    return {
      id: user.id,
      username: user.username,
      safesByChain: user.safesByChain,
      // passkey: user.passkey,
    };
  }
}
