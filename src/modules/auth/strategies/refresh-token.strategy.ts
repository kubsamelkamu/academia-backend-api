import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.getOrThrow<string>('auth.refreshSecret'),
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: unknown) {
    const authorizationHeader = req.get('Authorization');
    const refreshToken = authorizationHeader
      ? authorizationHeader.replace('Bearer', '').trim()
      : '';
    return { ...(payload as Record<string, unknown>), refreshToken };
  }
}
