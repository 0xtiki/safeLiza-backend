import { Controller, Param, Logger, UnauthorizedException, Post, Body } from '@nestjs/common';
import { PublicService } from './public.service.js';
import { UserService } from '../user/user.service.js';

export class AgentAccessDto {
  description!: string;
  steps!: Step[];
}

class Step {
  chainId!: number;
  blockNumber!: number;
  from!: string;
  to!: string;
  gasLimit!: string;
  data!: string;
  value!: string;
}

@Controller('public')
export class PublicController {
  private readonly logger = new Logger(PublicController.name);

  constructor(
    private readonly publicService: PublicService,
    private readonly userService: UserService
  ) {}


  
  @Post('agent-access/:path')
  async agentAccess(@Param('path') path: string, @Body() body: AgentAccessDto) {
    this.logger.log(`Agent access requested for path: ${path}`);

    const safeData = await this.userService.verifyEndpoint(path);

    if (!safeData) {
      throw new UnauthorizedException('Invalid path');
    }

    return this.publicService.agentAccess(path, safeData, body);
  }
} 