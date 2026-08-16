import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { UserActor } from '../../../../core/actor/actor.js';
import { CurrentUser } from '../../../../core/decorators/current-user.decorator.js';
import { Public } from '../../../../core/decorators/public.decorator.js';
import { AuthService } from '../../../../modules/auth/auth.service.js';
import { LoginWithGoogleDto } from '../../../../modules/auth/commands/login-with-google/login-with-google.dto.js';
import { RequestLoginCodeDto } from '../../../../modules/auth/commands/request-login-code/request-login-code.dto.js';
import { VerifyLoginCodeDto } from '../../../../modules/auth/commands/verify-login-code/verify-login-code.dto.js';
import AuthConfig from '../../../../modules/auth/config/auth.config.js';
import {
  clearSessionCookie,
  readSessionCookie,
  setSessionCookie,
} from '../cookies/auth-cookies.helper.js';
import { CurrentUserResponseDto } from '../dto/current-user-response.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(AuthConfig.KEY)
    private readonly authConfig: ConfigType<typeof AuthConfig>,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async requestCode(@Body() dto: RequestLoginCodeDto): Promise<void> {
    await this.auth.requestLoginCode(dto);
  }

  @Public()
  @Post('login/verify-code')
  @HttpCode(HttpStatus.OK)
  async verifyLoginCode(
    @Body() dto: VerifyLoginCodeDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ userId: string }> {
    const result = await this.auth.verifyLoginCode(dto);

    setSessionCookie(reply, result.sessionToken, this.authConfig);

    return { userId: result.userId };
  }

  @Public()
  @Post('google')
  @HttpCode(HttpStatus.OK)
  async loginWithGoogle(
    @Body() dto: LoginWithGoogleDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ userId: string }> {
    const result = await this.auth.loginWithGoogle(dto);

    setSessionCookie(reply, result.sessionToken, this.authConfig);

    return { userId: result.userId };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const token = readSessionCookie(request, this.authConfig);

    if (token) {
      await this.auth.logout({ sessionToken: token });
    }

    clearSessionCookie(reply, this.authConfig);
  }

  @Get('me')
  async me(@CurrentUser() actor: UserActor): Promise<CurrentUserResponseDto> {
    const user = await this.auth.getUser(actor.id);

    return { id: user.id, email: user.email };
  }
}
